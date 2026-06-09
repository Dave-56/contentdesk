import { generateText, Output } from "ai";
import { aiQaReportSchema, type AiQaReport } from "@/lib/ai-schemas";
import { getEnv } from "@/lib/env";
import {
  qaReportSchema,
  type ArticleDraft,
  type BrandProfile,
  type QaBlockerIssue,
  type QaNiceToHaveIssue,
  type QAReport,
  type ResearchSource,
  type RevisionTaskResult,
  type VisualPlan,
  type VisualPlanItem,
} from "@/lib/schemas";

export type SeoQaResult = {
  qaReport: QAReport;
  usedFallback: boolean;
};

type QaIssueDraft = Omit<QaBlockerIssue, "severity">;

export async function generateQaReport(input: {
  draft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  previousQaReport?: QAReport;
  revisionTaskResults?: RevisionTaskResult[];
}): Promise<SeoQaResult> {
  if (!isAiGatewayConfigured()) {
    return {
      qaReport: deterministicQaReport(input),
      usedFallback: true,
    };
  }

  try {
    const qaReport = await generateAiQaReport(input);

    return {
      qaReport,
      usedFallback: false,
    };
  } catch (error) {
    console.warn("[seo qa fallback]", errorMessage(error));

    return {
      qaReport: deterministicQaReport(input),
      usedFallback: true,
    };
  }
}

export function qaPassed(report: QAReport) {
  return report.status === "pass" && report.blockers.length === 0;
}

export function qaRevisionInstructions(report: QAReport) {
  return [
    ...report.revisionInstructions.writer,
    ...report.blockers
      .filter((issue) => issue.area !== "visual_plan")
      .map((issue) => issue.instruction),
  ];
}

export function visualRevisionInstructions(report: QAReport) {
  return [
    ...report.revisionInstructions.visualProducer,
    ...report.blockers
      .filter((issue) => issue.area === "visual_plan")
      .map((issue) => issue.instruction),
  ];
}

async function generateAiQaReport(input: {
  draft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  previousQaReport?: QAReport;
  revisionTaskResults?: RevisionTaskResult[];
}) {
  const { CONTENTDESK_AI_MODEL } = getEnv();
  const model = CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";

  const { output } = await generateText({
    model,
    output: Output.object({
      schema: aiQaReportSchema,
    }),
    prompt: qaPrompt(input),
  });

    return normalizeAiQaReport(output, input);
}

function qaPrompt(input: {
  draft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  previousQaReport?: QAReport;
  revisionTaskResults?: RevisionTaskResult[];
}) {
  const allowedSourceUrls = input.sources.map((source) => source.url);
  const headings = markdownH2s(input.draft.markdown);
  const isRevisionVerification = Boolean(input.previousQaReport);

  return [
    "You are ContentDesk's Editor / SEO QA agent for Shopify app founders.",
    isRevisionVerification
      ? "You are doing a revision verification pass after one targeted revision."
      : "You are doing the initial full QA gate before a PublishKit is created.",
    "Review the ArticleDraft public approval preview, required leadVisual, and VisualPlan together.",
    "Return one structured QA report. Blockers must be issues that should stop founder approval.",
    "Nice-to-haves must be useful polish notes that do not block publishing.",
    "Use a 0 to 5 scale for every rubric score.",
    "Do not pass the report if blockers are present.",
    "Do not invent source URLs, brand facts, or claims.",
    "Treat the supplied ResearchSource excerpts as the source of truth. If an excerpt explicitly lists a feature, do not flag that feature as unsupported.",
    "Treat visible publishing scaffolding in the public approval preview as approval-blocking, including ContentDesk QA notes, editor notes, visual placeholders, image-generation notes, implementation notes, social drafts, title-option scaffolding, and provider/model metadata.",
    "Do not treat internal ArticleDraft schema fields as visible scaffolding. Fields such as topic, outline, titleOptions, faq, cta, internalLinkSuggestions, socialDrafts, sources, and sourceNotes are internal/supporting workspace data unless their labels or planning text appear in the public approval preview.",
    "The final title is locked by Metadata title plus the article H1. Internal titleOptions are not founder-facing and should not block approval by themselves.",
    "Writer revision instructions should cover article, source, metadata, and brand-positioning blockers.",
    "Visual Producer revision instructions should only cover visual_plan blockers.",
    "Direct Answer Opening QA: after the H1, the first body paragraph should directly answer the topic in 2-4 useful sentences before background context or scene-setting.",
    "Thinking Gap QA: judge whether the article resolves the reader's decision, doubt, comparison, workflow, or next step. Do not pass shallow keyword coverage that fails to help the reader think or act.",
    "Check that the article resolves the approved TopicBrief merchantJob, carries the messageAngle, and supports the proofAngle using only approved sources and current inputs.",
    "If TopicBrief brandInclusion.required is true, the article must name the brand in the body, include a clear customer fit/tradeoff section, and name the brand in the CTA when ctaRequired is true.",
    "A thinking-gap blocker is appropriate when the draft technically covers the topic but does not help the reader choose, compare, resolve objections, understand tradeoffs, or take a practical next step.",
    "For comparison topics, check whether the article gives honest decision criteria and tradeoffs. For workflow topics, check whether it shows what to do next. For education topics, check whether it answers the next logical question beyond a definition.",
    isRevisionVerification
      ? [
          "",
          "Revision verification rules:",
          "- Do not perform a brand-new full QA review.",
          "- Verify whether the previous QA blockers are resolved in the revised draft, revised leadVisual, and revised VisualPlan.",
          "- A blocker in this pass should normally map to an unresolved previous blocker.",
          "- Do not introduce newly discovered blockers that were likely present in the original draft but missed by the initial QA pass.",
          "- You may add a new blocker only for a severe regression clearly introduced by the revision, such as broken Markdown, a new unsupported claim, or a new direct conflict with the Brand Profile.",
          "- If you notice non-severe issues outside the previous blockers, put them in niceToHaves instead of blockers.",
        ].join("\n")
      : [
          "",
          "Initial QA rules:",
          "- Be exhaustive now. This is the main quality gate.",
          "- Surface all approval-blocking issues in this first report; do not save objections for a later pass.",
          "- Check claim support, source notes, metadata, outline/body consistency, CTA, brand positioning, leadVisual fit, and VisualPlan fit in one read.",
          "- If an issue would stop founder approval after revision, it should be a blocker now.",
        ].join("\n"),
    "",
    "Rubric keys:",
    "- shopifySpecificity",
    "- merchantPain",
    "- actionability",
    "- claimSupport",
    "- genericFillerAvoidance",
    "- thinkingGapResolution",
    "- appPositioning",
    "- founderPublishConfidence",
    "- visualUsefulness",
    "",
    "Allowed source URLs:",
    allowedSourceUrls.map((url) => `- ${url}`).join("\n"),
    "",
    "Allowed internal links:",
    input.brandProfile.existingBlogDocsUrls.map((url) => `- ${url}`).join("\n") || "- None",
    "",
    "Available H2 headings:",
    headings.map((heading) => `- ${heading}`).join("\n") || "- None",
    "",
    "Brand Profile:",
    JSON.stringify(input.brandProfile, null, 2),
    "",
    "ArticleDraft QA packet:",
    formatArticleDraftForQa(input.draft),
    "",
    isRevisionVerification
      ? [
          "Previous QA report to verify against:",
          JSON.stringify(input.previousQaReport, null, 2),
          "",
          "Writer revision task results:",
          JSON.stringify(input.revisionTaskResults ?? [], null, 2),
          "",
        ].join("\n")
      : "",
    "",
    "Required leadVisual:",
    JSON.stringify(input.leadVisual, null, 2),
    "",
    "VisualPlan:",
    JSON.stringify(input.visualPlan, null, 2),
    "",
    "Research sources:",
    input.sources.map(formatSourceForPrompt).join("\n\n"),
  ].join("\n");
}

export function formatArticleDraftForQa(draft: ArticleDraft) {
  return [
    "Public approval preview:",
    "This is the founder/Tiny Lemon-visible article surface. Apply scaffolding blockers to this section.",
    "",
    "Metadata:",
    JSON.stringify(draft.metadata, null, 2),
    "",
    "Markdown body:",
    draft.markdown,
    "",
    "Supporting handoff components:",
    "These are structured components for the publish kit/handoff. They are not article-body scaffolding unless their labels appear inside the Markdown body.",
    "",
    "CTA to include:",
    draft.cta,
    "",
    "FAQ:",
    draft.faq
      .map((item) => `- Q: ${item.question}\n  A: ${item.answer}`)
      .join("\n") || "- None",
    "",
    "Internal link suggestions:",
    draft.internalLinkSuggestions
      .map((link) => `- ${link.anchorText}: ${link.targetUrl} (${link.reason})`)
      .join("\n") || "- None",
    "",
    "Internal validation data:",
    "Use this only to check source hygiene, outline/body alignment, and support notes. Do not treat these field names as founder-facing copy.",
    "",
    "Source URLs:",
    draft.sources.map((source) => `- ${source}`).join("\n") || "- None",
    "",
    "Source notes:",
    draft.sourceNotes || "- None",
    "",
    "Outline:",
    JSON.stringify(draft.outline, null, 2),
  ].join("\n");
}

function deterministicQaReport(input: {
  draft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
}) {
  const blockers: QaBlockerIssue[] = [];
  const niceToHaves: QaNiceToHaveIssue[] = [];
  const allowedSourceUrls = new Set(input.sources.map((source) => source.url));
  const allowedInternalUrls = new Set(input.brandProfile.existingBlogDocsUrls);
  const markdown = input.draft.markdown;
  const searchableText = [
    input.draft.markdown,
    input.draft.metadata.title,
    input.draft.metadata.metaDescription,
    input.draft.cta,
  ].join("\n");
  const h1Count = markdown.split("\n").filter((line) => /^#\s+/.test(line)).length;
  const h2s = markdownH2s(markdown);
  const invalidSources = unique([
    ...input.draft.sources,
    ...input.draft.outline.flatMap((item) => item.sourceLinks),
  ].filter((url) => !allowedSourceUrls.has(url)));
  const invalidInternalLinks = input.draft.internalLinkSuggestions.filter(
    (link) => !allowedInternalUrls.has(link.targetUrl),
  );
  const forbiddenClaims = input.brandProfile.forbiddenClaims.filter((claim) =>
    containsText(searchableText, claim),
  );
  const visualPlacementMisses = input.visualPlan.filter(
    (visual) => !h2s.some((heading) => normalizeHeading(heading) === normalizeHeading(visual.placement)),
  );
  const placeholders = [input.leadVisual, ...input.visualPlan].map((visual) => visual.markdownPlaceholder);
  const duplicatePlaceholders = duplicates(placeholders);
  const invalidPlaceholders = placeholders.filter(
    (placeholder) => !/^\[Visual placeholder: .+\]$/.test(placeholder),
  );
  const leadVisualInstructions = [
    input.leadVisual.title,
    input.leadVisual.purpose,
    input.leadVisual.altText,
  ].join("\n");
  const shopifyScore = shopifySpecificityScore(searchableText);
  const appMentions = countOccurrences(searchableText, input.brandProfile.appName);
  const genericFillerScore = genericFillerAvoidanceScore(markdown);
  const actionability = actionabilityScore(markdown);
  const thinkingGapScore = thinkingGapResolutionScore(markdown, input.draft.topic.strategyType);
  const directAnswerOpeningIssue = directAnswerOpeningBlocker(markdown);
  const editorialScaffolding = findEditorialScaffolding(markdown);
  const hasAppPositioning =
    containsText(searchableText, input.brandProfile.appName) ||
    containsText(searchableText, input.brandProfile.positioning);

  if (invalidSources.length > 0) {
    blockers.push(blocker({
      area: "sources",
      finding: "Draft references source URLs outside the normalized research source set.",
      evidence: invalidSources.slice(0, 3).join(", "),
      instruction: "Remove unsupported source URLs or replace them with URLs from the ResearchSource artifact.",
    }));
  }

  if (invalidInternalLinks.length > 0) {
    blockers.push(blocker({
      area: "sources",
      finding: "Draft includes internal links outside the Brand Profile existing blog/docs URLs.",
      evidence: invalidInternalLinks.map((link) => link.targetUrl).slice(0, 3).join(", "),
      instruction: "Keep internal link suggestions limited to Brand Profile existingBlogDocsUrls.",
    }));
  }

  if (forbiddenClaims.length > 0) {
    blockers.push(blocker({
      area: "brand_positioning",
      finding: "Draft appears to include forbidden brand claims.",
      evidence: forbiddenClaims.slice(0, 3).join(", "),
      instruction: "Remove or rewrite every forbidden claim while preserving useful, supported advice.",
    }));
  }

  if (h1Count !== 1) {
    blockers.push(blocker({
      area: "article",
      finding: "Markdown must have exactly one H1.",
      evidence: `Found ${h1Count} H1 headings.`,
      instruction: "Revise the Markdown so it has one article-level H1 and uses H2 sections for the body.",
    }));
  }

  if (h2s.length < 2) {
    blockers.push(blocker({
      area: "article",
      finding: "Markdown needs at least two useful H2 sections.",
      evidence: `Found ${h2s.length} H2 headings.`,
      instruction: "Add practical H2 sections that organize the merchant problem, Shopify-specific guidance, and next steps.",
    }));
  }

  if (editorialScaffolding.length > 0) {
    blockers.push(blocker({
      area: "article",
      finding: "Markdown includes internal editorial or implementation scaffolding.",
      evidence: editorialScaffolding.slice(0, 4).join(", "),
      instruction: "Remove ContentDesk QA notes, editor notes, visual placeholders, image-generation notes, implementation notes, social drafts, title-option scaffolding, and provider/model metadata from the reader-facing article body.",
    }));
  }

  if (directAnswerOpeningIssue) {
    blockers.push(blocker({
      area: "article",
      finding: "Draft does not open with a direct answer.",
      evidence: directAnswerOpeningIssue,
      instruction:
        "Revise the first body paragraph after the H1 so it directly answers the topic in 2-4 useful sentences before adding background context.",
    }));
  }

  if (shopifyScore < 3) {
    blockers.push(blocker({
      area: "article",
      finding: "Draft is not Shopify-specific enough.",
      evidence: "The draft has too few concrete Shopify concepts such as store, checkout, order, admin, product, customer, or app workflow.",
      instruction: "Add concrete Shopify merchant workflow context and remove generic ecommerce framing.",
    }));
  }

  if (!hasAppPositioning) {
    blockers.push(blocker({
      area: "brand_positioning",
      finding: "Draft does not position the app or approved positioning naturally.",
      evidence: `App name "${input.brandProfile.appName}" and positioning were not found in the article, metadata, or CTA.`,
      instruction: "Add one natural app-positioning moment tied to the approved merchant workflow and CTA.",
    }));
  }

  blockers.push(...deterministicBrandInclusionBlockers({
    draft: input.draft,
    brandProfile: input.brandProfile,
  }));

  if (duplicatePlaceholders.length > 0) {
    blockers.push(blocker({
      area: "visual_plan",
      finding: "VisualPlan has duplicate Markdown placeholders.",
      evidence: duplicatePlaceholders.join(", "),
      instruction: "Give each visual a unique bracketed markdownPlaceholder.",
    }));
  }

  if (invalidPlaceholders.length > 0) {
    blockers.push(blocker({
      area: "visual_plan",
      finding: "VisualPlan has invalid Markdown placeholder text.",
      evidence: invalidPlaceholders.slice(0, 3).join(", "),
      instruction: "Use bracketed placeholders in the format [Visual placeholder: concise label].",
    }));
  }

  if (
    input.leadVisual.visualType !== "hero" ||
    input.leadVisual.renderMode !== "generated_image" ||
    input.leadVisual.textBudget !== "none" ||
    input.leadVisual.visualStructure !== "editorial_scene"
  ) {
    blockers.push(blocker({
      area: "visual_plan",
      finding: "Required leadVisual is not configured as a top-of-article generated fashion outcome image.",
      evidence: JSON.stringify({
        visualType: input.leadVisual.visualType,
        renderMode: input.leadVisual.renderMode,
        textBudget: input.leadVisual.textBudget,
        visualStructure: input.leadVisual.visualStructure,
      }),
      instruction: "Revise the leadVisual to be a generated hero editorial_scene with no text, focused on a premium fashion ecommerce outcome.",
    }));
  }

  if (/\b(workflow|diagram|process map|scorecard|worksheet|checklist|table|screenshot|dashboard|admin ui)\b/i.test(leadVisualInstructions)) {
    blockers.push(blocker({
      area: "visual_plan",
      finding: "Required leadVisual appears to be explanatory or SaaS-like instead of a fashion ecommerce outcome image.",
      evidence: input.leadVisual.title,
      instruction: "Replace the leadVisual with an outcome visual such as product-on-model studio photography, campaign-style generated shoot, seasonal collection concept, or before/after merchandising upgrade.",
    }));
  }

  if (visualPlacementMisses.length > 0) {
    niceToHaves.push(niceToHave({
      area: "visual_plan",
      finding: "Some visual placements do not match current H2 headings and will be appended as visual notes.",
      evidence: visualPlacementMisses.map((visual) => visual.placement).slice(0, 3).join(", "),
      instruction: "Prefer exact H2 placement matches when a visual belongs in a specific section.",
    }));
  }

  if (input.draft.sourceNotes.toLowerCase().includes("fallback")) {
    niceToHaves.push(niceToHave({
      area: "article",
      finding: "Draft was generated by fallback logic.",
      evidence: input.draft.sourceNotes,
      instruction: "Review the draft closely for depth and specificity before publishing.",
    }));
  }

  if (markdown.length < 1200) {
    blockers.push(blocker({
      area: "article",
      finding: "Draft is too skeletal for a publish-ready article.",
      evidence: `Markdown length is ${markdown.length} characters.`,
      instruction: "Expand the draft with source-backed examples, merchant workflow detail, and actionable steps.",
    }));
  }

  if (appMentions > 8) {
    niceToHaves.push(niceToHave({
      area: "brand_positioning",
      finding: "App positioning may be overstuffed.",
      evidence: `${input.brandProfile.appName} appears ${appMentions} times.`,
      instruction: "Keep app mentions focused on the CTA and moments where the app naturally helps.",
    }));
  }

  if (genericFillerScore < 3) {
    niceToHaves.push(niceToHave({
      area: "article",
      finding: "Draft may still contain generic SEO filler.",
      evidence: "Generic phrases were detected in the Markdown.",
      instruction: "Replace broad claims with concrete Shopify merchant workflow advice.",
    }));
  }

  if (thinkingGapScore < 2) {
    blockers.push(blocker({
      area: "article",
      finding: "Draft covers the topic but does not resolve the reader's thinking gap.",
      evidence:
        "The Markdown has too few decision, tradeoff, objection, example, workflow, or next-step signals.",
      instruction:
        "Revise the article so it helps the reader choose, compare options, resolve doubts, understand tradeoffs, or take a practical next step instead of merely covering the keyword.",
    }));
  } else if (thinkingGapScore < 3) {
    niceToHaves.push(niceToHave({
      area: "article",
      finding: "Draft could resolve the reader's next question more clearly.",
      evidence:
        "The Markdown has limited decision, tradeoff, objection, example, workflow, or next-step signals.",
      instruction:
        "Add clearer decision criteria, examples, tradeoffs, objections, workflow detail, or next steps.",
    }));
  }

  return qaReportSchema.parse({
    status: blockers.length > 0 ? "needs_revision" : "pass",
    usedFallback: true,
    summary:
      blockers.length > 0
        ? `QA found ${blockers.length} blocker${blockers.length === 1 ? "" : "s"} that must be fixed before PublishKit creation.`
        : `QA passed with ${niceToHaves.length} non-blocking note${niceToHaves.length === 1 ? "" : "s"}.`,
    blockers,
    niceToHaves,
    rubricScores: {
      shopifySpecificity: shopifyScore,
      merchantPain: containsText(searchableText, input.draft.topic.targetMerchantPain) ? 5 : 4,
      actionability,
      claimSupport: invalidSources.length === 0 ? 5 : 1,
      genericFillerAvoidance: genericFillerScore,
      thinkingGapResolution: thinkingGapScore,
      appPositioning: hasAppPositioning ? Math.max(3, Math.min(5, 6 - Math.max(0, appMentions - 4))) : 1,
      founderPublishConfidence: blockers.length === 0 ? 4 : 2,
      visualUsefulness: duplicatePlaceholders.length === 0 && invalidPlaceholders.length === 0 ? 4 : 2,
    },
    revisionInstructions: {
      writer: blockers
        .filter((issue) => issue.area !== "visual_plan")
        .map((issue) => issue.instruction),
      visualProducer: blockers
        .filter((issue) => issue.area === "visual_plan")
        .map((issue) => issue.instruction),
    },
  });
}

export function normalizeAiQaReport(
  report: AiQaReport,
  input?: {
    draft?: ArticleDraft;
    brandProfile?: BrandProfile;
    previousQaReport?: QAReport;
  },
) {
  const internalFieldBlockers = report.blockers.filter((issue) =>
    isInternalDraftScaffoldingBlocker(issue, input?.draft),
  );
  const ignoredInstructions = new Set(
    internalFieldBlockers.map((issue) => issue.instruction),
  );
  let blockers = report.blockers.filter((issue) => !internalFieldBlockers.includes(issue));
  let niceToHaves = report.niceToHaves;
  let summary = report.summary;
  let writerInstructionCandidates = report.revisionInstructions.writer.filter(
    (instruction) => !ignoredInstructions.has(instruction),
  );
  let visualInstructionCandidates = report.revisionInstructions.visualProducer.filter(
    (instruction) => !ignoredInstructions.has(instruction),
  );

  if (input?.previousQaReport) {
    const previousBlockerAreas = new Set(
      input.previousQaReport.blockers.map((issue) => issue.area),
    );
    const verificationBlockers = blockers.filter((issue) =>
      previousBlockerAreas.has(issue.area),
    );
    const reopenedBlockers = blockers.filter(
      (issue) => !previousBlockerAreas.has(issue.area),
    );

    if (reopenedBlockers.length > 0) {
      const reopenedInstructions = new Set(
        reopenedBlockers.map((issue) => issue.instruction),
      );
      blockers = verificationBlockers;
      niceToHaves = [
        ...niceToHaves,
        ...reopenedBlockers.map((issue) => ({
          area: issue.area,
          finding: issue.finding,
          evidence: issue.evidence,
          instruction: issue.instruction,
          severity: "nice_to_have" as const,
        })),
      ];
      summary =
        blockers.length > 0
          ? `Revision verification found ${blockers.length} unresolved original blocker${blockers.length === 1 ? "" : "s"}. ${reopenedBlockers.length} newly surfaced issue${reopenedBlockers.length === 1 ? "" : "s"} were kept as non-blocking notes.`
          : `Revision verification passed the original blocker checklist. ${reopenedBlockers.length} newly surfaced issue${reopenedBlockers.length === 1 ? "" : "s"} were kept as non-blocking notes.`;
      writerInstructionCandidates = writerInstructionCandidates.filter(
        (instruction) => !reopenedInstructions.has(instruction),
      );
      visualInstructionCandidates = visualInstructionCandidates.filter(
        (instruction) => !reopenedInstructions.has(instruction),
      );
    }
  }

  const contractBlockers =
    input?.draft && input.brandProfile
      ? deterministicBrandInclusionBlockers({
          draft: input.draft,
          brandProfile: input.brandProfile,
        })
      : [];
  blockers = mergeBlockers(blockers, contractBlockers);

  return qaReportSchema.parse({
    ...report,
    summary,
    status: blockers.length > 0 ? "needs_revision" : "pass",
    usedFallback: false,
    blockers,
    niceToHaves,
    revisionInstructions: {
      writer: [
        ...writerInstructionCandidates,
        ...blockers
          .filter((issue) => issue.area !== "visual_plan")
          .map((issue) => issue.instruction),
      ],
      visualProducer: [
        ...visualInstructionCandidates,
        ...blockers
          .filter((issue) => issue.area === "visual_plan")
          .map((issue) => issue.instruction),
      ],
    },
  });
}

function blocker(issue: QaIssueDraft): QaBlockerIssue {
  return { ...issue, severity: "blocker" };
}

function niceToHave(issue: QaIssueDraft): QaNiceToHaveIssue {
  return { ...issue, severity: "nice_to_have" };
}

function mergeBlockers(left: QaBlockerIssue[], right: QaBlockerIssue[]) {
  const seen = new Set(left.map((issue) => issue.finding));
  const merged = [...left];

  for (const issue of right) {
    if (seen.has(issue.finding)) continue;
    seen.add(issue.finding);
    merged.push(issue);
  }

  return merged;
}

function deterministicBrandInclusionBlockers(input: {
  draft: ArticleDraft;
  brandProfile: BrandProfile;
}) {
  const inclusion = input.draft.topic.brandInclusion;
  if (!inclusion?.required) return [];

  const aliases = brandInclusionAliases({
    brandProfile: input.brandProfile,
    contractAliases: inclusion.aliases,
  });
  const blockers: QaBlockerIssue[] = [];
  const bodyHasBrand = aliases.some((alias) => containsText(input.draft.markdown, alias));
  const ctaHasBrand = aliases.some((alias) => containsText(input.draft.cta, alias));
  const hasFitSection = hasBrandFitSection(input.draft.markdown, aliases);
  const fitAngleCovered =
    !inclusion.fitAngle || hasFitAngleCoverage(input.draft.markdown, inclusion.fitAngle);
  const brandLabel = aliases[0] ?? input.brandProfile.appName;

  if (!bodyHasBrand) {
    blockers.push(blocker({
      area: "brand_positioning",
      finding: "Required comparison asset does not mention the customer brand in the article body.",
      evidence: `Brand inclusion contract requires one of these aliases in Markdown: ${aliases.join(", ")}.`,
      instruction: `Add ${brandLabel} as an honestly evaluated option in the comparison body. Explain who should consider it and keep claims tied to the Brand Profile and approved sources.`,
    }));
  }

  if (inclusion.ctaRequired && !ctaHasBrand) {
    blockers.push(blocker({
      area: "brand_positioning",
      finding: "Required comparison asset CTA does not mention the customer brand.",
      evidence: `CTA text: "${input.draft.cta}"`,
      instruction: `Revise the CTA to name ${brandLabel} directly while keeping it practical, low-pressure, and evidence-safe.`,
    }));
  }

  if (!hasFitSection) {
    blockers.push(blocker({
      area: "brand_positioning",
      finding: "Required comparison asset lacks a customer fit or tradeoff section.",
      evidence: `No H2/H3 section clearly frames where ${brandLabel} fits, when to choose it, or what tradeoff it represents.`,
      instruction: `Add a clear section such as "Where ${brandLabel} fits" or an equivalent tradeoff section that names the brand and explains the fit honestly.`,
    }));
  }

  if (!fitAngleCovered) {
    blockers.push(blocker({
      area: "brand_positioning",
      finding: "Required comparison asset does not cover the contracted customer fit angle.",
      evidence: `Contracted fit angle: ${inclusion.fitAngle}`,
      instruction: `Revise the ${brandLabel} fit section to cover this angle without overclaiming: ${inclusion.fitAngle}`,
    }));
  }

  return blockers;
}

function brandInclusionAliases(input: {
  brandProfile: BrandProfile;
  contractAliases: string[];
}) {
  return uniqueStrings([
    input.brandProfile.appName,
    ...spacedCamelCaseAliases(input.brandProfile.appName),
    ...(input.brandProfile.brandAliases ?? []),
    ...input.contractAliases,
  ]);
}

function hasBrandFitSection(markdown: string, aliases: string[]) {
  const sections = markdownSections(markdown);

  return sections.some((section) => {
    const heading = section.heading.toLowerCase();
    const text = `${section.heading}\n${section.body}`;
    const mentionsBrand = aliases.some((alias) => containsText(text, alias));
    if (!mentionsBrand) return false;

    return [
      "fit",
      "fits",
      "where",
      "when to choose",
      "best for",
      "tradeoff",
      "trade-off",
      "compare",
      "alternative",
    ].some((signal) => heading.includes(signal));
  });
}

function markdownSections(markdown: string) {
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;

  for (const line of markdown.split("\n")) {
    const heading = line.match(/^#{2,3}\s+(.+?)\s*$/)?.[1]?.trim();
    if (heading) {
      if (current) sections.push(current);
      current = { heading, body: "" };
      continue;
    }

    if (current) current.body += `${line}\n`;
  }

  if (current) sections.push(current);
  return sections;
}

function hasFitAngleCoverage(markdown: string, fitAngle: string) {
  const tokens = contentTokens(fitAngle);
  if (tokens.length === 0) return true;

  const normalizedMarkdown = markdown.toLowerCase();
  const hits = tokens.filter((token) => normalizedMarkdown.includes(token));

  return hits.length >= Math.min(3, Math.max(1, Math.ceil(tokens.length / 4)));
}

function contentTokens(value: string) {
  const stopWords = new Set([
    "and",
    "are",
    "but",
    "for",
    "from",
    "need",
    "that",
    "the",
    "this",
    "when",
    "with",
    "without",
  ]);

  return uniqueStrings(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && !stopWords.has(token)),
  );
}

function spacedCamelCaseAliases(value: string) {
  const spaced = value.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  const compact = value.replace(/\s+/g, "");

  return [spaced, compact].filter((alias) => alias && alias !== value);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const rawValue of values) {
    const value = rawValue.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }

  return output;
}

function markdownH2s(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.match(/^##\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((heading): heading is string => Boolean(heading));
}

function shopifySpecificityScore(text: string) {
  const terms = [
    "shopify",
    "merchant",
    "store",
    "checkout",
    "order",
    "admin",
    "product",
    "customer",
    "app",
    "theme",
    "collection",
  ];
  const normalized = text.toLowerCase();
  const uniqueHits = terms.filter((term) => normalized.includes(term)).length;

  return Math.max(0, Math.min(5, uniqueHits));
}

function actionabilityScore(markdown: string) {
  const numberedSteps = markdown.split("\n").filter((line) => /^\d+\.\s+/.test(line)).length;
  const actionWords = ["check", "review", "map", "start", "add", "remove", "compare", "measure"];
  const actionHits = actionWords.filter((word) => containsText(markdown, word)).length;

  return Math.max(1, Math.min(5, numberedSteps + actionHits));
}

function genericFillerAvoidanceScore(markdown: string) {
  const genericPhrases = [
    "in today's digital landscape",
    "game changer",
    "unlock your potential",
    "boost your business",
    "take it to the next level",
    "seamless experience",
  ];
  const hits = genericPhrases.filter((phrase) => containsText(markdown, phrase)).length;

  return Math.max(1, 5 - hits);
}

export function directAnswerOpeningBlocker(markdown: string) {
  const opening = firstBodyParagraph(markdown);
  if (!opening) return "No body paragraph appears after the H1.";

  if (opening.length < 80) {
    return `Opening paragraph is too thin to answer the topic: "${opening}"`;
  }

  const genericOpeners = [
    "in today's",
    "in the world of",
    "as ecommerce continues",
    "when it comes to",
    "it is important to understand",
    "product visuals are more important than ever",
  ];
  const startsWithGenericOpener = genericOpeners.some((phrase) =>
    opening.toLowerCase().startsWith(phrase),
  );
  if (startsWithGenericOpener) {
    return `Opening paragraph starts with generic scene-setting: "${opening.slice(0, 180)}"`;
  }

  const answerSignals = [
    "should",
    "best",
    "use",
    "choose",
    "start",
    "need",
    "works",
    "depends",
    "because",
    "if ",
    "when ",
    "without",
    "instead",
  ];
  const hasAnswerSignal = answerSignals.some((signal) => containsText(opening, signal));
  if (!hasAnswerSignal) {
    return `Opening paragraph does not clearly state an answer, recommendation, condition, or decision rule: "${opening.slice(0, 180)}"`;
  }

  return "";
}

function firstBodyParagraph(markdown: string) {
  const withoutH1 = markdown
    .split("\n")
    .filter((line) => !/^#(?!#)\s+/.test(line.trim()))
    .join("\n")
    .trim();
  const paragraphs = withoutH1
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph && !/^#{2,6}\s+/.test(paragraph));

  return paragraphs[0] ?? "";
}

export function thinkingGapResolutionScore(
  markdown: string,
  strategyType: ArticleDraft["topic"]["strategyType"] = "education",
) {
  const signalGroups = [
    [
      "choose",
      "decide",
      "decision",
      "compare",
      "option",
      "criteria",
      "tradeoff",
      "alternative",
      "versus",
      "vs",
    ],
    [
      "next step",
      "start",
      "step",
      "workflow",
      "checklist",
      "example",
      "template",
      "review",
      "measure",
      "before",
      "after",
    ],
    [
      "risk",
      "concern",
      "avoid",
      "mistake",
      "doubt",
      "objection",
      "whether",
      "when to",
      "if you",
      "should",
    ],
  ];
  const groupHits = signalGroups.filter((group) =>
    group.some((phrase) => containsText(markdown, phrase)),
  ).length;
  const numberedSteps = markdown.split("\n").filter((line) => /^\d+\.\s+/.test(line)).length;
  const questionHeadings = markdown
    .split("\n")
    .filter((line) => /^#{2,3}\s+.+\?\s*$/.test(line.trim())).length;
  const strategyBonus =
    strategyType === "comparison" && signalGroups[0].some((phrase) => containsText(markdown, phrase))
      ? 1
      : strategyType === "workflow" && signalGroups[1].some((phrase) => containsText(markdown, phrase))
        ? 1
        : strategyType === "education" && questionHeadings > 0
          ? 1
          : 0;

  return Math.max(1, Math.min(5, groupHits + Math.min(1, numberedSteps) + strategyBonus));
}

function findEditorialScaffolding(markdown: string) {
  const patterns = [
    "ContentDesk QA",
    "editor note",
    "visual placeholder",
    "image generation note",
    "implementation note",
    "social draft",
    "title option",
    "provider metadata",
    "model metadata",
    "visual instructions still needing follow-up",
  ];

  return patterns.filter((pattern) => containsText(markdown, pattern));
}

function isInternalDraftScaffoldingBlocker(
  issue: QaBlockerIssue,
  draft?: ArticleDraft,
) {
  if (!draft) return false;
  if (findEditorialScaffolding(draft.markdown).length > 0) return false;

  const issueText = [
    issue.finding,
    issue.evidence,
    issue.instruction,
  ].join("\n");
  const mentionsInternalField = [
    "titleOptions",
    "title options",
    "outline",
    "source notes",
    "source URLs",
    "faq",
    "cta",
    "internal link suggestions",
    "social drafts",
    "topic",
  ].some((term) => containsText(issueText, term));
  const framesAsPackagingScaffolding = [
    "scaffolding",
    "draft package",
    "article package",
    "publishable package",
    "returned draft object",
    "structured fields",
    "non-article fields",
    "field is still present",
    "fields are still present",
  ].some((term) => containsText(issueText, term));

  return mentionsInternalField && framesAsPackagingScaffolding;
}

function containsText(haystack: string, needle: string) {
  const trimmed = needle.trim();
  if (!trimmed) return false;

  return haystack.toLowerCase().includes(trimmed.toLowerCase());
}

function countOccurrences(haystack: string, needle: string) {
  const trimmed = needle.trim();
  if (!trimmed) return 0;

  return haystack
    .toLowerCase()
    .split(trimmed.toLowerCase())
    .length - 1;
}

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicateSet = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) duplicateSet.add(value);
    seen.add(value);
  }

  return [...duplicateSet];
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function normalizeHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
