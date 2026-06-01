import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBuyerPromptPortfolio,
  generateBuyerPromptCandidates,
} from "@/lib/buyer-prompt-strategist";
import {
  buyerPromptStrategyInputSchema,
  type BuyerPromptStrategyInput,
} from "@/lib/buyer-prompt-strategist/schemas";

test("generates buyer prompt candidates from buyer jobs and competitors", () => {
  const candidates = generateBuyerPromptCandidates(strategyFixture());

  assert.ok(candidates.length >= 10);
  assert.ok(
    candidates.some((candidate) =>
      candidate.prompt.includes("Botika alternatives"),
    ),
  );
  assert.ok(
    candidates.some((candidate) =>
      candidate.prompt.includes("best AI model photo apps"),
    ),
  );
});

test("selects a balanced but commercially weighted prompt portfolio", () => {
  const portfolio = buildBuyerPromptPortfolio({
    strategy: strategyFixture(),
    generatedAt: new Date("2026-06-01T00:00:00.000Z"),
  });
  const groups = groupCounts(portfolio.selectedPrompts.map((prompt) => prompt.group));

  assert.equal(portfolio.selectedPrompts.length, 10);
  assert.equal(portfolio.generatedAt, "2026-06-01T00:00:00.000Z");
  assert.equal(groups.competitor_comparison, 3);
  assert.equal(groups.high_intent_purchase, 2);
  assert.equal(groups.problem_aware, 1);
  assert.equal(groups.category_search, 2);
  assert.ok(
    portfolio.selectedCandidates.every(
      (candidate) =>
        candidate.totalScore >= 20 &&
        candidate.rationale.includes("Scores: buyer intent"),
    ),
  );
});

test("small portfolio keeps comparison and decision prompts overweighted", () => {
  const strategy = strategyFixture({ portfolioSize: 5 });
  const portfolio = buildBuyerPromptPortfolio({ strategy });
  const groups = groupCounts(portfolio.selectedPrompts.map((prompt) => prompt.group));

  assert.equal(portfolio.selectedPrompts.length, 5);
  assert.equal(groups.competitor_comparison, 2);
  assert.equal(groups.high_intent_purchase, 1);
  assert.equal(groups.problem_aware, 1);
  assert.equal(groups.category_search, 1);
});

function groupCounts(groups: string[]) {
  return groups.reduce<Record<string, number>>((counts, group) => {
    counts[group] = (counts[group] ?? 0) + 1;
    return counts;
  }, {});
}

function strategyFixture(
  overrides: Partial<BuyerPromptStrategyInput> = {},
): BuyerPromptStrategyInput {
  return buyerPromptStrategyInputSchema.parse({
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
    audience: "Shopify fashion brands",
    category: "AI model photo app",
    positioning:
      "Tiny Lemon helps Shopify fashion brands create AI on-model product photos.",
    conversionGoal: "a Shopify product page launch",
    primaryUseCases: ["AI on-model product photos"],
    portfolioSize: 10,
    buyerJobs: [
      {
        id: "avoid-photoshoot",
        group: "problem_aware",
        job: "Avoid a traditional photoshoot.",
        pain: "create model photos without hiring models",
        commercialCloseness: 3,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "find-tools",
        group: "category_search",
        job: "Find category tools.",
        pain: "find AI product photography tools",
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "understand-workflow",
        group: "solution_aware",
        job: "Understand the workflow.",
        pain: "understand how AI model photo apps work",
        commercialCloseness: 3,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "compare-tools",
        group: "competitor_comparison",
        job: "Compare tools.",
        pain: "compare AI photo apps",
        commercialCloseness: 5,
        productFit: 5,
        assetOpportunity: 5,
      },
      {
        id: "prepare-pdp",
        group: "integration_use_case",
        job: "Prepare product pages.",
        pain: "prepare AI model photos for Shopify product pages",
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 3,
      },
      {
        id: "choose-app",
        group: "high_intent_purchase",
        job: "Choose an app.",
        pain: "choose the right AI model photo app",
        commercialCloseness: 5,
        productFit: 5,
        assetOpportunity: 5,
      },
    ],
    competitors: [
      { name: "Botika", aliases: [], domains: ["botika.io"] },
      { name: "Modelia", aliases: [], domains: ["modelia.ai"] },
      { name: "Photoroom", aliases: [], domains: ["photoroom.com"] },
      { name: "Claid", aliases: [], domains: ["claid.ai"] },
    ],
    assetInventory: [
      {
        type: "comparison_page",
        status: "missing",
      },
      {
        type: "shopify_app_store_listing",
        status: "unknown",
      },
      {
        type: "blog_guide",
        status: "unknown",
      },
    ],
    ...overrides,
  });
}
