import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzePromptResult,
  buildPromptScanRun,
  classifyCitationQuality,
  classifySourceFormat,
} from "@/lib/prompt-scan/analyzer";
import { promptScanConfigSchema, type PromptScanConfig } from "@/lib/prompt-scan/schemas";

test("classifies source formats and citation quality separately", () => {
  const config = configFixture();

  assert.equal(
    classifySourceFormat("https://apps.shopify.com/example-ai-photo-app"),
    "marketplace_listing",
  );
  assert.equal(
    classifyCitationQuality("https://apps.shopify.com/example-ai-photo-app", config),
    "platform_marketplace",
  );
  assert.equal(
    classifySourceFormat("https://example.com/best-ai-photo-apps"),
    "listicle",
  );
  assert.equal(
    classifyCitationQuality("https://example.com/best-ai-photo-apps", config),
    "affiliate_seo",
  );
  assert.equal(
    classifyCitationQuality("https://tinylemon.xyz/blog/ai-model-photos", config),
    "owned_source",
  );
});

test("prompt analysis scores brand visibility and competitor-only gaps", () => {
  const record = analyzePromptResult({
    config: configFixture(),
    prompt: {
      id: "best-ai-model-photo-apps",
      group: "category_search",
      prompt: "What are the best AI model photo apps for Shopify?",
    },
    result: {
      answerText:
        "Botika and Modelia are often used by fashion brands. Tiny Lemon is a newer option for Shopify stores.",
      citedUrls: [
        "https://apps.shopify.com/botika",
        "https://modelia.ai/",
        "https://example.com/best-ai-photo-apps",
      ],
    },
    runDate: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.equal(record.visibilityScore.brandMentioned, true);
  assert.equal(record.visibilityScore.brandCited, false);
  assert.equal(record.visibilityScore.mentionPosition, "middle");
  assert.equal(record.visibilityScore.competitorsMentioned.length, 2);
  assert.equal(record.visibilityScore.competitorsCited.length, 1);
  assert.equal(record.visibilityScore.sourceStrength, "strong");
  assert.equal(record.recommendationConfidence, "high");
  assert.equal(record.recheckDate, "2026-06-02");
  assert.match(record.recommendedNextAction, /Shopify App Store listing/);
  assert.match(record.contentdeskNextAction ?? "", /Shopify App Store listing/);
  assert.equal(record.answerSignal?.brandPresence, "mentioned");
  assert.equal(record.answerSignal?.brandRecommendation, "neutral");
});

test("answer signal separates recommendation variants from mentions and citations", () => {
  const cases = [
    {
      answerText: "Tiny Lemon is best for Shopify brands that need model photos fast.",
      expected: "top_pick",
      sentiment: "positive",
      rank: 1,
    },
    {
      answerText: "Tiny Lemon is a strong option for flat-lay to on-model photos.",
      expected: "recommended",
      sentiment: "positive",
      rank: null,
    },
    {
      answerText: "Consider Tiny Lemon if you want a Shopify-native workflow.",
      expected: "qualified",
      sentiment: "mixed",
      rank: null,
    },
    {
      answerText: "Botika beats Tiny Lemon for enterprise model-library depth.",
      expected: "not_recommended",
      sentiment: "negative",
      rank: null,
    },
    {
      answerText: "Tiny Lemon is mentioned in this category, but evaluate output quality first.",
      expected: "qualified",
      sentiment: "mixed",
      rank: null,
    },
  ] as const;

  for (const item of cases) {
    const record = analyzePromptResult({
      config: configFixture(),
      prompt: {
        id: `case-${item.expected}`,
        group: "category_search",
        prompt: "Which AI model photo app should I use?",
      },
      result: {
        answerText: item.answerText,
        citedUrls: ["https://tinylemon.xyz/"],
      },
      runDate: new Date("2026-06-01T00:00:00.000Z"),
    });

    assert.equal(record.answerSignal?.brandRecommendation, item.expected);
    assert.equal(record.answerSignal?.sentiment, item.sentiment);
    assert.equal(record.answerSignal?.brandRank, item.rank);
    assert.equal(record.answerSignal?.brandCitations.includes("owned"), true);
    assert.equal(record.answerSignal?.quote, item.answerText);
  }
});

test("prompt scan run summarizes the baseline across prompts", () => {
  const run = buildPromptScanRun({
    config: configFixture(),
    runDate: new Date("2026-06-01T00:00:00.000Z"),
    results: [
      {
        prompt: {
          id: "prompt-1",
          group: "category_search",
          prompt: "Best AI model photo apps?",
        },
        result: {
          answerText: "Botika and Modelia are common options.",
          citedUrls: ["https://botika.io/", "https://modelia.ai/"],
        },
      },
      {
        prompt: {
          id: "prompt-2",
          group: "high_intent_purchase",
          prompt: "Which Shopify app creates AI model photos?",
        },
        result: {
          answerText: "Tiny Lemon is a Shopify-focused option.",
          citedUrls: ["https://tinylemon.xyz/"],
        },
      },
    ],
  });

  assert.equal(run.summary.promptCount, 2);
  assert.equal(run.summary.brandMentionedCount, 1);
  assert.equal(run.summary.brandCitedCount, 1);
  assert.equal(run.summary.brandRecommendedCount, 0);
  assert.equal(run.summary.citedButNotRecommendedCount, 1);
  assert.equal(run.summary.competitorOnlyCount, 1);
  assert.equal(run.recheckCadenceDays, 1);
});

function configFixture(): PromptScanConfig {
  return promptScanConfigSchema.parse({
    brand: {
      name: "Tiny Lemon",
      aliases: ["TinyLemon"],
      domains: ["tinylemon.xyz"],
    },
    provider: "perplexity",
    defaultRecheckDays: 1,
    experimentWindowDays: {
      min: 30,
      max: 60,
    },
    competitors: [
      {
        name: "Botika",
        aliases: [],
        domains: ["botika.io"],
      },
      {
        name: "Modelia",
        aliases: [],
        domains: ["modelia.ai"],
      },
    ],
    assetInventory: [
      {
        type: "shopify_app_store_listing",
        status: "unknown",
      },
      {
        type: "homepage",
        status: "present",
        url: "https://tinylemon.xyz/",
      },
    ],
    prompts: [
      {
        id: "best-ai-model-photo-apps",
        group: "category_search",
        prompt: "What are the best AI model photo apps for Shopify?",
      },
    ],
  });
}
