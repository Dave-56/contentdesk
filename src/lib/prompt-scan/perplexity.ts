import { z } from "zod";
import type { ProviderPromptResult } from "@/lib/prompt-scan/analyzer";
import type { PromptProvider } from "@/lib/prompt-scan/provider";

const perplexityResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().default(""),
      }),
    }),
  ).default([]),
  citations: z.array(z.string()).optional(),
  search_results: z.array(
    z.object({
      url: z.string().optional(),
    }),
  ).optional(),
});

export async function runPerplexityPrompt(input: {
  apiKey: string;
  prompt: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<ProviderPromptResult> {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? "sonar",
      messages: [
        {
          role: "system",
          content: [
            "Answer the user's question naturally as a buyer research assistant.",
            "Do not favor any brand unless the available evidence supports it.",
          ].join(" "),
        },
        {
          role: "user",
          content: input.prompt,
        },
      ],
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Perplexity request failed with ${response.status}: ${body.slice(0, 500)}`,
    );
  }

  const parsed = perplexityResponseSchema.parse(await response.json());
  const answerText = parsed.choices[0]?.message.content ?? "";
  const citedUrls = [
    ...(parsed.citations ?? []),
    ...(parsed.search_results?.flatMap((result) => result.url ? [result.url] : []) ?? []),
    ...urlsFromText(answerText),
  ];

  return {
    answerText,
    citedUrls: [...new Set(citedUrls)],
  };
}

export function createPerplexityProvider(input: {
  apiKey: string;
  runPrompt?: typeof runPerplexityPrompt;
}): PromptProvider {
  const runPrompt = input.runPrompt ?? runPerplexityPrompt;

  return {
    id: "perplexity",
    scanPrompt({ prompt, signal }) {
      return runPrompt({
        apiKey: input.apiKey,
        prompt,
        ...(signal ? { signal } : {}),
      });
    },
  };
}

function urlsFromText(text: string) {
  return text.match(/https?:\/\/[^\s)\]]+/g) ?? [];
}
