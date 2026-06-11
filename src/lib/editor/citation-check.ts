import { generateText, Output } from "ai";
import { aiCitationCheckSchema } from "@/lib/ai-schemas";
import { getEnv } from "@/lib/env";
import type { ArticleDraft, QaBlockerIssue, ResearchSource } from "@/lib/schemas";

const MAX_CITATION_BLOCKERS = 5;

export type CitationCheckResult = {
  issues: QaBlockerIssue[];
  usedFallback: boolean;
};

export async function checkCitations(input: {
  draft: ArticleDraft;
  sources: ResearchSource[];
}): Promise<CitationCheckResult> {
  if (!isAiGatewayConfigured() || input.sources.length === 0) {
    return { issues: [], usedFallback: true };
  }

  try {
    const { CONTENTDESK_AI_MODEL } = getEnv();
    const model = CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";

    const { output } = await generateText({
      model,
      output: Output.object({
        schema: aiCitationCheckSchema,
      }),
      prompt: citationCheckPrompt(input),
    });

    const issues = output.unsupportedClaims
      .slice(0, MAX_CITATION_BLOCKERS)
      .map((claim): QaBlockerIssue => ({
        area: "sources",
        severity: "blocker",
        // mergeBlockers dedupes on `finding`, so each claim needs a distinct finding
        finding: `Draft states a factual claim that no approved research source supports: "${claim.claim}"`,
        evidence: claim.claim,
        instruction: `Remove this claim or rewrite it so it only says what an approved source excerpt supports: "${claim.claim}". ${claim.reason}`,
      }));

    return { issues, usedFallback: false };
  } catch (error) {
    console.warn("[citation check fallback]", errorMessage(error));
    return { issues: [], usedFallback: true };
  }
}

function citationCheckPrompt(input: {
  draft: ArticleDraft;
  sources: ResearchSource[];
}) {
  return [
    "You are ContentDesk's Citation Checker agent. You verify that the article's factual claims are supported by the approved research source excerpts before the founder sees the draft.",
    "Only flag specific, checkable factual claims: statistics, percentages, dates, named studies, platform behavior or policy facts, named third-party feature claims, and pricing facts.",
    "Do not flag general advice, opinions, workflow recommendations, brand positioning that matches the brand profile, or common knowledge a Shopify founder would not dispute.",
    "A claim is supported if any source excerpt states it or clearly implies it. Treat the excerpts as the source of truth.",
    "Return at most five unsupported claims, worst first. For each, quote the claim text from the draft and explain in one sentence why no excerpt supports it.",
    "If every checkable claim is supported, return an empty list.",
    "",
    "Article Markdown:",
    input.draft.markdown,
    "",
    "Source notes from the writer:",
    input.draft.sourceNotes || "- None",
    "",
    "Approved research sources:",
    input.sources.map(formatSourceForPrompt).join("\n\n"),
  ].join("\n");
}

function formatSourceForPrompt(source: ResearchSource, index: number) {
  const content = source.extractedMarkdown || source.excerpt;

  return [
    `Source ${index + 1}`,
    `URL: ${source.url}`,
    `Title: ${source.title || "Untitled"}`,
    `Excerpt: ${content.slice(0, 3200)}`,
  ].join("\n");
}

function isAiGatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
