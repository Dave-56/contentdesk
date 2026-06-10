import { summarizePromptAnswer } from "@/lib/prompt-answer-summary";
import type { AnswerSignal, PromptGroup } from "@/lib/prompt-scan/schemas";

const summaryModel = "claude-haiku-4-5-20251001";
const maxSummaryTokens = 200;

export type SmartSummaryInput = {
  question: string;
  brandName: string;
  rawAnswer: string;
  group?: PromptGroup;
  answerSignal?: AnswerSignal;
  apiKey?: string;
  signal?: AbortSignal;
  runSummary?: typeof runAnthropicSummary;
};

/**
 * Question-aware takeaway for one engine answer. Tells the client what the
 * engine actually answered (named tools, the pick, the recommended approach)
 * plus where the brand landed — so they need not read the raw answer.
 *
 * Falls back to the deterministic sentence-extraction summary whenever the
 * model is unavailable or errors. A summary must never break a prompt run.
 */
export async function generateSmartSummary(input: SmartSummaryInput): Promise<string> {
  const fallback = () => summarizePromptAnswer(input.rawAnswer);
  const cleanedAnswer = input.rawAnswer.trim();
  const apiKey = input.apiKey ?? process.env.ANTHROPIC_API_KEY;

  if (!cleanedAnswer || !apiKey) return fallback();

  const runSummary = input.runSummary ?? runAnthropicSummary;

  try {
    const summary = await runSummary({
      apiKey,
      prompt: buildSummaryPrompt(input),
      ...(input.signal ? { signal: input.signal } : {}),
    });
    const trimmed = summary.trim();

    return trimmed || fallback();
  } catch {
    return fallback();
  }
}

const summarySystemPrompt = [
  "You compress one AI-search engine answer into a takeaway for a brand-visibility client.",
  "Lead with the substance that answers the buyer's question: the named tools/products, the engine's pick, or the recommended approach — in the engine's own framing.",
  "Then state where the client's brand stands (named and where, or absent).",
  "1-2 sentences, max 45 words. No preamble, no 'the engine says', no markdown, no citation markers.",
].join(" ");

export function buildSummaryPrompt(input: SmartSummaryInput): string {
  const verdict = brandVerdictLine(input.brandName, input.answerSignal);
  const stage = input.group ? `Buyer stage: ${input.group.replace(/_/g, " ")}.` : "";

  return [
    `Client brand: ${input.brandName}.`,
    `Buyer question: "${input.question}".`,
    stage,
    verdict,
    "",
    "Engine answer:",
    input.rawAnswer,
  ]
    .filter(Boolean)
    .join("\n");
}

function brandVerdictLine(brandName: string, answerSignal?: AnswerSignal): string {
  if (!answerSignal) return "";
  if (answerSignal.brandPresence === "absent") {
    return `Computed verdict: ${brandName} is absent from this answer.`;
  }

  const rank = answerSignal.brandRank ? ` at rank #${answerSignal.brandRank}` : "";
  return `Computed verdict: ${brandName} is mentioned${rank} (${answerSignal.brandRecommendation}).`;
}

export async function runAnthropicSummary(input: {
  apiKey: string;
  prompt: string;
  model?: string;
  signal?: AbortSignal;
}): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? summaryModel,
      max_tokens: maxSummaryTokens,
      system: summarySystemPrompt,
      messages: [{ role: "user", content: input.prompt }],
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic summary failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  return extractSummaryText(await response.json());
}

function extractSummaryText(value: unknown): string {
  if (!isRecord(value)) return "";
  const content = Array.isArray(value.content) ? value.content : [];

  return content
    .flatMap((block) =>
      isRecord(block) && block.type === "text" && typeof block.text === "string"
        ? [block.text]
        : [],
    )
    .join("")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
