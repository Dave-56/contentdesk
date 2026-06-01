import { z } from "zod";
import type { ProviderPromptResult } from "@/lib/prompt-scan/analyzer";

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
            "You are helping measure AI-search visibility for a Shopify app.",
            "Answer the buyer prompt naturally.",
            "Include citations from current web sources when available.",
          ].join(" "),
        },
        {
          role: "user",
          content: input.prompt,
        },
      ],
    }),
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

function urlsFromText(text: string) {
  return text.match(/https?:\/\/[^\s)\]]+/g) ?? [];
}
