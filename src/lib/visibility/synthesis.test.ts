import assert from "node:assert/strict";
import test from "node:test";
import { buildCrossProviderSynthesis } from "@/lib/visibility/synthesis";
import type { PromptScanRun } from "@/lib/prompt-scan/schemas";

test("groups provider runs by prompt id", () => {
  const synthesis = buildCrossProviderSynthesis({
    generatedAt: new Date("2026-06-02T00:00:00.000Z"),
    runs: [
      runFixture("perplexity", {
        answerText: "Botika alternatives include WearView.",
        citedUrls: ["https://wearview.co/alternatives/botika"],
        sourceFormat: "comparison_page",
      }),
      runFixture("openai", {
        answerText: "Botika alternatives include Picjam.",
        citedUrls: ["https://picjam.ai/botika-alternatives"],
        sourceFormat: "comparison_page",
      }),
      runFixture("anthropic", {
        answerText: "Tiny Lemon can help Shopify fashion brands.",
        citedUrls: ["https://tinylemon.xyz/"],
        sourceFormat: "product_page",
        brandMentioned: true,
        brandCited: true,
      }),
    ],
  });

  assert.equal(synthesis.brand, "Tiny Lemon");
  assert.deepEqual(synthesis.providers, ["perplexity", "openai", "anthropic"]);
  assert.equal(synthesis.summary.promptCount, 1);
  assert.equal(synthesis.summary.repeatedGapCount, 1);

  const [prompt] = synthesis.prompts;
  assert.equal(prompt.promptId, "competitor-botika-alternatives");
  assert.deepEqual(prompt.competitorOnlyProviders, ["perplexity", "openai"]);
  assert.deepEqual(prompt.brandMentionedProviders, ["anthropic"]);
  assert.deepEqual(prompt.brandCitedProviders, ["anthropic"]);
  assert.deepEqual(prompt.dominantCompetitors, ["Botika"]);
  assert.equal(prompt.dominantSourceFormats[0], "comparison_page");
  assert.equal(prompt.recommendedGapType, "competitor_comparison_gap");
});

test("records failed providers in partial synthesis", () => {
  const synthesis = buildCrossProviderSynthesis({
    generatedAt: new Date("2026-06-02T00:00:00.000Z"),
    runs: [
      runFixture("perplexity", {
        answerText: "Botika alternatives include WearView.",
        citedUrls: ["https://wearview.co/alternatives/botika"],
        sourceFormat: "comparison_page",
      }),
      runFixture("anthropic", {
        answerText: "Tiny Lemon can help Shopify fashion brands.",
        citedUrls: ["https://tinylemon.xyz/"],
        sourceFormat: "product_page",
        brandMentioned: true,
        brandCited: true,
      }),
    ],
    providerErrors: [
      {
        provider: "openai",
        error: "OpenAI request failed with 429: insufficient_quota",
      },
    ],
  });

  assert.deepEqual(synthesis.providers, ["perplexity", "anthropic"]);
  assert.deepEqual(synthesis.providerErrors, [
    {
      provider: "openai",
      error: "OpenAI request failed with 429: insufficient_quota",
    },
  ]);
  assert.equal(synthesis.summary.providerCount, 2);
  assert.equal(synthesis.summary.failedProviderCount, 1);
});

test("citation without recommendation stays a recommendation gap", () => {
  const openaiRun = runFixture("openai", {
    answerText: "Tiny Lemon is mentioned in the category, but compare output quality first.",
    citedUrls: ["https://tinylemon.xyz/"],
    sourceFormat: "product_page",
    brandMentioned: true,
    brandCited: true,
  });
  openaiRun.records[0].promptGroup = "category_search";

  const synthesis = buildCrossProviderSynthesis({
    generatedAt: new Date("2026-06-02T00:00:00.000Z"),
    runs: [openaiRun],
  });

  const [prompt] = synthesis.prompts;
  assert.deepEqual(prompt.brandCitedProviders, ["openai"]);
  assert.deepEqual(prompt.brandRecommendedProviders, []);
  assert.equal(prompt.recommendedGapType, "recommendation_gap");
  assert.equal(synthesis.summary.citedButNotRecommendedCount, 1);
});

test("rejects provider runs with different prompt ids", () => {
  const openaiRun = runFixture("openai", {
    answerText: "Different prompt.",
    citedUrls: [],
    sourceFormat: "unknown",
  });
  openaiRun.records[0].id = "different-prompt";

  assert.throws(
    () =>
      buildCrossProviderSynthesis({
        runs: [
          runFixture("perplexity", {
            answerText: "Botika alternatives include WearView.",
            citedUrls: ["https://wearview.co/alternatives/botika"],
            sourceFormat: "comparison_page",
          }),
          openaiRun,
        ],
      }),
    /same prompt ids/,
  );
});

function runFixture(
  provider: PromptScanRun["provider"],
  input: {
    answerText: string;
    citedUrls: string[];
    sourceFormat: PromptScanRun["records"][number]["citedSources"][number]["sourceFormat"];
    brandMentioned?: boolean;
    brandCited?: boolean;
  },
): PromptScanRun {
  const brandMentioned = input.brandMentioned ?? false;
  const brandCited = input.brandCited ?? false;
  const citedDomains = input.citedUrls.map((url) => new URL(url).hostname);

  return {
    brand: "Tiny Lemon",
    provider,
    runDate: "2026-06-02T00:00:00.000Z",
    recheckCadenceDays: 1,
    experimentWindowDays: {
      min: 30,
      max: 60,
    },
    summary: {
      promptCount: 1,
      brandMentionedCount: brandMentioned ? 1 : 0,
      brandCitedCount: brandCited ? 1 : 0,
      brandRecommendedCount: 0,
      brandTopPickCount: 0,
      competitorOnlyCount: brandMentioned ? 0 : 1,
      competitorRecommendedOnlyCount: 0,
      citedButNotRecommendedCount: 0,
      recommendedButNotCitedCount: 0,
      averageVisibilityScore: brandMentioned ? 70 : 0,
    },
    records: [
      {
        id: "competitor-botika-alternatives",
        prompt: "What are the best Botika alternatives for Shopify fashion brands?",
        promptGroup: "competitor_comparison",
        provider,
        answerText: input.answerText,
        citedUrls: input.citedUrls,
        citedDomains,
        citedSources: input.citedUrls.map((url) => ({
          url,
          domain: new URL(url).hostname,
          sourceFormat: input.sourceFormat,
          citationQuality: input.sourceFormat === "product_page" ? "owned_source" : "affiliate_seo",
        })),
        runDate: "2026-06-02T00:00:00.000Z",
        visibilityScore: {
          brandMentioned,
          brandCited,
          mentionPosition: brandMentioned ? "middle" : "absent",
          competitorsMentioned: brandMentioned
            ? []
            : [
                {
                  name: "Botika",
                  mentioned: true,
                  mentionCount: 1,
                  cited: false,
                  citationCount: 0,
                },
              ],
          competitorsCited: [],
          citationCount: input.citedUrls.length,
          sourceStrength: input.citedUrls.length > 0 ? "medium" : "weak",
          score: brandMentioned ? 70 : 0,
        },
        recommendedNextAction: "Create matching asset.",
        recommendationConfidence: input.citedUrls.length > 0 ? "medium" : "low",
        recheckDate: "2026-06-03",
      },
    ],
  };
}
