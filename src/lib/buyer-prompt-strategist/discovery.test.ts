import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSeedProbes,
  discoverBuyerPrompts,
} from "@/lib/buyer-prompt-strategist/discovery";
import {
  buyerPromptStrategyInputSchema,
  type BuyerPromptStrategyInput,
} from "@/lib/buyer-prompt-strategist/schemas";

test("builds seed probes from reviewed strategy language", () => {
  const probes = buildSeedProbes(strategyFixture());
  const queries = probes.map((probe) => probe.query);

  assert.ok(queries.includes("AI model photo app"));
  assert.ok(queries.includes("best AI model photo app"));
  assert.ok(queries.includes("AI model photo app for Shopify fashion brands"));
  assert.ok(queries.includes("AI on-model product photos app"));
  assert.ok(queries.includes("Botika alternative"));
});

test("discovers evidence-backed prompts from autocomplete suggestions", async () => {
  const discovery = await discoverBuyerPrompts({
    strategy: strategyFixture(),
    generatedAt: new Date("2026-06-03T12:00:00.000Z"),
    fetchAutocomplete: async (query) => {
      if (query === "best AI model photo app") {
        return [
          "best ai model photo apps",
          "best ai model photo app for shopify",
        ];
      }
      if (query === "AI on-model product photos app") {
        return ["ai on model product photos app"];
      }
      if (query === "Botika alternative") {
        return ["botika alternatives", "botika alternative shopify"];
      }

      return [];
    },
  });

  assert.equal(discovery.brand, "Tiny Lemon");
  assert.equal(discovery.generatedAt, "2026-06-03T12:00:00.000Z");
  assert.ok(discovery.candidates.length >= 4);
  assert.ok(
    discovery.candidates.some((candidate) =>
      candidate.rawQuery === "botika alternatives" &&
      candidate.group === "competitor_comparison" &&
      candidate.evidenceQuality === "high"
    ),
  );
  assert.ok(
    discovery.candidates.every((candidate) =>
      candidate.demandEvidence.some((evidence) => evidence.sourceType === "autocomplete")
    ),
  );
});

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
    market: "shopify_app",
    buyerLanguage: {
      buyerNoun: "Shopify fashion brands",
      categoryNoun: "AI model photo app",
      productNoun: "AI model photo app",
      useCaseNoun: "AI on-model product photos",
      painNoun: "hiring models or booking a photoshoot",
      conversionNoun: "a Shopify product page launch",
      comparisonNoun: "AI model photos",
    },
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
        pain: "choose a Shopify app for model photos",
        commercialCloseness: 5,
        productFit: 5,
        assetOpportunity: 5,
      },
    ],
    competitors: [
      {
        name: "Botika",
        aliases: [],
        domains: ["botika.io"],
      },
    ],
    assetInventory: [
      {
        type: "blog_guide",
        status: "missing",
        notes: "No guide found.",
      },
      {
        type: "comparison_page",
        status: "missing",
        notes: "No comparison page found.",
      },
    ],
    ...overrides,
  });
}
