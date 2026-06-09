import { generateText } from "ai";
import { put } from "@vercel/blob";
import { formatBrandVoiceForPrompt } from "@/lib/brand-voice";
import { getEnv } from "@/lib/env";
import {
  visualAssetsSchema,
  type ArticleDraft,
  type BrandProfile,
  type VisualAsset,
  type VisualPlan,
  type VisualPlanItem,
} from "@/lib/schemas";

export type VisualAssetGeneratorResult = {
  visualAssets: VisualAsset[];
  usedFallback: boolean;
  generationConfigured: boolean;
};

const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";
const BLOB_UPLOAD_ATTEMPTS = 2;

export async function generateVisualAssets(input: {
  cycleId: string;
  draft: ArticleDraft;
  visualPlan: VisualPlan;
  brandProfile: BrandProfile;
}): Promise<VisualAssetGeneratorResult> {
  const generationConfigured = isImageGenerationConfigured();
  if (!generationConfigured) {
    return {
      visualAssets: visualAssetsSchema.parse([]),
      usedFallback: true,
      generationConfigured,
    };
  }

  const visualAssets: VisualAsset[] = [];

  for (const visual of input.visualPlan) {
    if (!shouldGenerateImage(visual)) {
      continue;
    }

    try {
      visualAssets.push(await generateVisualAsset({ ...input, visual }));
    } catch (error) {
      console.warn("[visual asset generation failed]", errorMessage(error));
      visualAssets.push(
        failedAsset({
          visual,
          prompt: imagePrompt({ ...input, visual }),
          error: errorMessage(error),
        }),
      );
    }
  }

  return {
    visualAssets: visualAssetsSchema.parse(visualAssets),
    usedFallback: visualAssets.every((asset) => asset.status !== "generated"),
    generationConfigured,
  };
}

async function generateVisualAsset(input: {
  cycleId: string;
  draft: ArticleDraft;
  visual: VisualPlanItem;
  brandProfile: BrandProfile;
}) {
  const { CONTENTDESK_IMAGE_MODEL } = getEnv();
  const model = CONTENTDESK_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
  const prompt = imagePrompt(input);
  const result = await generateText({
    model,
    prompt,
  });

  const image = result.files.find((file) => file.mediaType.startsWith("image/"));
  if (!image) {
    throw new Error("Image model returned no image file.");
  }

  const mimeType = image.mediaType || "image/png";
  const extension = extensionForMediaType(mimeType);
  const fileName = `${slugify(input.visual.title)}-${hash(input.visual.markdownPlaceholder)}.${extension}`;
  const assetPath = `generated/cycles/${slugify(input.cycleId)}/${fileName}`;
  const imageBuffer = Buffer.from(image.uint8Array);
  const storedAsset = await storeGeneratedImage({
    assetPath,
    imageBuffer,
    mimeType,
  });


  return visualAsset({
    visual: input.visual,
    status: "generated",
    assetType: "generated_image",
    prompt,
    provider: "ai-gateway",
    model,
    mimeType,
    localPath: storedAsset.localPath,
    publicUrl: storedAsset.publicUrl,
  });
}

async function storeGeneratedImage(input: {
  assetPath: string;
  imageBuffer: Buffer;
  mimeType: string;
}) {
  if (!getEnv().BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "Vercel Blob is not configured. Add BLOB_READ_WRITE_TOKEN; local image fallback is disabled.",
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= BLOB_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      const blob = await put(input.assetPath, input.imageBuffer, {
        access: "public",
        contentType: input.mimeType,
        addRandomSuffix: false,
      });

      return {
        localPath: "",
        publicUrl: blob.url,
      };
    } catch (error) {
      lastError = error;
      if (attempt < BLOB_UPLOAD_ATTEMPTS) {
        await sleep(500);
      }
    }
  }

  throw new Error(
    `Unable to store generated image in Vercel Blob after ${BLOB_UPLOAD_ATTEMPTS} attempts: ${errorMessage(lastError)}`,
  );
}

function imagePrompt(input: {
  draft: ArticleDraft;
  visual: VisualPlanItem;
  brandProfile: BrandProfile;
}) {
  return [
    "Create a polished editorial image for a Shopify app blog article.",
    "The image must clarify the article for this specific merchant audience rather than feel decorative.",
    "Use the Brand Profile and article topic to make the image market-specific and cohesive with the guide.",
    "Avoid fake product UI, fake metrics, brand logos, unsupported claims, screenshots, and generic ecommerce stock-photo styling.",
    "Do not create tables, checklists, worksheets, spreadsheets, scorecards, comparison grids, dense diagrams, or text-heavy graphics.",
    "Use no text unless 2-4 very short labels are essential; labels must be large and legible on mobile.",
    "Prefer a clean editorial style suitable for a founder-published Shopify app guide.",
    "",
    `Article title: ${input.draft.metadata.title}`,
    `Target merchant: ${input.brandProfile.targetMerchant}`,
    `App positioning: ${input.brandProfile.positioning}`,
    "Brand voice contract:",
    formatBrandVoiceForPrompt(input.brandProfile),
    formatVisualStrategy(input.brandProfile),
    "",
    `Visual title: ${input.visual.title}`,
    `Visual type: ${input.visual.visualType}`,
    `Visual structure: ${input.visual.visualStructure}`,
    `Text budget: ${input.visual.textBudget}`,
    `Placement: ${input.visual.placement}`,
    `Purpose: ${input.visual.purpose}`,
    `Alt text intent: ${input.visual.altText}`,
    "",
    "Generation instruction:",
    input.visual.instruction,
  ].join("\n");
}

function formatVisualStrategy(profile: BrandProfile) {
  return [
    `Preferred visuals: ${formatProfileList(profile.preferredVisuals) || "Use simple generated visuals that clarify the merchant workflow and fit the market."}`,
    `Avoid visuals: ${formatProfileList(profile.visualsToAvoid) || "Dense text inside images, fake UI, generic stock-photo style, and unsupported claims."}`,
  ].join("\n");
}

function formatProfileList(values: string[] | string | undefined) {
  if (typeof values === "string") return values.trim();

  return values?.join(", ") ?? "";
}

export function shouldGenerateImage(visual: VisualPlanItem) {
  return imageGenerationBlocker(visual) === "";
}

function failedAsset(input: {
  visual: VisualPlanItem;
  prompt: string;
  error: string;
}) {
  return visualAsset({
    visual: input.visual,
    status: "failed",
    assetType: "generated_image",
    prompt: input.prompt,
    error: input.error,
  });
}

function visualAsset(input: {
  visual: VisualPlanItem;
  status: VisualAsset["status"];
  assetType: VisualAsset["assetType"];
  prompt?: string;
  provider?: string;
  model?: string;
  mimeType?: string;
  localPath?: string;
  publicUrl?: string;
  error?: string;
}): VisualAsset {
  return {
    sourcePlaceholder: input.visual.markdownPlaceholder,
    title: input.visual.title,
    visualType: input.visual.visualType,
    status: input.status,
    assetType: input.assetType,
    altText: input.visual.altText,
    caption: input.visual.purpose,
    prompt: input.prompt ?? "",
    provider: input.provider ?? "",
    model: input.model ?? "",
    mimeType: input.mimeType ?? "",
    localPath: input.localPath ?? "",
    publicUrl: input.publicUrl ?? "",
    error: input.error ?? "",
    createdAt: new Date().toISOString(),
  };
}

export function imageGenerationSkipReason(visual: VisualPlanItem, fallbackReason?: string) {
  if (fallbackReason) return fallbackReason;
  const blocker = imageGenerationBlocker(visual);
  if (blocker) return blocker;

  return "Visual is not eligible for AI image generation.";
}

function imageGenerationBlocker(visual: VisualPlanItem) {
  if (visual.renderMode !== "generated_image") {
    return `Visual renderMode is ${visual.renderMode}, so it is not sent to the image generator.`;
  }

  if (visual.visualType !== "hero" && visual.visualType !== "diagram") {
    return "Only simple hero or diagram visuals are eligible for AI image generation in the current MVP.";
  }

  if (visual.textBudget === "text_heavy") {
    return "Visual is marked text_heavy, so it belongs in accessible Markdown instead of a generated image.";
  }

  if (
    visual.visualStructure === "table" ||
    visual.visualStructure === "checklist" ||
    visual.visualStructure === "ui_capture" ||
    visual.visualStructure === "comparison_matrix"
  ) {
    return `Visual structure ${visual.visualStructure} belongs in Markdown or a real screenshot, not generated imagery.`;
  }

  if (isHardMarkdownVisual(visual)) {
    return "Visual concept is a worksheet, scorecard, table, screenshot, or comparison matrix that belongs in Markdown.";
  }

  return "";
}

function isHardMarkdownVisual(visual: VisualPlanItem) {
  const conceptText = [
    visual.title,
    visual.purpose,
    visual.altText,
  ].join("\n");
  const instructionText = removeNegativeVisualRules(visual.instruction);
  const text = [conceptText, instructionText].join("\n");

  return [
    /\b(checklist|scorecard|worksheet|spreadsheet|comparison table|comparison matrix|scoring table|data table)\b/i,
    /\b(scoring|score|criteria|evaluation|comparison)\s+grid\b/i,
    /\b(scoring columns?|score key|notes column)\b/i,
    /\b(scoring|scorecard|table|spreadsheet|worksheet)\s+(rows?|columns?|cells?)\b/i,
    /\b(4 to 6|5 numbered|2-3 short|criteria|test prompts)\b/i,
    /\b(screenshot|manual capture|admin UI)\b/i,
  ].some((pattern) => pattern.test(text));
}

function removeNegativeVisualRules(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !isNegativeVisualRule(sentence))
    .join(" ");
}

function isNegativeVisualRule(value: string) {
  return [
    /\b(avoid|do not|don't|no|without|never)\b.*\b(checklists?|scorecards?|worksheets?|spreadsheets?|tables?|matrices|grids?|comparison grids?|screenshots?|manual capture|admin ui|dense text|tiny labels|small labels)\b/i,
    /\b(checklists?|scorecards?|worksheets?|spreadsheets?|tables?|matrices|grids?|comparison grids?|screenshots?|manual capture|admin ui|dense text|tiny labels|small labels)\b.*\b(should not|must not|are not|is not|instead of generated images)\b/i,
  ].some((pattern) => pattern.test(value));
}

function extensionForMediaType(mediaType: string) {
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/webp") return "webp";

  return "png";
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "visual";
}

function hash(value: string) {
  let output = 0;

  for (let index = 0; index < value.length; index += 1) {
    output = (output * 31 + value.charCodeAt(index)) >>> 0;
  }

  return output.toString(16);
}

function isImageGenerationConfigured() {
  const { AI_GATEWAY_API_KEY } = getEnv();

  return Boolean(AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
