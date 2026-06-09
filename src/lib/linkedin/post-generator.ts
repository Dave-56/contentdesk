import { generateText, Output } from "ai";
import { aiLinkedInPostSchema } from "@/lib/ai-schemas";
import { formatBrandVoiceForPrompt } from "@/lib/brand-voice";
import { getEnv } from "@/lib/env";
import {
  linkedInPostSchema,
  type ArticleDraft,
  type BrandProfile,
  type LinkedInPost,
  type RecommendationTargetPrompt,
  type VisualPlan,
  type VisualPlanItem,
} from "@/lib/schemas";

export type LinkedInPostGeneratorResult = {
  post: LinkedInPost;
  usedFallback: boolean;
  fallbackError?: LinkedInPostFallbackError;
};

export type LinkedInPostFallbackError = {
  errorName: string;
  errorMessage: string;
  errorStack: string;
};

export async function generateLinkedInPost(input: {
  brandProfile: BrandProfile;
  articleDraft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  sourceArtifactId: string;
  sourceUrl?: string;
}): Promise<LinkedInPostGeneratorResult> {
  if (!isAiGatewayConfigured()) {
    return {
      post: fallbackLinkedInPost(input),
      usedFallback: true,
      fallbackError: fallbackErrorDetails(
        new Error(
          "AI generation is not configured. Add AI_GATEWAY_API_KEY or Vercel OIDC credentials, then restart the Slack app.",
        ),
      ),
    };
  }

  try {
    const post = await generateAiLinkedInPost(input);

    return {
      post,
      usedFallback: false,
    };
  } catch (error) {
    console.warn("[linkedin post fallback]", errorMessage(error));

    return {
      post: fallbackLinkedInPost(input),
      usedFallback: true,
      fallbackError: fallbackErrorDetails(error),
    };
  }
}

async function generateAiLinkedInPost(input: {
  brandProfile: BrandProfile;
  articleDraft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  sourceArtifactId: string;
  sourceUrl?: string;
}) {
  const { CONTENTDESK_AI_MODEL } = getEnv();
  const model = CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";
  const { output } = await generateText({
    model,
    output: Output.object({
      schema: aiLinkedInPostSchema,
    }),
    prompt: linkedInPostPrompt(input),
  });

  return linkedInPostSchema.parse({
    ...output,
    createdAt: new Date().toISOString(),
    channel: "company_page",
    format: "text",
    status: "draft",
    sourceArticleTitle: input.articleDraft.metadata.title,
    sourceArtifactId: input.sourceArtifactId,
    sourceUrl: input.sourceUrl,
    targetPrompts: targetPromptsFromArticle(input.articleDraft),
    publishUrl: "",
    publishedAt: null,
    outcomeNotes: "",
  });
}

function linkedInPostPrompt(input: {
  brandProfile: BrandProfile;
  articleDraft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
}) {
  return [
    "You are ContentDesk's LinkedIn distribution writer for Shopify app founders.",
    "Create one LinkedIn company-page text post repurposed from the final QA-passed article.",
    "Write for the brand account, not a fake person. Do not use first-person founder language like 'I built this' or 'my app' unless explicitly present in the Brand Profile voice.",
    "Make the post practical, visual, and Shopify-specific. Do not summarize the whole article; pull out one useful angle that can stand alone in-feed.",
    "Use a concrete product-page or product-image problem before mentioning the brand.",
    "Avoid hype, unsupported metrics, fake case studies, and generic AI-productivity claims.",
    "Return concise text suitable for manual posting from the company page.",
    "",
    "Brand voice contract:",
    formatBrandVoiceForPrompt(input.brandProfile),
    "",
    "Brand Profile:",
    JSON.stringify(input.brandProfile, null, 2),
    "",
    "Article metadata:",
    JSON.stringify(input.articleDraft.metadata, null, 2),
    "",
    "Article CTA:",
    input.articleDraft.cta,
    "",
    "Article short source material:",
    articleExcerpt(input.articleDraft),
    "",
    "Visual plan context:",
    JSON.stringify([input.leadVisual, ...input.visualPlan], null, 2),
    "",
    "Output fields:",
    "- hook: first 1-2 lines of the LinkedIn post.",
    "- body: main post text. Use short paragraphs and no Markdown headings.",
    "- cta: soft next step. It may name the brand, but keep it low-pressure.",
    "- visualBrief: one practical visual idea for this post, or empty string if text-only is better.",
  ].join("\n");
}

export function fallbackLinkedInPost(input: {
  brandProfile: BrandProfile;
  articleDraft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  sourceArtifactId: string;
  sourceUrl?: string;
}) {
  const title = input.articleDraft.metadata.title;
  const opening = firstUsefulParagraph(input.articleDraft.markdown);
  const hook = `${input.brandProfile.targetMerchant} can usually spot the image problem before they can name it.`;
  const body = [
    opening || `${title} is worth solving before you add more traffic to a product page.`,
    "",
    `The practical question: does the product image help a shopper understand fit, texture, and store quality fast enough to keep moving?`,
    "",
    `${input.brandProfile.appName} focuses on that job for ${input.brandProfile.targetMerchant}: ${input.brandProfile.positioning}`,
  ].join("\n");
  const visualBrief = input.leadVisual
    ? `${input.leadVisual.title}: ${input.leadVisual.purpose}`
    : "";

  return linkedInPostSchema.parse({
    createdAt: new Date().toISOString(),
    channel: "company_page",
    format: "text",
    status: "draft",
    hook,
    body,
    cta: input.articleDraft.cta,
    visualBrief,
    sourceArticleTitle: title,
    sourceArtifactId: input.sourceArtifactId,
    sourceUrl: input.sourceUrl,
    targetPrompts: targetPromptsFromArticle(input.articleDraft),
    publishUrl: "",
    publishedAt: null,
    outcomeNotes: "",
  });
}

function targetPromptsFromArticle(draft: ArticleDraft): RecommendationTargetPrompt[] {
  const intent = draft.topic.intentType ?? draft.topic.searchIntent;

  return uniqueStrings([
    draft.topic.topic,
    ...draft.metadata.targetQueries,
  ]).slice(0, 5).map((prompt) => ({
    prompt,
    intent,
  }));
}

function articleExcerpt(draft: ArticleDraft) {
  return [
    `Title: ${draft.metadata.title}`,
    `Meta description: ${draft.metadata.metaDescription}`,
    `Topic: ${draft.topic.topic}`,
    `Merchant pain: ${draft.topic.targetMerchantPain}`,
    `Shopify angle: ${draft.topic.shopifySpecificAngle}`,
    "",
    draft.markdown.slice(0, 5000),
  ].join("\n");
}

function firstUsefulParagraph(markdown: string) {
  return markdown
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith("#") && !part.startsWith("![")) ?? "";
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isAiGatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function fallbackErrorDetails(error: unknown): LinkedInPostFallbackError {
  const fallbackError = error instanceof Error ? error : new Error(String(error));

  return {
    errorName: fallbackError.name || "Error",
    errorMessage: fallbackError.message,
    errorStack: fallbackError.stack ?? "",
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
