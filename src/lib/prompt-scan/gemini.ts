import type { ProviderPromptResult } from "@/lib/prompt-scan/analyzer";
import type { PromptProvider } from "@/lib/prompt-scan/provider";

const systemPrompt = [
  "Answer the user's question naturally as a buyer research assistant.",
  "Do not favor any brand unless the available evidence supports it.",
].join(" ");

export async function runGeminiPrompt(input: {
  apiKey: string;
  prompt: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<ProviderPromptResult> {
  const model = input.model ?? "gemini-3.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: input.prompt }],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
      }),
      signal: input.signal,
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini request failed with ${response.status}: ${body.slice(0, 500)}`);
  }

  const parsed: unknown = await response.json();

  return {
    answerText: extractGeminiAnswerText(parsed),
    citedUrls: uniqueUrls(extractGeminiCitedUrls(parsed)),
  };
}

export function createGeminiProvider(input: {
  apiKey: string;
  runPrompt?: typeof runGeminiPrompt;
}): PromptProvider {
  const runPrompt = input.runPrompt ?? runGeminiPrompt;

  return {
    id: "gemini",
    scanPrompt({ prompt, signal }) {
      return runPrompt({
        apiKey: input.apiKey,
        prompt,
        ...(signal ? { signal } : {}),
      });
    },
  };
}

export function extractGeminiAnswerText(value: unknown): string {
  if (!isRecord(value)) return "";
  const candidates = Array.isArray(value.candidates) ? value.candidates : [];
  const textParts = candidates.flatMap((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.content)) return [];
    const parts = Array.isArray(candidate.content.parts) ? candidate.content.parts : [];
    return parts.flatMap((part) =>
      isRecord(part) && typeof part.text === "string" ? [part.text] : [],
    );
  });

  return textParts.join("");
}

export function extractGeminiCitedUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(extractGeminiCitedUrls);
  if (!isRecord(value)) return [];

  const directUrls =
    isRecord(value.web) && typeof value.web.uri === "string" ? [value.web.uri] : [];

  return [
    ...directUrls,
    ...Object.values(value).flatMap(extractGeminiCitedUrls),
  ];
}

function uniqueUrls(urls: string[]) {
  return [...new Set(urls)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
