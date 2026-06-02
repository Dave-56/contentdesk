import type { ProviderPromptResult } from "@/lib/prompt-scan/analyzer";
import type { PromptProvider } from "@/lib/prompt-scan/provider";

const systemPrompt = [
  "You are helping measure AI-search visibility for a Shopify app.",
  "Answer the buyer prompt naturally.",
  "Include citations from current web sources when available.",
].join(" ");

export async function runOpenAiPrompt(input: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<ProviderPromptResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? "gpt-5",
      instructions: systemPrompt,
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      input: input.prompt,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenAI request failed with ${response.status}: ${body.slice(0, 500)}`,
    );
  }

  const parsed: unknown = await response.json();

  return {
    answerText: extractOpenAiAnswerText(parsed),
    citedUrls: uniqueUrls(extractOpenAiCitedUrls(parsed)),
  };
}

export function createOpenAiProvider(input: {
  apiKey: string;
  runPrompt?: typeof runOpenAiPrompt;
}): PromptProvider {
  const runPrompt = input.runPrompt ?? runOpenAiPrompt;

  return {
    id: "openai",
    scanPrompt({ prompt }) {
      return runPrompt({
        apiKey: input.apiKey,
        prompt,
      });
    },
  };
}

export function extractOpenAiAnswerText(value: unknown): string {
  if (!isRecord(value)) return "";
  if (typeof value.output_text === "string") return value.output_text;

  const output = Array.isArray(value.output) ? value.output : [];
  const textParts = output.flatMap((item) => {
    if (!isRecord(item) || item.type !== "message") return [];
    const content = Array.isArray(item.content) ? item.content : [];
    return content.flatMap((block) => {
      if (!isRecord(block)) return [];
      return typeof block.text === "string" ? [block.text] : [];
    });
  });

  return textParts.join("");
}

export function extractOpenAiCitedUrls(value: unknown): string[] {
  return [
    ...extractOpenAiUrlCitations(value),
    ...extractOpenAiSourceUrls(value),
  ];
}

function extractOpenAiUrlCitations(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(extractOpenAiUrlCitations);
  if (!isRecord(value)) return [];

  const ownUrls =
    value.type === "url_citation" && typeof value.url === "string" ? [value.url] : [];

  return [
    ...ownUrls,
    ...Object.values(value).flatMap(extractOpenAiUrlCitations),
  ];
}

function extractOpenAiSourceUrls(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(extractOpenAiSourceUrls);
  if (!isRecord(value)) return [];

  const sourceUrls = Array.isArray(value.sources)
    ? value.sources.flatMap((source) =>
        isRecord(source) && typeof source.url === "string" ? [source.url] : [],
      )
    : [];

  return [
    ...sourceUrls,
    ...Object.values(value).flatMap(extractOpenAiSourceUrls),
  ];
}

function uniqueUrls(urls: string[]) {
  return [...new Set(urls)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
