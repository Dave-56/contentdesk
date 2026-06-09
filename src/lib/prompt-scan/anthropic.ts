import type { ProviderPromptResult } from "@/lib/prompt-scan/analyzer";
import type { PromptProvider } from "@/lib/prompt-scan/provider";

const systemPrompt = [
  "Answer the user's question naturally as a buyer research assistant.",
  "Do not favor any brand unless the available evidence supports it.",
].join(" ");

export async function runAnthropicPrompt(input: {
  apiKey: string;
  prompt: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<ProviderPromptResult> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? "claude-opus-4-8",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: input.prompt,
        },
      ],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Anthropic request failed with ${response.status}: ${body.slice(0, 500)}`,
    );
  }

  const parsed: unknown = await response.json();

  return {
    answerText: extractAnthropicAnswerText(parsed),
    citedUrls: uniqueUrls(extractAnthropicCitedUrls(parsed)),
  };
}

export function createAnthropicProvider(input: {
  apiKey: string;
  runPrompt?: typeof runAnthropicPrompt;
}): PromptProvider {
  const runPrompt = input.runPrompt ?? runAnthropicPrompt;

  return {
    id: "anthropic",
    scanPrompt({ prompt, signal }) {
      return runPrompt({
        apiKey: input.apiKey,
        prompt,
        ...(signal ? { signal } : {}),
      });
    },
  };
}

export function extractAnthropicAnswerText(value: unknown): string {
  if (!isRecord(value)) return "";
  const content = Array.isArray(value.content) ? value.content : [];

  return content
    .flatMap((block) =>
      isRecord(block) && block.type === "text" && typeof block.text === "string"
        ? [block.text]
        : [],
    )
    .join("");
}

export function extractAnthropicCitedUrls(value: unknown): string[] {
  return [
    ...extractAnthropicCitationUrls(value),
    ...extractAnthropicSearchResultUrls(value),
  ];
}

function extractAnthropicCitationUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(extractAnthropicCitationUrls);
  if (!isRecord(value)) return [];

  const ownUrls =
    value.type === "web_search_result_location" && typeof value.url === "string"
      ? [value.url]
      : [];

  return [
    ...ownUrls,
    ...Object.values(value).flatMap(extractAnthropicCitationUrls),
  ];
}

function extractAnthropicSearchResultUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(extractAnthropicSearchResultUrls);
  if (!isRecord(value)) return [];

  const ownUrls =
    value.type === "web_search_result" && typeof value.url === "string" ? [value.url] : [];

  return [
    ...ownUrls,
    ...Object.values(value).flatMap(extractAnthropicSearchResultUrls),
  ];
}

function uniqueUrls(urls: string[]) {
  return [...new Set(urls)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
