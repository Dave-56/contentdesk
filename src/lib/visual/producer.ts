import { generateText, Output } from "ai";
import { aiVisualPlanItemSchema } from "@/lib/ai-schemas";
import { getEnv } from "@/lib/env";
import {
  visualPlanSchema,
  type ArticleDraft,
  type BrandProfile,
  type QAReport,
  type ResearchSource,
  type VisualAsset,
  type VisualPlan,
  type VisualPlanItem,
} from "@/lib/schemas";

export type VisualProducerResult = {
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  usedFallback: boolean;
};

export async function generateVisualPlan(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  revisionInstructions?: string[];
  previousLeadVisual?: VisualPlanItem;
  previousVisualPlan?: VisualPlan;
  qaReport?: QAReport;
}): Promise<VisualProducerResult> {
  if (!isAiGatewayConfigured()) {
    return fallbackVisualProducerResult(input);
  }

  try {
    const visualItems = await generateAiVisualPlan(input);

    return {
      ...constrainVisualProducerResult(visualItems, input),
      usedFallback: false,
    };
  } catch (error) {
    console.warn("[visual producer fallback]", errorMessage(error));

    return fallbackVisualProducerResult(input);
  }
}

async function generateAiVisualPlan(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  revisionInstructions?: string[];
  previousLeadVisual?: VisualPlanItem;
  previousVisualPlan?: VisualPlan;
  qaReport?: QAReport;
}) {
  const { CONTENTDESK_AI_MODEL } = getEnv();
  const model = CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";

  const { output } = await generateText({
    model,
    output: Output.array({
      element: aiVisualPlanItemSchema,
    }),
    prompt: visualProducerPrompt(input),
  });

  return output;
}

function visualProducerPrompt(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  revisionInstructions?: string[];
  previousLeadVisual?: VisualPlanItem;
  previousVisualPlan?: VisualPlan;
  qaReport?: QAReport;
}) {
  const headings = markdownHeadings(input.draft.markdown);
  const isRevision = Boolean(input.previousVisualPlan);

  return [
    "You are ContentDesk's Visual Producer for Shopify app article kits.",
    isRevision
      ? "Revise the previous lead visual and VisualPlan using the QA instructions. Return 1 lead VisualPlanItem followed by 1 or 2 inline VisualPlanItem objects."
      : "Return 1 lead VisualPlanItem followed by 1 or 2 inline VisualPlanItem objects.",
    "Your job is visual editorial strategy only. Do not generate images.",
    "Recommend only visuals that are worth publishing for this specific Brand Profile, market, article, and Shopify merchant audience.",
    "Start from the app, target merchant, positioning, and article thesis. The image should feel like it belongs to this guide, not like generic ecommerce art.",
    "The first returned item is the required leadVisual. It must be an outcome visual, not a workflow diagram.",
    "The leadVisual should make a Shopify fashion merchant feel: this could make my store look more premium and sell more products.",
    "For the leadVisual, prefer an AI-generated fashion campaign scene, product-on-model studio shot, before/after merchandising upgrade, seasonal collection shoot concept, or Shopify merchant product photography scenario.",
    "Set the leadVisual to visualType hero, renderMode generated_image, textBudget none, and visualStructure editorial_scene.",
    "Do not use workflow diagrams, process maps, tables, scorecards, screenshots, fake UI, or SaaS/ecommerce stock-photo scenes as the leadVisual.",
    "Allowed visualType values for this MVP: hero or diagram only.",
    "Use hero for the lead outcome image or a simple editorial scene. Use diagram only for lower article 2-4 step/process visuals with almost no text.",
    "Do not propose screenshots, checklists, scorecards, worksheets, spreadsheets, comparison tables, dense diagrams, social graphics, or manual asset ideas.",
    "If the article would benefit from a checklist, table, scoring framework, or comparison matrix, leave that as article Markdown rather than a VisualPlanItem.",
    "Set renderMode to generated_image only when the visual should be sent to the image model. Use markdown_block, screenshot, or none only when the concept should not be image-generated.",
    "Set textBudget to none, short_labels, or text_heavy. Generated images should use none or short_labels only.",
    "Set visualStructure to editorial_scene, workflow_diagram, table, checklist, ui_capture, or comparison_matrix. Generated images should normally be editorial_scene or workflow_diagram.",
    "Avoid generic AI stock images, decorative art, vague ecommerce scenes, fake UI, fake metrics, brand logos, and visuals that do not explain the article.",
    "Keep titles, alt text, and placeholders reader-safe. Put publishing or image-generation directions only in the instruction field.",
    "The placement field must copy one available Markdown H2 heading exactly when possible.",
    "For the leadVisual placement, use LEAD_VISUAL_TOP.",
    "The instruction field should be a concise image-generation prompt: subject, composition, audience context, mood, and any 2-4 short labels if truly needed.",
    "The instruction must explicitly avoid tables, worksheet layouts, dense text, and small labels.",
    "The markdownPlaceholder field should be a short bracketed placeholder, for example: [Visual placeholder: checkout friction map].",
    "",
    "Brand Profile:",
    JSON.stringify(input.brandProfile, null, 2),
    "",
    "Brand visual strategy:",
    formatVisualStrategy(input.brandProfile),
    "",
    "Available H2 placements:",
    headings.length ? headings.map((heading) => `- ${heading}`).join("\n") : "- None",
    "",
    "Article metadata:",
    JSON.stringify(input.draft.metadata, null, 2),
    "",
    "Article outline:",
    JSON.stringify(input.draft.outline, null, 2),
    "",
    "Article Markdown:",
    input.draft.markdown.slice(0, 7000),
    "",
    isRevision
      ? [
          "Revision instructions:",
          (input.revisionInstructions ?? []).map((item) => `- ${item}`).join("\n") || "- None",
          "",
          "Previous QA report:",
          JSON.stringify(input.qaReport ?? null, null, 2),
          "",
          "Previous leadVisual:",
          JSON.stringify(input.previousLeadVisual ?? null, null, 2),
          "",
          "Previous VisualPlan:",
          JSON.stringify(input.previousVisualPlan, null, 2),
          "",
        ].join("\n")
      : "",
    "",
    "Research sources:",
    input.sources.map(formatSourceForPrompt).join("\n\n"),
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

function formatSourceForPrompt(source: ResearchSource, index: number) {
  const content = source.extractedMarkdown || source.excerpt;

  return [
    `Source ${index + 1}`,
    `URL: ${source.url}`,
    `Title: ${source.title || "Untitled"}`,
    `Excerpt: ${content.slice(0, 1200)}`,
  ].join("\n");
}

function constrainVisualProducerResult(
  items: VisualPlanItem[],
  input: {
    draft: ArticleDraft;
    brandProfile: BrandProfile;
    sources: ResearchSource[];
    revisionInstructions?: string[];
    previousLeadVisual?: VisualPlanItem;
    previousVisualPlan?: VisualPlan;
    qaReport?: QAReport;
  },
): Pick<VisualProducerResult, "leadVisual" | "visualPlan"> {
  const fallback = fallbackVisualProducerResult(input);
  const leadCandidate = items.find(isLeadVisualCandidate) ?? items[0] ?? fallback.leadVisual;
  const leadVisual = normalizeLeadVisual(leadCandidate, input);
  const inlineVisuals = items
    .filter((item) => item !== leadCandidate && !isLeadVisualCandidate(item))
    .filter((item) => item.title.trim() && item.placement.trim())
    .filter((item) => item.visualType === "hero" || item.visualType === "diagram")
    .slice(0, 2)
    .map((item) => ({
      ...item,
      markdownPlaceholder: normalizePlaceholder(item.markdownPlaceholder, item.title),
    }));

  return {
    leadVisual,
    visualPlan: visualPlanSchema.parse(
      inlineVisuals.length > 0 ? inlineVisuals : fallback.visualPlan,
    ),
  };
}

function fallbackVisualProducerResult(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  revisionInstructions?: string[];
  previousLeadVisual?: VisualPlanItem;
  previousVisualPlan?: VisualPlan;
  qaReport?: QAReport;
}): VisualProducerResult {
  if (input.previousVisualPlan) {
    return {
      leadVisual: normalizeLeadVisual(
        input.previousLeadVisual ?? leadVisualFromDraft(input),
        input,
      ),
      visualPlan: visualPlanSchema.parse(
        input.previousVisualPlan.map((visual, index) =>
          withPlaceholder({
            ...visual,
            instruction: [
              visual.instruction,
              input.revisionInstructions?.[index] ?? input.revisionInstructions?.[0] ?? "",
            ]
              .filter(Boolean)
              .join(" "),
          }),
        ),
      ),
      usedFallback: true,
    };
  }

  return {
    leadVisual: leadVisualFromDraft(input),
    visualPlan: fallbackInlineVisualPlan(input),
    usedFallback: true,
  };
}

function fallbackInlineVisualPlan(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
}): VisualPlan {
  const headings = markdownHeadings(input.draft.markdown);
  const firstHeading =
    findHeading(headings, ["problem", "merchant"]) ??
    input.draft.outline[0]?.heading ??
    headings[0] ??
    input.draft.metadata.title;
  const appName = input.brandProfile.appName;
  const targetMerchant = input.brandProfile.targetMerchant;

  return visualPlanSchema.parse([
    withPlaceholder({
      title: `${appName} Shopify workflow moment`,
      placement: firstHeading,
      visualType: "diagram",
      purpose:
        "Show one simple Shopify-specific workflow moment behind the article so the reader can connect the advice to day-to-day store operations.",
      altText: `Simple diagram for ${targetMerchant} handling ${input.draft.topic.topic} in a Shopify workflow.`,
      renderMode: "generated_image",
      textBudget: "short_labels",
      visualStructure: "workflow_diagram",
      instruction: [
        "Create one clean editorial diagram for a Shopify app guide.",
        `Audience: ${targetMerchant}.`,
        `Article topic: ${input.draft.topic.topic}.`,
        `Brand context: ${appName} helps with ${input.brandProfile.positioning}.`,
        "Show only 2-4 simple stages with spacious layout and minimal labels.",
        "Do not use a table, checklist, worksheet, spreadsheet, screenshot, fake UI, dense text, or tiny labels.",
      ].join(" "),
      markdownPlaceholder: "",
    }),
  ]);
}

function leadVisualFromDraft(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
}): VisualPlanItem {
  const appName = input.brandProfile.appName;
  const targetMerchant = input.brandProfile.targetMerchant;

  return withPlaceholder({
    title: `${targetMerchant} premium ecommerce outcome`,
    placement: "LEAD_VISUAL_TOP",
    visualType: "hero",
    purpose:
      "Demonstrate the premium fashion ecommerce outcome the article is helping the merchant imagine before the body explains the workflow.",
    altText: `Premium fashion ecommerce product photography concept for ${targetMerchant} using ${appName}.`,
    renderMode: "generated_image",
    textBudget: "none",
    visualStructure: "editorial_scene",
    instruction: [
      "Create a polished lead image for a Shopify fashion ecommerce blog article.",
      `Audience: ${targetMerchant}.`,
      `Article topic: ${input.draft.topic.topic}.`,
      `Brand context: ${appName} helps with ${input.brandProfile.positioning}.`,
      "Show a merchant-ready fashion outcome: premium product-on-model studio photography, campaign-style generated shoot, seasonal collection concept, or before/after merchandising upgrade.",
      "Make the product visually clear, the garment believable, and the styling premium enough for an ecommerce brand guide.",
      "Avoid workflow diagrams, SaaS dashboards, generic ecommerce stock-photo styling, fake UI, brand logos, dense text, captions, tables, checklists, worksheets, screenshots, and unsupported claims.",
    ].join(" "),
    markdownPlaceholder: "[Visual placeholder: lead fashion outcome]",
  });
}

function isLeadVisualCandidate(item: VisualPlanItem) {
  return (
    item.placement === "LEAD_VISUAL_TOP" ||
    item.markdownPlaceholder.toLowerCase().includes("lead") ||
    item.title.toLowerCase().includes("lead")
  );
}

function normalizeLeadVisual(
  visual: VisualPlanItem,
  input: {
    draft: ArticleDraft;
    brandProfile: BrandProfile;
  },
): VisualPlanItem {
  return withPlaceholder({
    ...leadVisualFromDraft(input),
    ...visual,
    placement: "LEAD_VISUAL_TOP",
    visualType: "hero",
    renderMode: "generated_image",
    textBudget: "none",
    visualStructure: "editorial_scene",
    instruction: [
      visual.instruction,
      "Render this as the lead outcome image for the article: a premium, merchant-ready fashion ecommerce visual, not a workflow diagram or generic stock image.",
      "The garment must look believable, the product must be visually clear, and the styling should feel desirable to a Shopify fashion merchant.",
      "Do not include text, fake UI, tables, checklists, scorecards, worksheets, screenshots, brand logos, or SaaS dashboard imagery.",
    ].join(" "),
    markdownPlaceholder: normalizePlaceholder(
      visual.markdownPlaceholder || "[Visual placeholder: lead fashion outcome]",
      visual.title || "lead fashion outcome",
    ),
  });
}

function withPlaceholder(item: VisualPlanItem): VisualPlanItem {
  return {
    ...item,
    markdownPlaceholder: normalizePlaceholder(item.markdownPlaceholder, item.title),
  };
}

export function insertLeadVisualPlaceholder(
  markdown: string,
  leadVisual: VisualPlanItem,
  visualAssets: VisualAsset[] = [],
) {
  const generatedAsset = generatedAssetForVisual(leadVisual, visualAssets);
  if (visualBlockAlreadyInserted(markdown, leadVisual, generatedAsset)) return markdown;

  const lines = markdown.split("\n");
  const insertAt = leadVisualInsertionIndex(lines);
  lines.splice(insertAt, 0, "", formatVisualBlock(leadVisual, generatedAsset), "");

  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd();
}

function leadVisualInsertionIndex(lines: string[]) {
  const h1Index = lines.findIndex((line) => /^#\s+/.test(line));
  const firstH2Index = lines.findIndex((line) => /^##\s+/.test(line));

  if (h1Index === -1) return firstH2Index === -1 ? 0 : firstH2Index;

  let index = h1Index + 1;
  while (index < lines.length && lines[index].trim() === "") index += 1;
  while (index < lines.length && lines[index].trim() !== "" && !/^##\s+/.test(lines[index])) {
    index += 1;
  }

  return index;
}

export function insertVisualPlaceholders(
  markdown: string,
  visualPlan: VisualPlanItem[],
  visualAssets: VisualAsset[] = [],
) {
  if (visualPlan.length === 0) return markdown;

  const lines = markdown.split("\n");
  const unplaced: VisualPlanItem[] = [];

  for (const visual of visualPlan) {
    const generatedAsset = generatedAssetForVisual(visual, visualAssets);
    if (visualBlockAlreadyInserted(markdown, visual, generatedAsset)) continue;

    const headingIndex = findHeadingLineIndex(lines, visual.placement);
    if (headingIndex === -1) {
      unplaced.push(visual);
      continue;
    }

    lines.splice(
      headingIndex + 1,
      0,
      "",
      formatVisualBlock(visual, generatedAsset),
      "",
    );
  }

  if (unplaced.length > 0) {
    lines.push("", "## Visual notes", "");
    for (const visual of unplaced) {
      lines.push(
        formatVisualBlock(visual, generatedAssetForVisual(visual, visualAssets)),
        "",
      );
    }
  }

  return lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd();
}

function formatVisualBlock(
  visual: VisualPlanItem,
  generatedAsset: VisualAsset | undefined,
) {
  if (generatedAsset?.publicUrl) {
    return [
      `![${escapeMarkdownAltText(generatedAsset.altText)}](${generatedAsset.publicUrl})`,
      "",
      generatedAsset.caption ? `*${generatedAsset.caption}*` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `> **${visual.markdownPlaceholder}**`,
    `> Placement: ${visual.placement}`,
    `> Purpose: ${visual.purpose}`,
    `> Alt text: ${visual.altText}`,
    `> Instruction: ${visual.instruction}`,
  ]
    .map((line) => escapeBlockquoteLine(line))
    .join("\n");
}

function generatedAssetForVisual(
  visual: VisualPlanItem,
  visualAssets: VisualAsset[],
) {
  return visualAssets.find(
    (asset) =>
      asset.status === "generated" &&
      asset.publicUrl.trim() &&
      asset.sourcePlaceholder === visual.markdownPlaceholder,
  );
}

function visualBlockAlreadyInserted(
  markdown: string,
  visual: VisualPlanItem,
  generatedAsset: VisualAsset | undefined,
) {
  if (generatedAsset?.publicUrl && markdown.includes(generatedAsset.publicUrl)) {
    return true;
  }

  return markdown.includes(visual.markdownPlaceholder);
}

function markdownHeadings(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.match(/^##\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function findHeading(headings: string[], terms: string[]) {
  return headings.find((heading) =>
    terms.some((term) => normalizeHeading(heading).includes(term)),
  );
}

function findHeadingLineIndex(lines: string[], placement: string) {
  const normalizedPlacement = normalizeHeading(placement);

  return lines.findIndex((line) => {
    const heading = line.match(/^##\s+(.+?)\s*$/)?.[1];
    if (!heading) return false;

    return normalizeHeading(heading) === normalizedPlacement;
  });
}

function normalizeHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlaceholder(value: string, title: string) {
  const trimmed = value.trim();
  if (/^\[Visual placeholder: .+\]$/.test(trimmed)) return trimmed;

  return `[Visual placeholder: ${title.trim()}]`;
}

function escapeBlockquoteLine(line: string) {
  return line.replace(/\n/g, " ").replace(/\s+$/g, "");
}

function escapeMarkdownAltText(value: string) {
  return value.replace(/\]/g, "\\]").replace(/\n/g, " ");
}

function isAiGatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
