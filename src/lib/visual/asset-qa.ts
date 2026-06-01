import { generateText, Output } from "ai";
import { aiVisualAssetReviewSchema } from "@/lib/ai-schemas";
import { getEnv } from "@/lib/env";
import {
  visualAssetReviewSchema,
  visualAssetReviewsSchema,
  visualAssetsSchema,
  type ArticleDraft,
  type BrandProfile,
  type VisualAsset,
  type VisualAssetReview,
  type VisualPlan,
} from "@/lib/schemas";

export type VisualAssetQaResult = {
  visualAssets: VisualAsset[];
  reviews: VisualAssetReview[];
};

export async function reviewVisualAssets(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
  visualPlan: VisualPlan;
  visualAssets: VisualAsset[];
}): Promise<VisualAssetQaResult> {
  const reviewedAssets: VisualAsset[] = [];
  const reviews: VisualAssetReview[] = [];

  for (const asset of input.visualAssets) {
    if (asset.status !== "generated" || !asset.publicUrl) {
      reviewedAssets.push(asset);
      reviews.push(skippedReview(asset, "Only generated image assets with public URLs are reviewed."));
      continue;
    }

    const visual = input.visualPlan.find(
      (item) => item.markdownPlaceholder === asset.sourcePlaceholder,
    );

    try {
      const review = await reviewGeneratedVisualAsset({
        ...input,
        asset,
        visualInstruction: visual?.instruction ?? "",
        visualPurpose: visual?.purpose ?? asset.caption,
      });

      reviews.push(review);
      reviewedAssets.push(review.status === "passed" ? asset : rejectAsset(asset, review));
    } catch (error) {
      const review = failedReview(asset, [
        "Visual Asset QA could not verify this generated image.",
        errorMessage(error),
      ].join(" "));
      reviews.push(review);
      reviewedAssets.push(rejectAsset(asset, review));
    }
  }

  return {
    visualAssets: visualAssetsSchema.parse(reviewedAssets),
    reviews: visualAssetReviewsSchema.parse(reviews),
  };
}

async function reviewGeneratedVisualAsset(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
  asset: VisualAsset;
  visualInstruction: string;
  visualPurpose: string;
}) {
  const { CONTENTDESK_AI_MODEL } = getEnv();
  const model = CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";

  const { output } = await generateText({
    model,
    output: Output.object({
      schema: aiVisualAssetReviewSchema,
    }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: visualAssetQaPrompt(input),
          },
          {
            type: "image",
            image: new URL(input.asset.publicUrl),
            mediaType: input.asset.mimeType || undefined,
          },
        ],
      },
    ],
  });

  return visualAssetReviewSchema.parse({
    ...output,
    sourcePlaceholder: input.asset.sourcePlaceholder,
    title: input.asset.title,
    createdAt: new Date().toISOString(),
  });
}

function visualAssetQaPrompt(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
  asset: VisualAsset;
  visualInstruction: string;
  visualPurpose: string;
}) {
  return [
    "You are ContentDesk's Visual Asset QA reviewer for a production Shopify app blog.",
    "Review the actual generated image, not only its intent.",
    `This image may be published by ${input.brandProfile.appName}, so use a production bar, not a demo bar.`,
    "",
    "Fail the image if any blocker is present:",
    "- dense text that will be hard to read on mobile",
    "- tiny labels, cramped worksheet text, or too many checklist items",
    "- duplicated sections, repeated headings, or inconsistent structure",
    "- misspellings, garbled words, odd AI-generated text, or awkward phrasing visible in the image",
    "- fake Shopify admin UI, fake metrics, or unsupported product claims",
    "- visual clutter that makes the article feel unpolished",
    "- a bitmap worksheet/checklist that would work better as accessible Markdown",
    "- mismatch with the article topic, visual purpose, brand profile, or practical editorial style",
    "- a garment, model, fabric, pose, or product detail that looks unbelievable or distorted",
    "- product presentation that is too vague to demonstrate fashion ecommerce value",
    "- generic SaaS, generic ecommerce, or stock-photo energy instead of premium fashion merchant taste",
    "- styling that does not feel desirable enough for a Shopify fashion product photography blog",
    "",
    "Passing images should be simple, legible, accurate, useful in a real public guide, and visually desirable to a Shopify fashion merchant.",
    "For a lead outcome visual, ask whether the image makes the merchant want their own store visuals to look this premium.",
    "If the concept is useful but this image should not ship, choose regenerate or replace_with_markdown.",
    "",
    "Return structured review only.",
    "",
    "Article:",
    `Title: ${input.draft.metadata.title}`,
    `Topic: ${input.draft.topic.topic}`,
    "",
    "Brand:",
    `App: ${input.brandProfile.appName}`,
    `Target merchant: ${input.brandProfile.targetMerchant}`,
    `Positioning: ${input.brandProfile.positioning}`,
    `Preferred visuals: ${formatProfileList(input.brandProfile.preferredVisuals) || "- Not set"}`,
    `Visuals to avoid: ${formatProfileList(input.brandProfile.visualsToAvoid) || "- Not set"}`,
    "",
    "Visual asset:",
    `Title: ${input.asset.title}`,
    `Purpose: ${input.visualPurpose}`,
    `Alt text: ${input.asset.altText}`,
    `Original caption: ${input.asset.caption || "- None"}`,
    `Generation instruction: ${input.visualInstruction || input.asset.prompt || "- None"}`,
  ].join("\n");
}

function formatProfileList(values: string[] | string | undefined) {
  if (typeof values === "string") return values.trim();

  return values?.join(", ") ?? "";
}

function rejectAsset(asset: VisualAsset, review: VisualAssetReview): VisualAsset {
  return {
    ...asset,
    status: "failed",
    error: [
      "Visual Asset QA rejected this generated image.",
      `Recommendation: ${review.recommendation}.`,
      review.summary,
      review.blockers.length ? `Blockers: ${review.blockers.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function skippedReview(asset: VisualAsset, summary: string): VisualAssetReview {
  return {
    sourcePlaceholder: asset.sourcePlaceholder,
    title: asset.title,
    status: "skipped",
    summary,
    blockers: [],
    recommendation: "not_reviewed",
    captionSuggestion: "",
    createdAt: new Date().toISOString(),
  };
}

function failedReview(asset: VisualAsset, summary: string): VisualAssetReview {
  return {
    sourcePlaceholder: asset.sourcePlaceholder,
    title: asset.title,
    status: "failed",
    summary,
    blockers: [summary],
    recommendation: "manual_review",
    captionSuggestion: "",
    createdAt: new Date().toISOString(),
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
