import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRecommendationCardFromTeardown,
  buildRecommendationCardFromTopic,
} from "@/lib/recommendation";
import { renderRecommendationCard } from "@/lib/reddit-teardown/renderer";
import {
  recommendationCardSchema,
  topicBriefSchema,
  type BrandProfile,
  type ResearchSource,
} from "@/lib/schemas";
import type { TeardownPacket } from "@/lib/reddit-teardown/schemas";

test("recommendation card schema requires evidence and a dated recheck plan", () => {
  const result = recommendationCardSchema.safeParse({
    source: "manual",
    audience: "Shopify fashion merchants",
    finding: "The brand lacks a clear comparison page.",
    whyItMatters: "Buyers compare tools before choosing an AI photo workflow.",
    evidence: [],
    recommendedAsset: {
      assetType: "comparison",
      title: "Best AI model photo apps for Shopify fashion brands",
      reason: "This answers a decision-stage question.",
      whyThisAssetOverOthers: "A comparison page maps more directly to buyer intent.",
      suggestedStructure: ["Answer", "Criteria", "Options"],
    },
    targetPrompts: [{ prompt: "best AI model photo apps for Shopify" }],
    recheckPlan: {
      recheckOn: "next month",
      prompts: [],
      expectedSignal: "The page can be compared against current cited pages.",
      ifNoMovement: "Refresh the page with missing proof.",
    },
    createdAt: "2026-05-31T00:00:00.000Z",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.error.issues.map((issue) => issue.path.join(".")),
    ["evidence", "recheckPlan.recheckOn", "recheckPlan.prompts"],
  );
});

test("topic recommendation card preserves evidence, target prompts, and recheck date", () => {
  const card = buildRecommendationCardFromTopic({
    topic: topicFixture(),
    brandProfile: brandProfileFixture(),
    sources: [sourceFixture()],
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
  });

  assert.equal(card.source, "topic_brief");
  assert.equal(card.recheckPlan.recheckOn, "2026-06-30");
  assert.equal(card.evidence[0]?.url, "https://example.com/source");
  assert.match(card.recommendedAsset.whyThisAssetOverOthers, /comparison asset/);
  assert.deepEqual(
    card.targetPrompts.map((prompt) => prompt.prompt),
    [
      "Commercial investigation",
      "Best AI model photo apps for Shopify fashion brands",
      "Choose how to create on-model PDP images before launch.",
    ],
  );
});

test("reddit teardown recommendation card renders the seven-question contract", () => {
  const card = buildRecommendationCardFromTeardown(teardownFixture(), {
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
  });
  const rendered = renderRecommendationCard(card);

  assert.equal(card.source, "reddit_teardown");
  assert.equal(card.recheckPlan.recheckOn, "2026-06-30");
  assert.match(rendered, /What did we find\?/);
  assert.match(rendered, /Why does it matter\?/);
  assert.match(rendered, /Evidence:/);
  assert.match(rendered, /What should we publish or fix\?/);
  assert.match(rendered, /Why this asset over others\?/);
  assert.match(rendered, /How should it be structured\?/);
  assert.match(rendered, /Recheck:\* 2026-06-30/);
});

function brandProfileFixture(): BrandProfile {
  return {
    appName: "Tiny Lemon",
    targetMerchant: "Shopify fashion merchants",
    positioning: "AI product photography for Shopify apparel stores.",
    featuresUseCases: ["AI on-model product photos"],
    competitors: ["Modelia"],
    preferredVoice: "clear and practical",
    preferredVisuals: [],
    visualsToAvoid: [],
    forbiddenClaims: [],
    ctaStyle: "soft educational CTA",
    existingBlogDocsUrls: [],
  };
}

function topicFixture() {
  return topicBriefSchema.parse({
    topic: "AI model photo apps",
    workingTitle: "Best AI model photo apps for Shopify fashion brands",
    strategicFingerprint: "ai-model-photo-comparison",
    strategyType: "comparison",
    funnelStage: "bottom",
    merchantJob: "Choose how to create on-model PDP images before launch.",
    intentType: "comparison_decision",
    messageAngle: "Help merchants compare AI photo tools by workflow fit.",
    proofAngle: "Use source-backed criteria and Shopify-specific use cases.",
    strategyEvidence: ["Competitor pages answer the category broadly."],
    whyThisStrategy: "Buyers are actively choosing between AI photo tools.",
    targetMerchantPain:
      "Choosing a visual tool without slowing launch or misrepresenting products.",
    shopifySpecificAngle: "Shopify apparel PDP image workflow",
    whyNow: "AI image tooling is now accessible to small catalogs.",
    searchIntent: "Commercial investigation",
    contentGap: "No clear owned comparison page answers this buyer question.",
    suggestedCtaAngle: "Try Tiny Lemon on a few SKUs.",
    sourceLinks: ["https://example.com/source"],
    score: 95,
  });
}

function sourceFixture(): ResearchSource {
  return {
    provider: "seed",
    query: "best AI model photo apps Shopify",
    url: "https://example.com/source",
    title: "AI product photography guide",
    excerpt: "A source about AI product photography workflows for ecommerce.",
    extractedMarkdown: "",
    fetchedAt: "2026-05-31T00:00:00.000Z",
  };
}

function teardownFixture(): TeardownPacket {
  return {
    websiteUrl: "https://tinylemon.xyz/",
    siteProfile: {
      websiteUrl: "https://tinylemon.xyz/",
      companyName: "Tiny Lemon",
      title: "Tiny Lemon",
      metaDescription: "AI product photos for Shopify fashion stores.",
      headline: "AI model photos for Shopify fashion brands",
      summary: "Tiny Lemon helps Shopify fashion brands create model photos.",
      audienceGuess: "Shopify fashion merchants",
      problemSolved: "Create consistent model photos without a photoshoot.",
      featuresUseCases: ["AI on-model product photos"],
      existingContent: [],
    },
    categoryGuess: "AI product photography software for Shopify stores",
    categoryConfidence: "medium",
    likelyCompetitorsOrSources: [
      {
        name: "Modelia",
        url: "https://example.com/modelia",
        sourceType: "competitor",
        reason: "Adjacent AI fashion photo tool buyers may compare.",
      },
    ],
    buyerPrompts: [
      {
        prompt: "What are the best AI model photo apps for Shopify?",
        intent: "best_tools",
        runIn: ["Google", "ChatGPT", "Perplexity"],
        lookFor: "Listicles and comparison pages.",
      },
      {
        prompt: "How can Shopify fashion brands create model photos?",
        intent: "use_case",
        runIn: ["Google", "ChatGPT"],
        lookFor: "Workflow guides.",
      },
    ],
    discoverySearches: [
      {
        query: "best AI model photo apps for Shopify",
        purpose: "Find comparison pages.",
      },
    ],
    firstPassGap:
      "Tiny Lemon needs an owned comparison page for AI model photo app searches.",
    recommendedAsset: {
      assetType: "comparison",
      title: "Best AI model photo apps for Shopify fashion brands",
      whyItMatters:
        "This gives buyers a clear decision page with criteria, tradeoffs, and product fit.",
      suggestedStructure: [
        "Answer-first summary",
        "Who this is for",
        "Evaluation criteria",
        "Tool comparison",
        "FAQ",
      ],
    },
    caveats: ["Directional until prompts are manually rechecked."],
    usedAi: false,
    usedSearchProvider: false,
  };
}
