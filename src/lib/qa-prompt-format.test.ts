import assert from "node:assert/strict";
import test from "node:test";
import {
  directAnswerOpeningBlocker,
  formatArticleDraftForQa,
  normalizeAiQaReport,
  thinkingGapResolutionScore,
} from "@/lib/editor/seo-qa";
import { formatPreviousDraftForRevision } from "@/lib/writer/seo-writer";
import type { ArticleDraft, BrandProfile, QAReport } from "@/lib/schemas";

test("QA prompt formatting separates public preview from internal validation data", () => {
  const draft = articleDraftFixture();
  const formatted = formatArticleDraftForQa(draft);

  assert.ok(formatted.includes("Public approval preview:"));
  assert.ok(formatted.includes("Supporting handoff components:"));
  assert.ok(formatted.includes("Internal validation data:"));
  assert.ok(formatted.includes("Metadata:"));
  assert.ok(formatted.includes("Regression SEO title"));
  assert.ok(formatted.includes("Regression meta description"));
  assert.ok(formatted.includes("CTA to include:"));
  assert.ok(formatted.includes("Regression CTA"));
  assert.ok(formatted.includes("FAQ:"));
  assert.ok(formatted.includes("Regression FAQ question"));
  assert.ok(formatted.includes("Internal link suggestions:"));
  assert.ok(formatted.includes("Regression internal link"));
  assert.ok(formatted.includes("Markdown body:"));
  assert.ok(formatted.includes("END_OF_LONG_MARKDOWN_SENTINEL"));
  assert.ok(!formatted.includes("Title options:"));
  assert.ok(!formatted.includes("Regression title option 1"));

  assert.ok(
    formatted.indexOf("Regression SEO title") <
      formatted.indexOf("LONG_MARKDOWN_BLOCK_0"),
  );
  assert.ok(
    formatted.indexOf("LONG_MARKDOWN_BLOCK_0") <
      formatted.indexOf("Regression CTA"),
  );
  assert.ok(!formatted.includes("[truncated]"));
});

test("revision prompt formatting gives the writer the same complete draft packet", () => {
  const draft = articleDraftFixture();
  const formatted = formatPreviousDraftForRevision(draft);

  assert.ok(formatted.includes("Regression SEO title"));
  assert.ok(formatted.includes("Regression CTA"));
  assert.ok(formatted.includes("Regression FAQ answer"));
  assert.ok(formatted.includes("Regression internal link"));
  assert.ok(formatted.includes("END_OF_LONG_MARKDOWN_SENTINEL"));
  assert.ok(
    formatted.indexOf("Regression SEO title") <
      formatted.indexOf("LONG_MARKDOWN_BLOCK_0"),
  );
});

test("revision QA normalization keeps newly surfaced issues non-blocking", () => {
  const normalized = normalizeAiQaReport(
    {
      status: "needs_revision",
      summary: "One original blocker remains, and a source note should be stricter.",
      blockers: [
        blocker("article", "Malformed list remains", "The list still has n-.", "Fix the list."),
        blocker(
          "sources",
          "Source claim is too broad",
          "A broad claim was present before the revision.",
          "Narrow the source claim.",
        ),
      ],
      niceToHaves: [],
      rubricScores: rubricScores(),
      revisionInstructions: {
        writer: ["Fix the list.", "Narrow the source claim."],
        visualProducer: [],
      },
    },
    {
      previousQaReport: qaReport({
        blockers: [
          blocker(
            "article",
            "Visible formatting typo",
            "The original draft had a malformed list.",
            "Fix the list.",
          ),
        ],
      }),
    },
  );

  assert.equal(normalized.status, "needs_revision");
  assert.deepEqual(
    normalized.blockers.map((issue) => issue.area),
    ["article"],
  );
  assert.deepEqual(
    normalized.niceToHaves.map((issue) => issue.area),
    ["sources"],
  );
  assert.deepEqual(normalized.revisionInstructions.writer, [
    "Fix the list.",
    "Fix the list.",
  ]);
});

test("revision QA normalization can pass when only reopened issues remain", () => {
  const normalized = normalizeAiQaReport(
    {
      status: "needs_revision",
      summary: "A new brand note appeared.",
      blockers: [
        blocker(
          "brand_positioning",
          "Positioning could be clearer",
          "This was not an original blocker.",
          "Add a clearer positioning line.",
        ),
      ],
      niceToHaves: [],
      rubricScores: rubricScores(),
      revisionInstructions: {
        writer: ["Add a clearer positioning line."],
        visualProducer: [],
      },
    },
    {
      previousQaReport: qaReport({
        blockers: [
          blocker(
            "article",
            "Visible formatting typo",
            "The original draft had a malformed list.",
            "Fix the list.",
          ),
        ],
      }),
    },
  );

  assert.equal(normalized.status, "pass");
  assert.equal(normalized.blockers.length, 0);
  assert.equal(normalized.niceToHaves.length, 1);
  assert.deepEqual(normalized.revisionInstructions.writer, []);
});

test("revision QA normalization ignores internal draft field scaffolding when markdown is clean", () => {
  const draft = articleDraftFixture();
  const normalized = normalizeAiQaReport(
    {
      status: "needs_revision",
      summary: "The body is clean, but the package still has titleOptions.",
      blockers: [
        blocker(
          "article",
          "The publishable package still contains scaffolding fields.",
          "The returned draft object still contains titleOptions, outline, faq, cta, sources, sourceNotes, internalLinkSuggestions, socialDrafts, and topic.",
          "Remove those structured fields from the ArticleDraft package.",
        ),
      ],
      niceToHaves: [],
      rubricScores: rubricScores(),
      revisionInstructions: {
        writer: ["Remove those structured fields from the ArticleDraft package."],
        visualProducer: [],
      },
    },
    {
      draft,
      previousQaReport: qaReport({
        blockers: [
          blocker(
            "article",
            "Visible scaffolding remains",
            "The first pass object included internal fields.",
            "Remove internal fields.",
          ),
        ],
      }),
    },
  );

  assert.equal(normalized.status, "pass");
  assert.equal(normalized.blockers.length, 0);
  assert.deepEqual(normalized.revisionInstructions.writer, []);
});

test("QA normalization deterministically blocks comparison assets missing required brand inclusion", () => {
  const draft: ArticleDraft = {
    ...articleDraftFixture(),
    topic: {
      ...articleDraftFixture().topic,
      strategyType: "comparison",
      assetIntent: "customer_winning_comparison",
      brandInclusion: {
        required: true,
        fit: "strong",
        aliases: ["TinyLemon", "Tiny Lemon"],
        targetCompetitor: "Botika",
        comparisonSet: ["Botika", "Picjam", "TinyLemon"],
        fitAngle:
          "TinyLemon fits Shopify fashion brands when they need flat-lay to model images.",
        ctaRequired: true,
      },
    },
    markdown: [
      "# Best Botika Alternatives",
      "",
      "Picjam and Modelia are useful Shopify AI photo options for apparel stores.",
      "",
      "## What to compare",
      "",
      "Compare Shopify workflow, product image quality, and batch production.",
    ].join("\n"),
    cta: "Try the workflow that fits your catalog.",
  };
  const normalized = normalizeAiQaReport(
    {
      status: "pass",
      summary: "AI QA passed.",
      blockers: [],
      niceToHaves: [],
      rubricScores: rubricScores(),
      revisionInstructions: {
        writer: [],
        visualProducer: [],
      },
    },
    {
      draft,
      brandProfile: brandProfileFixture(),
    },
  );

  assert.equal(normalized.status, "needs_revision");
  assert.ok(
    normalized.blockers.some((issue) =>
      /does not mention the customer brand/.test(issue.finding),
    ),
  );
  assert.ok(
    normalized.blockers.some((issue) =>
      /CTA does not mention the customer brand/.test(issue.finding),
    ),
  );
  assert.ok(
    normalized.blockers.some((issue) =>
      /lacks a customer fit or tradeoff section/.test(issue.finding),
    ),
  );
});

test("thinking gap scoring rewards decision and next-step depth", () => {
  const shallow = [
    "# AI photos for Shopify",
    "",
    "AI photos are useful for Shopify stores. They can improve product pages.",
  ].join("\n");
  const resolved = [
    "# AI photos for Shopify",
    "",
    "## How should a merchant choose?",
    "",
    "Compare each option against decision criteria: garment accuracy, review workflow, risk, and launch timing.",
    "",
    "1. Start with five SKUs.",
    "2. Review before and after images.",
    "3. Choose the workflow that avoids product misrepresentation.",
  ].join("\n");

  assert.equal(thinkingGapResolutionScore(shallow, "comparison") < 3, true);
  assert.equal(thinkingGapResolutionScore(resolved, "comparison") >= 4, true);
});

test("direct answer opening check rejects generic intros", () => {
  const genericIntro = [
    "# AI on-model photos for Shopify",
    "",
    "Product visuals are more important than ever for Shopify fashion brands trying to stand out in a crowded ecommerce market.",
    "",
    "## What to do next",
    "",
    "Choose the fastest workflow that still protects garment accuracy.",
  ].join("\n");
  const answerFirst = [
    "# AI on-model photos for Shopify",
    "",
    "Shopify fashion brands should use AI on-model photos when they need faster PDP and campaign images without booking a full shoot. Use manual editing or traditional photography when garment fit, hero creative, or legal review needs more control.",
    "",
    "## What to do next",
    "",
    "Start with five SKUs and compare output quality before publishing.",
  ].join("\n");

  assert.match(directAnswerOpeningBlocker(genericIntro), /generic scene-setting/);
  assert.equal(directAnswerOpeningBlocker(answerFirst), "");
});

function articleDraftFixture(): ArticleDraft {
  return {
    topic: {
      topic: "visual consistency",
      workingTitle: "Regression article",
      strategicFingerprint: "visual-consistency-workflow",
      strategyType: "workflow",
      funnelStage: "middle",
      merchantJob: "Keep Shopify catalog visuals consistent as new SKUs launch.",
      intentType: "workflow_solution",
      messageAngle:
        "Frame visual consistency as an operating workflow for Shopify merchandising teams.",
      proofAngle:
        "Use Shopify PDP and collection workflow examples to make the advice credible.",
      strategyEvidence: [
        "Brand Profile: Tiny Lemon targets Shopify apparel teams.",
        "Research source: Shopify merchandising context supports workflow guidance.",
      ],
      whyThisStrategy:
        "Turns a recurring Shopify merchandising problem into a practical operating workflow.",
      targetMerchantPain: "Catalog visuals drift as teams publish more SKUs.",
      shopifySpecificAngle: "Shopify PDP and collection-page merchandising.",
      whyNow: "Teams need faster visual operations.",
      searchIntent: "learn a workflow",
      contentGap: "generic AI image advice misses Shopify workflow details",
      suggestedCtaAngle: "try one small collection",
      sourceLinks: ["https://example.com/source"],
      score: 92,
    },
    outline: [
      {
        heading: "Why Shopify catalog visuals drift",
        purpose: "Explain the merchant pain.",
        sourceLinks: ["https://example.com/source"],
      },
    ],
    markdown: longMarkdown(),
    titleOptions: [
      "Regression title option 1",
      "Regression title option 2",
      "Regression title option 3",
    ],
    metadata: {
      title: "Regression SEO title",
      metaDescription: "Regression meta description",
      targetQueries: [
        "consistent product photos Shopify fashion",
        "Shopify apparel catalog consistency",
      ],
    },
    faq: [
      {
        question: "Regression FAQ question",
        answer: "Regression FAQ answer",
      },
    ],
    cta: "Regression CTA",
    internalLinkSuggestions: [
      {
        anchorText: "Regression internal link",
        targetUrl: "https://example.com/blog",
        reason: "Relevant existing resource.",
      },
    ],
    socialDrafts: ["Regression social draft"],
    sources: ["https://example.com/source"],
    sourceNotes: "Regression source notes",
  };
}

function qaReport(input: { blockers: QAReport["blockers"] }): QAReport {
  return {
    status: input.blockers.length > 0 ? "needs_revision" : "pass",
    usedFallback: false,
    summary: "Previous QA report.",
    blockers: input.blockers,
    niceToHaves: [],
    rubricScores: rubricScores(),
    revisionInstructions: {
      writer: input.blockers
        .filter((issue) => issue.area !== "visual_plan")
        .map((issue) => issue.instruction),
      visualProducer: input.blockers
        .filter((issue) => issue.area === "visual_plan")
        .map((issue) => issue.instruction),
    },
  };
}

function brandProfileFixture(): BrandProfile {
  return {
    appName: "TinyLemon",
    brandAliases: ["Tiny Lemon"],
    targetMerchant: "Shopify fashion brands",
    positioning: "flat-lay to model images for Shopify fashion brands",
    featuresUseCases: ["flat-lay to model images"],
    competitors: ["Botika"],
    preferredVoice: "",
    preferredVisuals: [],
    visualsToAvoid: [],
    forbiddenClaims: [],
    ctaStyle: "Try TinyLemon on a small batch.",
    existingBlogDocsUrls: [],
  };
}

function blocker(
  area: QAReport["blockers"][number]["area"],
  finding: string,
  evidence: string,
  instruction: string,
): QAReport["blockers"][number] {
  return {
    area,
    finding,
    evidence,
    instruction,
    severity: "blocker",
  };
}

function rubricScores(): QAReport["rubricScores"] {
  return {
    shopifySpecificity: 4,
    merchantPain: 4,
    actionability: 4,
    claimSupport: 4,
    genericFillerAvoidance: 4,
    thinkingGapResolution: 4,
    appPositioning: 4,
    founderPublishConfidence: 4,
    visualUsefulness: 4,
  };
}

function longMarkdown() {
  const body = Array.from(
    { length: 160 },
    (_, index) =>
      `LONG_MARKDOWN_BLOCK_${index}: Shopify catalog visual operations need clear review rules before publishing.`,
  ).join("\n\n");

  return `# Regression Article\n\n${body}\n\nEND_OF_LONG_MARKDOWN_SENTINEL`;
}
