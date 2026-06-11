import { generateText, Output } from "ai";
import { aiDeslopResultSchema } from "@/lib/ai-schemas";
import { getEnv } from "@/lib/env";
import type { ArticleDraft, BrandProfile } from "@/lib/schemas";

export type DeslopResult = {
  draft: ArticleDraft;
  changes: string[];
  usedFallback: boolean;
};

export async function deslopArticleDraft(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
}): Promise<DeslopResult> {
  if (!isAiGatewayConfigured()) {
    return { draft: input.draft, changes: [], usedFallback: true };
  }

  try {
    const { CONTENTDESK_AI_MODEL } = getEnv();
    const model = CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";

    const { output } = await generateText({
      model,
      output: Output.object({
        schema: aiDeslopResultSchema,
      }),
      prompt: deslopPrompt(input),
    });

    if (output.changes.length === 0) {
      return { draft: input.draft, changes: [], usedFallback: false };
    }

    const violation = rewriteViolation(input.draft.markdown, output.markdown);
    if (violation) {
      console.warn("[deslop fallback]", violation);
      return { draft: input.draft, changes: [], usedFallback: true };
    }

    return {
      draft: {
        ...input.draft,
        markdown: output.markdown,
        metadata: {
          ...input.draft.metadata,
          metaDescription: output.metaDescription,
        },
        cta: output.cta,
      },
      changes: output.changes,
      usedFallback: false,
    };
  } catch (error) {
    console.warn("[deslop fallback]", errorMessage(error));
    return { draft: input.draft, changes: [], usedFallback: true };
  }
}

function deslopPrompt(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
}) {
  return [
    "You are ContentDesk's Copy Editor agent. Your only job is to strip AI-isms from a drafted article before the founder reads it.",
    "Rewrite at sentence level only. Do not restructure, expand, or shorten the article meaningfully.",
    "",
    "Remove or rewrite these AI-ism patterns wherever they appear:",
    "- Stock scene-setting: \"in today's fast-paced / digital / ever-evolving landscape\", \"in the world of\", \"as ecommerce continues to grow\".",
    "- Hype filler: \"game-changer\", \"unlock\", \"elevate\", \"supercharge\", \"seamless\", \"robust\", \"leverage\" as a verb, \"take it to the next level\".",
    "- Throat-clearing: \"it's important to note\", \"it's worth noting\", \"let's dive in\", \"delve into\", \"navigate the world of\".",
    "- Empty contrast frames: \"it's not just about X, it's about Y\", \"whether you're A or B\".",
    "- Formulaic transitions: paragraph after paragraph starting with \"Furthermore\", \"Moreover\", \"Additionally\", \"In conclusion\".",
    "- Overused triadic lists and rhetorical-question openers when they add nothing.",
    "",
    "Hard constraints — violating any of these makes the output unusable:",
    "- Keep every Markdown heading (#, ##, ###) exactly as written, character for character. Visual placement is matched against headings.",
    "- Keep every URL and Markdown link exactly as written.",
    "- Keep every factual claim, number, statistic, and brand/app mention. Never add a new claim or fact.",
    "- Keep the article H1 and the metadata title meaning intact; the final title is locked.",
    "- Keep overall length within roughly 10% of the original.",
    "",
    "Also de-slop the meta description and CTA with the same rules. Return them unchanged if they are already clean.",
    "If the article is already clean, return it unchanged with an empty changes list.",
    "List each change you made as a short before → after note in changes.",
    "",
    "Brand voice to preserve:",
    input.brandProfile.preferredVoice || "No explicit voice preference; keep it plain, direct, and practical.",
    "",
    "Metadata title (locked, do not change):",
    input.draft.metadata.title,
    "",
    "Meta description:",
    input.draft.metadata.metaDescription,
    "",
    "CTA:",
    input.draft.cta,
    "",
    "Markdown body:",
    input.draft.markdown,
  ].join("\n");
}

export function rewriteViolation(originalMarkdown: string, rewrittenMarkdown: string) {
  const originalHeadings = markdownHeadings(originalMarkdown);
  const rewrittenHeadings = markdownHeadings(rewrittenMarkdown);

  if (originalHeadings.join("\n") !== rewrittenHeadings.join("\n")) {
    return "Rewrite changed Markdown headings.";
  }

  const missingUrls = markdownUrls(originalMarkdown).filter(
    (url) => !rewrittenMarkdown.includes(url),
  );
  if (missingUrls.length > 0) {
    return `Rewrite dropped URLs: ${missingUrls.slice(0, 3).join(", ")}`;
  }

  if (rewrittenMarkdown.length < originalMarkdown.length * 0.7) {
    return `Rewrite shrank the article from ${originalMarkdown.length} to ${rewrittenMarkdown.length} characters.`;
  }

  return "";
}

function markdownHeadings(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^#{1,3}\s+/.test(line));
}

function markdownUrls(markdown: string) {
  return [...new Set(markdown.match(/https?:\/\/[^\s)\]"']+/g) ?? [])];
}

function isAiGatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
