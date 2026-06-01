import type {
  ArticleDraft,
  PublishKit,
  QAReport,
  VisualAsset,
  VisualPlan,
  VisualPlanItem,
} from "@/lib/schemas";
import { insertLeadVisualPlaceholder, insertVisualPlaceholders } from "@/lib/visual/producer";

export function buildPublishKitFromArticleDraft(input: {
  draft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  qaReport: QAReport;
  visualAssets?: VisualAsset[];
}): PublishKit {
  const visualAssets = input.visualAssets ?? [];
  const markdownVisualAssets = visualAssets.map(sanitizeVisualAssetForMarkdown);
  const leadVisualAsset = visualAssetForVisual(input.leadVisual, visualAssets);
  const markdownWithLeadVisual = insertLeadVisualPlaceholder(
    input.draft.markdown,
    input.leadVisual,
    markdownVisualAssets,
  );
  const markdown = insertVisualPlaceholders(
    markdownWithLeadVisual,
    input.visualPlan,
    markdownVisualAssets,
  );

  return {
    topic: input.draft.topic,
    markdown,
    titleOptions: input.draft.titleOptions,
    metadata: input.draft.metadata,
    faq: input.draft.faq,
    cta: input.draft.cta,
    internalLinkSuggestions: input.draft.internalLinkSuggestions,
    leadVisual: input.leadVisual,
    leadVisualAsset,
    leadVisualReadiness: leadVisualReadiness(leadVisualAsset),
    visualPlan: input.visualPlan,
    visualAssets,
    qaSummary: input.qaReport.summary,
    blockers: input.qaReport.blockers,
    nonBlockingNotes: input.qaReport.niceToHaves,
    socialDrafts: input.draft.socialDrafts,
    sources: input.draft.sources,
    codexHandoffPrompt: codexHandoffPrompt({
      draft: input.draft,
      markdown,
      leadVisual: input.leadVisual,
      leadVisualAsset,
      visualPlan: input.visualPlan,
      visualAssets,
      qaReport: input.qaReport,
    }),
  };
}

function codexHandoffPrompt(input: {
  draft: ArticleDraft;
  markdown: string;
  leadVisual: VisualPlanItem;
  leadVisualAsset: VisualAsset | null;
  visualPlan: VisualPlan;
  visualAssets: VisualAsset[];
  qaReport: QAReport;
}) {
  const { draft } = input;
  const suggestedSlug = articleSlugFromTitle(draft.metadata.title);
  const cleanMarkdown = readerFacingMarkdownForHandoff(input.markdown);
  const publishDate = new Date().toISOString().slice(0, 10);
  const subtitle = suggestedSubtitle(draft);
  const subtitleFrontmatterLine = subtitle
    ? `subtitle: "${escapeYamlString(subtitle)}"\n`
    : "";
  const targetQueries = suggestedTargetQueries(draft);
  const internalLinks = draft.internalLinkSuggestions
    .map(formatInternalLinkSuggestion)
    .join("\n");
  const publishableAssets = publishableVisualAssets(input.visualAssets);
  const generatedAssets = publishableAssets
    .map((asset) => formatVisualAsset(asset))
    .join("\n\n");
  const imageAssetGuidance = generatedAssets
    ? generatedAssets
    : [
        "- None",
        "",
        "Required lead visual asset is missing. Treat this handoff as visually incomplete unless usable image assets are explicitly provided.",
      ].join("\n");
  const leadVisualStatus = input.leadVisualAsset?.status === "generated"
    ? "approved"
    : input.leadVisualAsset?.status === "failed"
      ? "failed"
      : "missing";
  const blockers = input.qaReport.blockers
    .map((issue) => `- ${issue.finding}: ${issue.instruction}`)
    .join("\n\n");
  const blockerSection = blockers
    ? `\nPre-publish blockers - do not publish until resolved:\n${blockers}\n`
    : "";

  return `Publish this approved ContentDesk article as a Tiny Lemon Markdown guide.

Tiny Lemon publishing contract:
- Use the existing lightweight Markdown guide system. Guide files live in content/blog/*.md and public pages render at /blog/<slug>.
- Use plain Markdown only. Do not create MDX, React components, custom routes, or a new content system.
- Use only these frontmatter fields: title, subtitle, slug, date, updated, category, targetQueries, excerpt. Omit subtitle if no clean complete subtitle is provided.
- Use the meta description as excerpt.
- The UI already labels this section as Guides, so do not create new navigation or section labels.

Slug quality pass:
- Suggested slug: ${suggestedSlug}
- If the suggested slug looks accidentally truncated, mechanically clipped, duplicated, awkward, or too vague, replace it with a clean readable hyphenated slug based on the final title.
- For comparison titles, prefer a natural comparison slug such as generic-ai-image-generator-vs-fashion-specific-shopify-app over a mechanically clipped title fragment.
- If you change the slug, update every matching reference: target Markdown file, frontmatter slug, image folder, and final Markdown image URLs.

Title clarity pass:
- Keep industry terms only when they are natural for the target reader and likely search language.
- Replace internal shorthand, acronyms, or operator jargon with clearer reader-facing language when it improves search clarity.
- If changing title wording, update the slug only when the current slug no longer matches the final title.

Frontmatter to start from:
\`\`\`yaml
title: "${escapeYamlString(draft.metadata.title)}"
${subtitleFrontmatterLine}slug: "${suggestedSlug}"
date: "${publishDate}"
updated: "${publishDate}"
category: "Shopify product photography"
targetQueries: "${escapeYamlString(targetQueries.join(", "))}"
excerpt: "${escapeYamlString(draft.metadata.metaDescription)}"
\`\`\`

Article cleanup rules:
- Remove any top-level H1 from the body. TinyLemon renders the frontmatter title as the page H1.
- Include the CTA naturally in the final section or final paragraph. Do not add a custom CTA block, React component, or promotional layout unless Tiny Lemon already supports it.
- If the final section already includes the CTA naturally, do not add a second CTA paragraph.
- If FAQ is provided, append it after the final takeaway under exactly: ## Frequently asked questions. Use each question as a ### heading and the answer as normal paragraph text.
- Prefer local Tiny Lemon links, such as [more Shopify fashion visual workflow guides](/blog). Use absolute production URLs only when there is a specific reason.
- Convert absolute Tiny Lemon blog URLs such as https://tinylemon.xyz/blog to local links like [more Shopify fashion visual workflow guides](/blog).
- Normalize heading hierarchy: if numbered subsections sit under a ## section, make them ### headings unless they are truly top-level sections.
- Do not publish ContentDesk QA notes, editor notes, visual placeholders, image generation notes, implementation notes, social drafts, title-option scaffolding, provider/model metadata, or visual follow-up instruction sections.

Source handling:
- Do not publish a final ## Sources, ## References, Further reading, or source list section.
- Treat source URLs as editorial inputs only, not reader-facing page content.
- Use clean inline citations only where a claim genuinely needs support.
- Convert raw Source: https://... lines into inline links where useful, then remove the raw Source: labels.
- Remove unused source URLs from the final Markdown.
- Avoid prominent links to direct or near competitors unless the article is explicitly a comparison guide.
- Prefer neutral or authoritative sources such as Shopify docs, Shopify theme pages, platform docs, primary data, or industry reports.

Target query cleanup:
- If targetQueries read like article positioning, a subtitle, internal editorial framing, or full sentences, rewrite them into comma-separated search queries a Shopify fashion merchant might type.
- Good shape: consistent on-model images Shopify, Shopify apparel catalog consistency, consistent product photos Shopify fashion, AI on-model photos Shopify, Shopify fashion product image workflow.
- Do not format targetQueries as a YAML array. Tiny Lemon expects one comma-separated string.

Image workflow:
- Download/copy each provided image asset into public/blog/<final-slug>/.
- Rewrite Markdown image URLs to /blog/<final-slug>/<image-file-name>.
- Preserve useful alt text.
- Treat Blob URLs, /generated/... paths, and generated/cycles/... paths as source asset locations only, not final Tiny Lemon Markdown URLs.
- Only keep captions that read naturally to a merchant audience. Rewrite or remove captions that sound like editor instructions, QA comments, visual-plan notes, image-generation prompts, or implementation guidance.
- If image assets are listed as None, do not create, regenerate, or chase missing visuals. Do not publish unresolved visual asset notes. Publish the article as text-only unless usable image assets are explicitly provided.
- The required lead visual should appear near the top of the article, before the main body sections. If lead visual status is missing or failed, mark the article as visually incomplete instead of silently treating it as fully publish-ready.

Before finishing, run npm run typecheck and npm run build if dependencies are available. Do not change unrelated files.

Article packet:
- Final title: ${draft.metadata.title}
- Subtitle: ${subtitle || "Omit unless you can write a clean complete subtitle."}
- Suggested slug: ${suggestedSlug}
- Final slug: use ${suggestedSlug} unless the slug quality pass improves it.
- Target file: content/blog/<final-slug>.md
- Frontmatter slug: <final-slug>
- Image folder: public/blog/<final-slug>/
- Final Markdown image URL prefix: /blog/<final-slug>/
- Date: ${publishDate}
- Updated: ${publishDate}
- Category: Shopify product photography
- Required lead visual status: ${leadVisualStatus}
- Required lead visual concept: ${input.leadVisual.title}
- Suggested targetQueries: ${targetQueries.join(", ")}
- Excerpt: ${draft.metadata.metaDescription}${blockerSection}

Reader-facing Markdown body:
${cleanMarkdown}

Image assets to copy into Tiny Lemon:
${imageAssetGuidance}

CTA to include:
${draft.cta}

FAQ:
${draft.faq.map((item) => `- Q: ${item.question}\n  A: ${item.answer}`).join("\n")}

Internal link suggestions:
${internalLinks || "- None"}

Editorial source inputs - do not publish as a source list:
${draft.sources.map((source) => `- ${source}`).join("\n")}`;
}

function publishableVisualAssets(visualAssets: VisualAsset[]) {
  return visualAssets.filter(
    (asset) => asset.status === "generated" && asset.publicUrl.trim(),
  );
}

function visualAssetForVisual(visual: VisualPlanItem, visualAssets: VisualAsset[]) {
  return visualAssets.find(
    (asset) =>
      asset.sourcePlaceholder === visual.markdownPlaceholder &&
      asset.status === "generated" &&
      asset.publicUrl.trim(),
  ) ?? visualAssets.find((asset) => asset.sourcePlaceholder === visual.markdownPlaceholder) ?? null;
}

function leadVisualReadiness(asset: VisualAsset | null) {
  if (asset?.status === "generated" && asset.publicUrl.trim()) return "approved";
  if (asset?.status === "failed") return "failed";

  return "missing";
}

function formatVisualAsset(asset: VisualAsset) {
  const fileName = fileNameForVisualAsset(asset);
  const caption = publicCaption(asset);

  return [
    `- ${asset.title}`,
    `  Source URL: ${asset.publicUrl}`,
    `  Suggested filename: ${fileName}`,
    `  Final Markdown URL: /blog/<final-slug>/${fileName}`,
    `  Alt text: ${asset.altText}`,
    `  Caption guidance: ${caption}`,
  ].join("\n");
}

function formatInternalLinkSuggestion(
  link: ArticleDraft["internalLinkSuggestions"][number],
) {
  const targetUrl = localTinyLemonPath(link.targetUrl);

  return `- ${link.anchorText}: ${targetUrl} (${link.reason})`;
}

function localTinyLemonPath(url: string) {
  try {
    const parsed = new URL(url);
    if (/^(www\.)?tinylemon\.xyz$/i.test(parsed.hostname)) {
      return `${parsed.pathname || "/"}${parsed.search}${parsed.hash}`;
    }
  } catch {
    return url;
  }

  return url;
}

function fileNameForVisualAsset(asset: VisualAsset) {
  const extension = extensionForMimeType(asset.mimeType) || extensionFromUrl(asset.publicUrl) || "png";

  return `${slugForPathSegment(asset.title, 64)}.${extension}`;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";

  return "";
}

function extensionFromUrl(url: string) {
  const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);

  return match?.[1]?.toLowerCase() || "";
}

function articleSlugFromTitle(value: string) {
  return slugForPathSegment(value, 72);
}

function slugForPathSegment(value: string, maxLength: number) {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean);

  const selected: string[] = [];
  for (const word of words) {
    const candidate = [...selected, word].join("-");
    if (candidate.length > maxLength && selected.length > 0) break;
    selected.push(word);
  }

  const slug = selected.join("-").replace(/^-+|-+$/g, "");

  return slug || "article";
}

function suggestedTargetQueries(draft: ArticleDraft) {
  const queries = uniqueStrings(draft.metadata.targetQueries.map(cleanTargetQuery))
    .filter(isSearchQueryLike)
    .slice(0, 5);

  return queries.length > 0 ? queries : ["shopify fashion product photography"];
}

function cleanTargetQuery(value: string) {
  return value
    .replace(/[?:!]+/g, "")
    .replace(/\b(how to|how|guide to|a guide to|the guide to|target query|target queries)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSearchQueryLike(value: string) {
  if (!value) return false;
  if (value.length < 6) return false;
  if (value.split(/\s+/).length > 9) return false;

  return !/(commercial investigation|informational|transactional|navigational|internal framing|content gap|merchant pain|why now|practical guide)$/i.test(value);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }

  return output;
}

function publicCaption(asset: VisualAsset) {
  const caption = asset.caption.trim();
  if (!caption) return "Optional. Add only if a concise reader-facing caption improves the guide.";

  if (soundsLikeEditorInstruction(caption)) {
    return [
      "Remove this instruction-like caption or rewrite it as:",
      readerFacingCaptionSuggestion(asset),
    ].join(" ");
  }

  return caption;
}

function sanitizeVisualAssetForMarkdown(asset: VisualAsset): VisualAsset {
  if (asset.status !== "generated") return asset;
  if (!asset.caption.trim()) return asset;

  return {
    ...asset,
    caption: soundsLikeEditorInstruction(asset.caption)
      ? readerFacingCaptionSuggestion(asset)
      : asset.caption,
  };
}

function soundsLikeEditorInstruction(caption: string) {
  return [
    /^(replace|add|keep|align|remove|revise|update|change|make|show|use|clarify|explain|illustrate|describe)\b/i,
    /\b(previous visual|content team|image generator|visual plan|qa|implementation guidance)\b/i,
    /\b(make the problem concrete|core distinction|use this image to|align this visual with|show founders|add a concrete visual|keep the useful scorecard)\b/i,
  ].some((pattern) => pattern.test(caption.trim()));
}

function readerFacingCaptionSuggestion(asset: VisualAsset) {
  const subject = asset.altText || asset.title;
  const normalized = subject
    .replace(/\.$/, "")
    .replace(/^image of\s+/i, "")
    .trim();

  return normalized
    ? `A practical view of ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}.`
    : "A practical visual reference for the Shopify workflow described in this guide.";
}

function suggestedSubtitle(draft: ArticleDraft) {
  const candidates = [
    draft.topic.targetMerchantPain,
    draft.metadata.metaDescription,
    draft.topic.shopifySpecificAngle,
  ];

  for (const candidate of candidates) {
    const subtitle = cleanCompleteSubtitle(candidate);
    if (subtitle && isReaderFacingSubtitle(subtitle)) return subtitle;
  }

  return "";
}

function isReaderFacingSubtitle(value: string) {
  if (value.split(/\s+/).length < 5) return false;

  return !soundsLikeEditorialInstruction(value);
}

function soundsLikeEditorialInstruction(value: string) {
  const normalized = value.trim();

  return [
    /^(add|align|avoid|clarify|connect|describe|emphasize|explain|focus|frame|highlight|illustrate|include|make|position|remove|replace|rewrite|show|tie|turn|update|use)\b/i,
    /\b(article|brief|content|draft|editorial|framing|headline|reader-facing|section|subtitle|title)\b.*\b(should|needs?|must|direction|angle|positioning|strategy)\b/i,
    /\b(internal editorial|editorial instruction|content strategy|positioning note|writing instruction)\b/i,
  ].some((pattern) => pattern.test(normalized));
}

function cleanCompleteSubtitle(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= 150) return stripTrailingEllipsis(normalized);

  const firstSentence = normalized.match(/^(.+?[.!?])\s/)?.[1]?.trim();
  if (firstSentence && firstSentence.length <= 150) {
    return stripTrailingEllipsis(firstSentence);
  }

  return "";
}

function stripTrailingEllipsis(value: string) {
  return value.replace(/\.{3,}$/, "").trim();
}

function readerFacingMarkdownForHandoff(markdown: string) {
  const withoutVisualBlocks = removeVisualInstructionBlocks(markdown);
  const withoutVisualNotes = removeVisualNotesSection(withoutVisualBlocks);

  return removeTopLevelH1s(withoutVisualNotes).trim();
}

function removeVisualInstructionBlocks(markdown: string) {
  const lines = markdown.split("\n");
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^>\s+\*\*\[Visual placeholder:/i.test(line)) {
      while (index + 1 < lines.length && /^>/.test(lines[index + 1])) {
        index += 1;
      }
      continue;
    }

    output.push(line);
  }

  return output.join("\n").replace(/\n{4,}/g, "\n\n\n");
}

function removeVisualNotesSection(markdown: string) {
  const lines = markdown.split("\n");
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (/^##\s+Visual notes\s*$/i.test(lines[index])) {
      while (index + 1 < lines.length && !/^##\s+/.test(lines[index + 1])) {
        index += 1;
      }
      continue;
    }

    output.push(lines[index]);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n");
}

function removeTopLevelH1s(markdown: string) {
  return markdown
    .split("\n")
    .filter((line) => !/^#(?!#)\s+/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function escapeYamlString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
