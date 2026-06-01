import assert from "node:assert/strict";
import test from "node:test";

import { aiTopicBriefSchema } from "@/lib/ai-schemas";
import {
  hasDuplicateStrategicFingerprints,
  hasRecentFingerprintRepetition,
  hasStrategicTopicCoverage,
} from "@/lib/research/strategist";
import { buildArticleRequestResearchObjectives } from "@/lib/research/provider";
import { topicBriefSchema, type TopicBrief } from "@/lib/schemas";

test("hasStrategicTopicCoverage requires education, workflow, and comparison lanes", () => {
  assert.equal(
    hasStrategicTopicCoverage([
      topicFixture({ strategyType: "education" }),
      topicFixture({ strategyType: "workflow" }),
      topicFixture({ strategyType: "comparison" }),
    ]),
    true,
  );

  assert.equal(
    hasStrategicTopicCoverage([
      topicFixture({ strategyType: "education" }),
      topicFixture({ strategyType: "education" }),
      topicFixture({ strategyType: "workflow" }),
    ]),
    false,
  );
});

test("AI topic schema requires intent-matched strategy fields", () => {
  const result = aiTopicBriefSchema.safeParse({
    topic: "AI on-model photo apps",
    workingTitle: "How Shopify brands evaluate AI on-model photo apps",
    strategyType: "comparison",
    funnelStage: "bottom",
    whyThisStrategy:
      "Captures merchants who are actively comparing AI photo tools.",
    targetMerchantPain:
      "Choosing a tool without misrepresenting products or slowing catalog launches.",
    shopifySpecificAngle: "Shopify apparel PDP image workflow",
    whyNow: "AI image tooling is now cheap enough for small catalogs.",
    searchIntent: "Commercial investigation",
    contentGap: "Practical evaluation workflow for Shopify apparel teams.",
    suggestedCtaAngle: "Try Tiny Lemon on a few SKUs.",
    sourceLinks: ["https://example.com/source"],
    score: 90,
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.error.issues.map((issue) => issue.path.join(".")),
    [
      "strategicFingerprint",
      "merchantJob",
      "intentType",
      "messageAngle",
      "proofAngle",
      "strategyEvidence",
    ],
  );
});

test("stored topic schema defaults legacy strategy fields and fingerprint", () => {
  const topic = topicBriefSchema.parse({
    topic: "AI on-model photo apps",
    workingTitle: "How Shopify brands evaluate AI on-model photo apps",
    strategyType: "comparison",
    funnelStage: "bottom",
    whyThisStrategy:
      "Captures merchants who are actively comparing AI photo tools.",
    targetMerchantPain:
      "Choosing a tool without misrepresenting products or slowing catalog launches.",
    shopifySpecificAngle: "Shopify apparel PDP image workflow",
    whyNow: "AI image tooling is now cheap enough for small catalogs.",
    searchIntent: "Commercial investigation",
    contentGap: "Practical evaluation workflow for Shopify apparel teams.",
    suggestedCtaAngle: "Try Tiny Lemon on a few SKUs.",
    sourceLinks: ["https://example.com/source"],
    score: 90,
  });

  assert.equal(topic.intentType, "comparison_decision");
  assert.equal(topic.strategyEvidence.length, 0);
  assert.match(topic.merchantJob, /Shopify merchant job/);
  assert.match(
    topic.strategicFingerprint,
    /^comparison-understand-the-shopify-merchant-job/,
  );
});

test("generation guard detects duplicate fingerprints in the same batch", () => {
  assert.equal(
    hasDuplicateStrategicFingerprints([
      topicFixture({ strategicFingerprint: "flat-lay-to-launch-assets" }),
      topicFixture({ strategicFingerprint: "flat-lay-to-launch-assets" }),
      topicFixture({ strategicFingerprint: "ai-vs-photoshoot-comparison" }),
    ]),
    true,
  );

  assert.equal(
    hasDuplicateStrategicFingerprints([
      topicFixture({ strategicFingerprint: "flat-lay-to-launch-assets" }),
      topicFixture({ strategicFingerprint: "minimum-viable-pdp-image-set" }),
      topicFixture({ strategicFingerprint: "ai-vs-photoshoot-comparison" }),
    ]),
    false,
  );
});

test("generation guard detects repeated recent fingerprints", () => {
  assert.equal(
    hasRecentFingerprintRepetition({
      topics: [
        topicFixture({ strategicFingerprint: "flat-lay-to-launch-assets" }),
        topicFixture({ strategicFingerprint: "ai-vs-photoshoot-comparison" }),
        topicFixture({ strategicFingerprint: "minimum-viable-pdp-image-set" }),
      ],
      topicMemory: [
        topicMemoryFixture("flat-lay-to-launch-assets"),
        topicMemoryFixture("ai-vs-photoshoot-comparison"),
      ],
    }),
    true,
  );

  assert.equal(
    hasRecentFingerprintRepetition({
      topics: [
        topicFixture({ strategicFingerprint: "flat-lay-to-launch-assets" }),
        topicFixture({ strategicFingerprint: "diverse-on-model-representation" }),
        topicFixture({ strategicFingerprint: "minimum-viable-pdp-image-set" }),
      ],
      topicMemory: [topicMemoryFixture("flat-lay-to-launch-assets")],
    }),
    false,
  );
});

test("direct article research objectives include the exact article idea", () => {
  const objectives = buildArticleRequestResearchObjectives({
    profile: {
      appName: "Tiny Lemon",
      targetMerchant: "Shopify fashion stores",
      positioning: "AI product photography for Shopify apparel merchants.",
      featuresUseCases: ["AI model photos"],
      competitors: ["Modelia"],
      preferredVoice: "",
      preferredVisuals: [],
      visualsToAvoid: [],
      forbiddenClaims: [],
      ctaStyle: "soft educational CTA",
      existingBlogDocsUrls: [],
    },
    articleIdea: "Modelia alternatives for Shopify fashion product photos",
  });

  const text = JSON.stringify(objectives);

  assert.match(text, /Modelia alternatives for Shopify fashion product photos/);
  assert.match(text, /Tiny Lemon/);
  assert.match(text, /Shopify fashion stores/);
  assert.match(text, /Modelia alternatives Shopify/);
});

function topicFixture(overrides: Partial<TopicBrief> = {}): TopicBrief {
  return topicBriefSchema.parse({
    topic: "AI on-model photo apps",
    workingTitle: "How Shopify brands evaluate AI on-model photo apps",
    strategicFingerprint: "ai-on-model-photo-evaluation",
    strategyType: "education",
    funnelStage: "top",
    merchantJob: "Choose how to create on-model PDP images before launch.",
    messageAngle:
      "Help merchants frame AI photo selection around launch risk and product accuracy.",
    proofAngle:
      "Use Shopify workflow context and show evaluation criteria merchants can apply.",
    strategyEvidence: [
      "Brand Profile: Tiny Lemon targets Shopify fashion merchants.",
      "Research source: Shopify guidance supports app-led merchant workflows.",
    ],
    whyThisStrategy:
      "Builds category understanding before a merchant starts comparing products.",
    targetMerchantPain:
      "Choosing a tool without misrepresenting products or slowing catalog launches.",
    shopifySpecificAngle: "Shopify apparel PDP image workflow",
    whyNow: "AI image tooling is now cheap enough for small catalogs.",
    searchIntent: "Commercial investigation",
    contentGap: "Practical evaluation workflow for Shopify apparel teams.",
    suggestedCtaAngle: "Try Tiny Lemon on a few SKUs.",
    sourceLinks: ["https://example.com/source"],
    score: 90,
    ...overrides,
  });
}

function topicMemoryFixture(strategicFingerprint: string) {
  return {
    cycleId: "cycle_1",
    workingTitle: "Remembered topic",
    strategyType: "education" as const,
    merchantJob: "Choose a launch-ready image workflow.",
    messageAngle: "Frame the article around launch risk.",
    strategicFingerprint,
    status: "awaiting_approval",
    approved: false,
  };
}
