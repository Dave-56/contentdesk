import assert from "node:assert/strict";
import test from "node:test";

import { buildPublishKitFromArticleDraft } from "@/lib/publish-kit";
import {
  publishKitSchema,
  type ArticleDraft,
  type QAReport,
  type VisualAsset,
  type VisualPlan,
} from "@/lib/schemas";

test("Codex handoff matches Tiny Lemon Markdown publishing workflow", () => {
  const publishKit = buildPublishKitFromArticleDraft({
    draft: articleDraftFixture(),
    leadVisual: leadVisualFixture(),
    visualPlan: visualPlanFixture(),
    visualAssets: [leadVisualAssetFixture(), ...visualAssetFixture()],
    qaReport: qaReportFixture(),
  });

  assert.doesNotThrow(() => publishKitSchema.parse(publishKit));

  const handoff = publishKit.codexHandoffPrompt;

  assert.ok(handoff.includes("Tiny Lemon Markdown guide"));
  assert.ok(handoff.includes("content/blog/<final-slug>.md"));
  assert.ok(handoff.includes("public/blog/<final-slug>/"));
  assert.ok(handoff.includes("/blog/<final-slug>/<image-file-name>"));
  assert.ok(handoff.includes("For comparison titles, prefer a natural comparison slug"));
  assert.ok(handoff.includes("Title clarity pass:"));
  assert.ok(handoff.includes("Keep industry terms only when they are natural for the target reader and likely search language."));
  assert.ok(handoff.includes("Replace internal shorthand, acronyms, or operator jargon with clearer reader-facing language when it improves search clarity."));
  assert.ok(handoff.includes("- Excerpt: A practical workflow for Shopify clothing brands evaluating AI on-model photo apps."));
  assert.ok(handoff.includes("Do not create MDX"));
  assert.ok(handoff.includes("Article packet:"));
  assert.ok(handoff.includes("Image assets to copy into Tiny Lemon:"));
  assert.ok(handoff.includes("Required lead visual status: approved"));
  assert.ok(handoff.includes("Required lead visual concept: Lead premium collection image"));
  assert.ok(handoff.includes("Source URL: /generated/cycles/cycle-test/lead-fashion-outcome.png"));
  assert.ok(handoff.includes("Source URL: /generated/cycles/cycle-test/evaluation-map.png"));
  assert.ok(handoff.includes("Final Markdown URL: /blog/<final-slug>/evaluation-workflow-map.png"));
  assert.ok(handoff.includes("Include the CTA naturally in the final section or final paragraph."));
  assert.ok(handoff.includes("If the final section already includes the CTA naturally, do not add a second CTA paragraph."));
  assert.ok(handoff.includes("Use each question as a ### heading"));
  assert.ok(handoff.includes("Do not publish a final ## Sources, ## References, Further reading, or source list section."));
  assert.ok(handoff.includes("Treat source URLs as editorial inputs only, not reader-facing page content."));
  assert.ok(handoff.includes("Convert raw Source: https://... lines into inline links where useful, then remove the raw Source: labels."));
  assert.ok(handoff.includes("Avoid prominent links to direct or near competitors unless the article is explicitly a comparison guide."));
  assert.ok(handoff.includes("Editorial source inputs - do not publish as a source list:"));
  assert.ok(!handoff.includes("append sources under ## Sources"));
  assert.ok(!handoff.includes("move them into a final ## Sources section"));
  assert.ok(handoff.includes("Normalize heading hierarchy"));
  assert.ok(handoff.includes('targetQueries: "consistent on-model images Shopify'));
  assert.ok(handoff.includes("AI on-model photos Shopify"));
  assert.ok(handoff.includes("Shopify fashion product image workflow"));
  assert.ok(!handoff.includes("generic AI image generator vs Shopify fashion app"));
  assert.ok(!handoff.includes("targetQueries: ["));
  assert.ok(handoff.includes("Suggested targetQueries: consistent on-model images Shopify"));
  assert.ok(!handoff.includes("commercial investigation"));
  assert.ok(handoff.includes("- more Shopify fashion visual workflow guides: /blog"));
  assert.ok(handoff.includes("Caption guidance: Remove this instruction-like caption or rewrite it as:"));
  assert.ok(!handoff.includes("Clarify the core distinction"));
  assert.ok(!handoff.includes("Reader-facing Markdown body:\n# How Shopify brands evaluate AI on-model photo apps"));
  assert.ok(!handoff.includes("# A non-duplicate body H1"));
  assert.ok(!handoff.includes("[Visual placeholder:"));
  assert.ok(!handoff.includes("*Replace the unsupported Shopify admin publishing flow"));
  assert.ok(handoff.includes("*A practical view of workflow map for evaluating AI on-model images before Shopify publishing.*"));
  assert.ok(publishKit.markdown.indexOf("lead-fashion-outcome.png") < publishKit.markdown.indexOf("## The short answer"));
  assert.ok(!handoff.includes("Editor QA summary:"));
  assert.ok(!handoff.includes("Non-blocking QA notes:"));
  assert.ok(!handoff.includes("Title options:"));
  assert.ok(!handoff.includes("Social drafts:"));
  assert.ok(!handoff.includes("as an MDX blog post"));
});

test("Codex handoff skips editorial-instruction subtitles", () => {
  const publishKit = buildPublishKitFromArticleDraft({
    draft: articleDraftFixture({
      targetMerchantPain:
        "Tie consistency directly to product pages and collection merchandising.",
      metaDescription:
        "A practical workflow for keeping imagery, review rules, and merchandising aligned as the catalog grows.",
    }),
    leadVisual: leadVisualFixture(),
    visualPlan: visualPlanFixture(),
    visualAssets: [],
    qaReport: qaReportFixture(),
  });

  const handoff = publishKit.codexHandoffPrompt;

  assert.ok(
    handoff.includes(
      'subtitle: "A practical workflow for keeping imagery, review rules, and merchandising aligned as the catalog grows."',
    ),
  );
  assert.ok(!handoff.includes("Tie consistency directly to product pages and collection merchandising."));
});

test("Codex handoff omits unsafe subtitles and unresolved visual notes when no assets are usable", () => {
  const draft = articleDraftFixture({
    targetMerchantPain:
      "Small fashion teams struggle to maintain consistent model styling, pose direction, and brand presentation across SKUs, seasons, and resale launches while coordinating merchandising, photography, retention, and paid acquisition teams without one stable review workflow",
    metaDescription:
      "A practical guide to keeping Shopify apparel visuals consistent across collection launches.",
  });
  const publishKit = buildPublishKitFromArticleDraft({
    draft,
    leadVisual: leadVisualFixture(),
    visualPlan: visualPlanFixture(),
    visualAssets: failedVisualAssetFixture(),
    qaReport: qaReportFixture(),
  });

  const handoff = publishKit.codexHandoffPrompt;

  assert.ok(
    handoff.includes(
      'subtitle: "A practical guide to keeping Shopify apparel visuals consistent across collection launches."',
    ),
  );
  assert.ok(!handoff.includes("resho..."));
  assert.ok(handoff.includes("Image assets to copy into Tiny Lemon:\n- None"));
  assert.ok(handoff.includes("Required lead visual asset is missing."));
  assert.ok(handoff.includes("Required lead visual status: missing"));
  assert.ok(!handoff.includes("Missing or unresolved visual assets:"));
  assert.ok(!handoff.includes("Reason/instruction:"));
});

test("Codex handoff includes only publishable visual assets while artifact keeps diagnostics", () => {
  const publishKit = buildPublishKitFromArticleDraft({
    draft: articleDraftFixture(),
    leadVisual: leadVisualFixture(),
    visualPlan: mixedVisualPlanFixture(),
    visualAssets: [leadVisualAssetFixture(), ...mixedVisualAssetFixture()],
    qaReport: qaReportFixture(),
  });

  const handoff = publishKit.codexHandoffPrompt;

  assert.ok(handoff.includes("Evaluation workflow map"));
  assert.ok(handoff.includes("Final Markdown URL: /blog/<final-slug>/evaluation-workflow-map.png"));
  assert.ok(!handoff.includes("Rejected comparison chart"));
  assert.ok(!handoff.includes("Visual Asset QA rejected this generated image."));
  assert.ok(!handoff.includes("Regenerate this chart with simpler labels."));
  assert.ok(!handoff.includes("Missing or unresolved visual assets:"));
  assert.ok(!handoff.includes("Reason/instruction:"));
  assert.equal(publishKit.visualAssets.length, 3);
  assert.equal(publishKit.leadVisualReadiness, "approved");
  assert.equal(publishKit.visualAssets.some((asset) => asset.status === "failed"), true);
});

function articleDraftFixture(
  overrides: Partial<{
    targetMerchantPain: string;
    metaDescription: string;
  }> = {},
): ArticleDraft {
  return {
    topic: {
      topic: "AI on-model photo apps",
      workingTitle: "How Shopify brands evaluate AI on-model photo apps",
      strategicFingerprint: "evaluate-ai-on-model-apps",
      strategyType: "comparison",
      funnelStage: "bottom",
      merchantJob: "Choose how to create on-model PDP images before launch.",
      intentType: "comparison_decision",
      messageAngle:
        "Frame AI on-model app evaluation around launch risk and product accuracy.",
      proofAngle:
        "Show evaluation criteria and Shopify workflow checks before publishing.",
      strategyEvidence: [
        "Brand Profile: Tiny Lemon supports Shopify fashion visual workflows.",
        "Research source: Shopify context supports merchant app workflow decisions.",
      ],
      whyThisStrategy:
        "Captures merchants who are actively comparing AI on-model photo tools for Shopify.",
      targetMerchantPain:
        overrides.targetMerchantPain ?? "Choosing a tool without misrepresenting products",
      shopifySpecificAngle: "Shopify apparel PDP image workflow",
      whyNow: "AI image tooling is now cheap enough for small catalogs",
      searchIntent: "Commercial investigation",
      contentGap: "Practical evaluation workflow",
      suggestedCtaAngle: "Try Tiny Lemon on a few SKUs",
      sourceLinks: ["https://example.com/source"],
      score: 90,
    },
    outline: [
      {
        heading: "The short answer",
        purpose: "Answer the query directly",
        sourceLinks: ["https://example.com/source"],
      },
    ],
    markdown: [
      "# A non-duplicate body H1",
      "",
      "Use clean inputs and compare garment fidelity before publishing.",
      "",
      "## The short answer",
      "",
      "Start with a small SKU test.",
    ].join("\n"),
    titleOptions: [
      "How Shopify brands evaluate AI on-model photo apps",
      "AI on-model photo apps for Shopify",
      "Choosing AI model photos for Shopify",
    ],
    metadata: {
      title: "How Shopify brands evaluate AI on-model photo apps",
      metaDescription:
        overrides.metaDescription ??
        "A practical workflow for Shopify clothing brands evaluating AI on-model photo apps.",
      targetQueries: [
        "consistent on-model images Shopify",
        "Shopify apparel catalog consistency",
        "consistent product photos Shopify fashion",
        "AI on-model photos Shopify",
        "Shopify fashion product image workflow",
      ],
    },
    faq: [
      {
        question: "Can AI on-model photos be used on Shopify?",
        answer: "Yes, if they accurately represent the product.",
      },
    ],
    cta: "Test Tiny Lemon on a small set of flat-lay images.",
    internalLinkSuggestions: [
      {
        anchorText: "more Shopify fashion visual workflow guides",
        targetUrl: "https://tinylemon.xyz/blog",
        reason: "Related Tiny Lemon guide index",
      },
    ],
    socialDrafts: ["A practical way to evaluate AI on-model photo tools."],
    sources: ["https://example.com/source"],
    sourceNotes: "",
  };
}

function failedVisualAssetFixture(): VisualAsset[] {
  return [
    {
      ...visualAssetFixture()[0],
      status: "failed",
      publicUrl: "",
      error: "Visual Asset QA rejected this generated image.",
    },
  ];
}

function leadVisualFixture(): VisualPlan[number] {
  return {
    title: "Lead premium collection image",
    placement: "LEAD_VISUAL_TOP",
    visualType: "hero",
    purpose: "Show a premium fashion ecommerce outcome before the guide explains the workflow.",
    altText: "Premium product-on-model fashion ecommerce image for a Shopify collection",
    instruction: "Create a polished campaign-style fashion product image with believable garments and premium ecommerce styling.",
    markdownPlaceholder: "[Visual placeholder: lead fashion outcome]",
    renderMode: "generated_image",
    textBudget: "none",
    visualStructure: "editorial_scene",
  };
}

function visualPlanFixture(): VisualPlan {
  return [
    {
      title: "Evaluation workflow map",
      placement: "The short answer",
      visualType: "diagram",
      purpose: "Show how merchants evaluate image quality before Shopify use.",
      altText: "Workflow map for evaluating AI on-model images before Shopify publishing",
      instruction: "Create a simple workflow map.",
      markdownPlaceholder: "[Visual placeholder: evaluation workflow map]",
      renderMode: "generated_image",
      textBudget: "short_labels",
      visualStructure: "workflow_diagram",
    },
  ];
}

function mixedVisualPlanFixture(): VisualPlan {
  return [
    ...visualPlanFixture(),
    {
      title: "Rejected comparison chart",
      placement: "The short answer",
      visualType: "comparison",
      purpose: "Compare visual review steps before Shopify publishing.",
      altText: "Comparison chart for Shopify product photo review steps",
      instruction: "Regenerate this chart with simpler labels.",
      markdownPlaceholder: "[Visual placeholder: rejected comparison chart]",
      renderMode: "markdown_block",
      textBudget: "text_heavy",
      visualStructure: "comparison_matrix",
    },
  ];
}

function visualAssetFixture(): VisualAsset[] {
  return [
    {
      sourcePlaceholder: "[Visual placeholder: evaluation workflow map]",
      title: "Evaluation workflow map",
      visualType: "diagram",
      status: "generated",
      assetType: "generated_image",
      altText: "Workflow map for evaluating AI on-model images before Shopify publishing",
      caption: "Clarify the core distinction between generic AI tools and Shopify fashion workflows.",
      prompt: "Create a clean workflow map.",
      provider: "openai",
      model: "image-generation",
      mimeType: "image/png",
      localPath: "public/generated/cycles/cycle-test/evaluation-map.png",
      publicUrl: "/generated/cycles/cycle-test/evaluation-map.png",
      error: "",
      createdAt: "2026-05-26T16:00:00.000Z",
    },
  ];
}

function leadVisualAssetFixture(): VisualAsset {
  return {
    sourcePlaceholder: "[Visual placeholder: lead fashion outcome]",
    title: "Lead premium collection image",
    visualType: "hero",
    status: "generated",
    assetType: "generated_image",
    altText: "Premium product-on-model fashion ecommerce image for a Shopify collection",
    caption: "Premium product-on-model fashion ecommerce image for a Shopify collection.",
    prompt: "Create a polished campaign-style fashion product image.",
    provider: "openai",
    model: "image-generation",
    mimeType: "image/png",
    localPath: "public/generated/cycles/cycle-test/lead-fashion-outcome.png",
    publicUrl: "/generated/cycles/cycle-test/lead-fashion-outcome.png",
    error: "",
    createdAt: "2026-05-26T16:00:00.000Z",
  };
}

function mixedVisualAssetFixture(): VisualAsset[] {
  return [
    ...visualAssetFixture(),
    {
      sourcePlaceholder: "[Visual placeholder: rejected comparison chart]",
      title: "Rejected comparison chart",
      visualType: "comparison",
      status: "failed",
      assetType: "generated_image",
      altText: "Comparison chart for Shopify product photo review steps",
      caption: "Use this image to show the rejected comparison flow.",
      prompt: "Regenerate this chart with simpler labels.",
      provider: "openai",
      model: "image-generation",
      mimeType: "image/png",
      localPath: "",
      publicUrl: "",
      error: "Visual Asset QA rejected this generated image.",
      createdAt: "2026-05-26T16:00:00.000Z",
    },
  ];
}

function qaReportFixture(): QAReport {
  return {
    status: "pass",
    usedFallback: false,
    summary: "Ready to publish.",
    blockers: [],
    niceToHaves: [],
    rubricScores: {
      shopifySpecificity: 5,
      merchantPain: 5,
      actionability: 5,
      claimSupport: 5,
      genericFillerAvoidance: 5,
      thinkingGapResolution: 5,
      appPositioning: 5,
      founderPublishConfidence: 5,
      visualUsefulness: 5,
    },
    revisionInstructions: {
      writer: [],
      visualProducer: [],
    },
  };
}
