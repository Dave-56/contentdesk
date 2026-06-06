import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBuyerPromptPortfolio,
} from "@/lib/buyer-prompt-strategist";
import {
  buyerPromptStrategyInputSchema,
  type BuyerPromptCandidate,
  type BuyerPromptStrategyInput,
} from "@/lib/buyer-prompt-strategist/schemas";

test("selects LLM-crafted buyer prompt candidates", async () => {
  const candidates = llmCandidateFixtures();

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

test("selects a balanced but commercially weighted prompt portfolio", async () => {
  const portfolio = await buildBuyerPromptPortfolio({
    strategy: strategyFixture(),
    generatedAt: new Date("2026-06-01T00:00:00.000Z"),
    candidateGenerator: async () => llmCandidateFixtures(),
  });
  const intents = intentCounts(portfolio.selectedCandidates);

  assert.equal(portfolio.selectedPrompts.length, 10);
  assert.equal(portfolio.generatedAt, "2026-06-01T00:00:00.000Z");
  assert.ok((intents.neutral ?? 0) >= 5);
  assert.ok((intents.competitor ?? 0) <= 3);
  assert.ok((intents.brand ?? 0) <= 2);
  assert.deepEqual(portfolio.selectedPrompts, portfolio.promptSets.discoveryBaseline.selectedPrompts);
  assert.ok(
    (intentCounts(portfolio.promptSets.brandEvaluation.selectedCandidates).brand ?? 0) >
      (intents.brand ?? 0),
  );
  assert.ok(
    portfolio.selectedCandidates.every(
      (candidate) =>
        candidate.totalScore >= 20 &&
        candidate.rationale.includes("Scores: buyer intent"),
    ),
  );
});

test("small portfolio keeps comparison and decision prompts overweighted", async () => {
  const strategy = strategyFixture({ portfolioSize: 5 });
  const portfolio = await buildBuyerPromptPortfolio({
    strategy,
    candidateGenerator: async () => llmCandidateFixtures(),
  });
  const intents = intentCounts(portfolio.selectedCandidates);

  assert.equal(portfolio.selectedPrompts.length, 5);
  assert.ok((intents.neutral ?? 0) >= 3);
  assert.ok((intents.competitor ?? 0) <= 1);
  assert.ok((intents.brand ?? 0) <= 1);
});

test("SaaS portfolio uses buyerLanguage without Shopify leakage", async () => {
  const portfolio = await buildBuyerPromptPortfolio({
    strategy: saasStrategyFixture(),
    generatedAt: new Date("2026-06-01T00:00:00.000Z"),
    candidateGenerator: async () => saasCandidateFixtures(),
  });
  const promptText = portfolio.selectedPrompts.map((prompt) => prompt.prompt).join("\n");
  const intents = intentCounts(portfolio.selectedCandidates);

  assert.equal(portfolio.selectedPrompts.length, 10);
  assert.ok((intents.neutral ?? 0) >= 5);
  assert.ok((intents.competitor ?? 0) <= 3);
  assert.ok((intents.brand ?? 0) <= 2);
  assert.doesNotMatch(promptText, /shopify/i);
  assert.match(promptText, /customer onboarding checklist tool/i);
  assert.match(promptText, /launching customer onboarding flows/i);
  assert.ok(portfolio.selectedPrompts.every((prompt) => prompt.prompt.endsWith("?")));
  assert.doesNotMatch(promptText, /with Configure|for launch a|prepare Configure/);
});

test("strategy coverage problem prompts stay domain-specific for non-photo products", async () => {
  const portfolio = await buildBuyerPromptPortfolio({
    strategy: politicalTradingStrategyFixture({ portfolioSize: 5 }),
    candidateGenerator: async () => [
      candidate(
        "problem_aware",
        "awareness",
        "How can traders and researchers get professional product photos without STOCK Act disclosure tracking?",
        "buyer_job",
      ),
    ],
  });
  const promptText = portfolio.candidates.map((candidate) => candidate.prompt).join("\n");
  const selectedText = portfolio.selectedPrompts.map((prompt) => prompt.prompt).join("\n");

  assert.doesNotMatch(promptText, /product photos/i);
  assert.doesNotMatch(selectedText, /product photos/i);
  assert.match(promptText, /track STOCK Act disclosure/i);
  assert.match(promptText, /manually checking filings/i);
});

test("strategy coverage avoids duplicate without phrasing in problem prompts", async () => {
  const base = saasStrategyFixture();
  const strategy = buyerPromptStrategyInputSchema.parse({
    ...base,
    buyerLanguage: {
      ...base.buyerLanguage!,
      painNoun: "scaling phone operations without adding headcount",
    },
    buyerJobs: base.buyerJobs.map((job, index) =>
      index === 0
        ? {
          ...job,
          pain: "scaling phone operations without adding headcount",
        }
        : job
    ),
  });
  const portfolio = await buildBuyerPromptPortfolio({
    strategy,
    candidateGenerator: async () => [],
  });
  const promptText = portfolio.candidates.map((candidate) => candidate.prompt).join("\n");

  assert.match(promptText, /scale phone operations without adding headcount/i);
  assert.doesNotMatch(promptText, /without adding headcount without manual work/i);
});

test("baseline keeps Shopify-specific buyer prompts without brand-first wording", async () => {
  const portfolio = await buildBuyerPromptPortfolio({
    strategy: strategyFixture(),
    candidateGenerator: async () => llmCandidateFixtures(),
  });
  const promptText = portfolio.selectedPrompts.map((prompt) => prompt.prompt).join("\n");

  assert.match(promptText, /Shopify fashion brands/i);
  assert.doesNotMatch(promptText, /Tiny Lemon/i);
});

test("baseline excludes brand evaluation and direct comparison buckets", async () => {
  const portfolio = await buildBuyerPromptPortfolio({
    strategy: strategyFixture(),
    candidateGenerator: async () => llmCandidateFixtures(),
  });
  const buckets = portfolio.selectedCandidates.map((candidate) => candidate.portfolioBucket);

  assert.ok(!buckets.includes("brand_evaluation"));
  assert.ok(!buckets.includes("direct_comparison"));
  assert.ok(
    portfolio.promptSets.brandEvaluation.selectedCandidates.some((candidate) =>
      candidate.portfolioBucket === "brand_evaluation" ||
      candidate.portfolioBucket === "direct_comparison"
    ),
  );
});

test("sanitizes comparison noun before building competitor alternatives", async () => {
  const base = strategyFixture();
  const portfolio = await buildBuyerPromptPortfolio({
    strategy: strategyFixture({
      buyerLanguage: {
        ...base.buyerLanguage!,
        comparisonNoun: "product photoshoot alternatives",
      },
    }),
    candidateGenerator: async () => [],
  });
  const candidateText = portfolio.candidates.map((candidate) => candidate.prompt).join("\n");

  assert.doesNotMatch(candidateText, /for product photoshoot alternatives/i);
  assert.match(candidateText, /alternatives to Botika for AI on-model product photos/i);
});

test("baseline prefers competitor alternatives over competitor-vs-competitor prompts", async () => {
  const portfolio = await buildBuyerPromptPortfolio({
    strategy: strategyFixture({ portfolioSize: 5 }),
    candidateGenerator: async () => [
      candidate(
        "competitor_comparison",
        "evaluation",
        "How does Botika compare with Modelia for Shopify fashion brands?",
        "competitor",
      ),
      candidate(
        "competitor_comparison",
        "evaluation",
        "What are the best Botika alternatives for AI model photos?",
        "competitor",
      ),
      ...llmCandidateFixtures().filter((item) =>
        item.group !== "competitor_comparison"
      ),
    ],
  });
  const selectedText = portfolio.selectedPrompts.map((item) => item.prompt).join("\n");

  assert.match(selectedText, /alternatives to Botika/);
  assert.doesNotMatch(selectedText, /Botika compare with Modelia/);
});

test("refuses to select prompts when strategy has manual_review warnings", async () => {
  const strategy = strategyFixture({
    classificationWarnings: [
      {
        field: "category",
        message: "Multiple unrelated brands appear in the cited sources; classification is uncertain.",
        severity: "manual_review",
      },
    ],
  });

  await assert.rejects(
    () => buildBuyerPromptPortfolio({
      strategy,
      candidateGenerator: async () => llmCandidateFixtures(),
    }),
    /manual_review/,
  );
  // --force / allowManualReview bypasses the gate.
  await assert.doesNotReject(() =>
    buildBuyerPromptPortfolio({
      strategy,
      allowManualReview: true,
      candidateGenerator: async () => llmCandidateFixtures(),
    }),
  );
});

function intentCounts(candidates: BuyerPromptCandidate[]) {
  return candidates.reduce<Record<string, number>>((counts, candidate) => {
    const intent = candidate.promptIntent ?? "neutral";
    counts[intent] = (counts[intent] ?? 0) + 1;
    return counts;
  }, {});
}

type CandidateDraft = Omit<BuyerPromptCandidate, "score" | "totalScore" | "rationale"> & {
  llmRationale?: string;
};

function llmCandidateFixtures(): CandidateDraft[] {
  return [
    candidate("problem_aware", "awareness", "How can Shopify fashion brands create model photos without hiring models or booking a photoshoot?", "buyer_job"),
    candidate("category_search", "consideration", "What are the best AI model photo apps for Shopify fashion brands?", "category"),
    candidate("category_search", "evaluation", "Which AI product photo tools work best for small Shopify clothing brands?", "category"),
    candidate("solution_aware", "consideration", "How do AI on-model product photos work for Shopify apparel stores?", "buyer_job"),
    candidate("integration_use_case", "consideration", "How should Shopify fashion brands use AI model photos before a product page launch?", "buyer_job"),
    candidate("competitor_comparison", "evaluation", "What are the best Botika alternatives for AI model photos?", "competitor"),
    candidate("competitor_comparison", "evaluation", "What are the best Modelia alternatives for AI on-model product photos?", "competitor"),
    candidate("competitor_comparison", "evaluation", "How does Tiny Lemon compare with Photoroom for Shopify product photos?", "competitor"),
    candidate("high_intent_purchase", "decision", "Which Shopify app should fashion brands choose for AI on-model product photos?", "purchase"),
    candidate("high_intent_purchase", "decision", "Which AI model photo app should Shopify fashion brands use for a product page launch?", "purchase"),
    candidate("high_intent_purchase", "decision", "Is Tiny Lemon a good fit for Shopify apparel brands replacing traditional photoshoots?", "purchase"),
    candidate("category_search", "consideration", "What AI photo tools help Shopify fashion brands turn flat lays into model photos?", "category"),
  ];
}

function saasCandidateFixtures(): CandidateDraft[] {
  return [
    candidate("problem_aware", "awareness", "How can customer success teams avoid managing onboarding steps in spreadsheets?", "buyer_job"),
    candidate("category_search", "consideration", "What are the best customer onboarding checklist tools for launching customer onboarding flows?", "category"),
    candidate("category_search", "evaluation", "Which onboarding checklist tools help customer success teams launch repeatable onboarding workflows?", "category"),
    candidate("solution_aware", "consideration", "How do customer onboarding checklist tools work for launching customer onboarding flows?", "buyer_job"),
    candidate("integration_use_case", "consideration", "How should customer success teams use onboarding checklist tools for launching customer onboarding flows?", "buyer_job"),
    candidate("competitor_comparison", "evaluation", "What are the best GuideCX alternatives for customer onboarding workflows?", "competitor"),
    candidate("competitor_comparison", "evaluation", "What are the best Arrows alternatives for customer onboarding workflows?", "competitor"),
    candidate("competitor_comparison", "evaluation", "How does OnboardKit compare with Rocketlane for customer onboarding workflows?", "competitor"),
    candidate("high_intent_purchase", "decision", "Which customer onboarding checklist tool should customer success teams choose for launching customer onboarding flows?", "purchase"),
    candidate("high_intent_purchase", "decision", "Which onboarding checklist tool should customer success teams use for launching an onboarding workflow?", "purchase"),
    candidate("high_intent_purchase", "decision", "Is OnboardKit a good fit for customer success teams replacing spreadsheet onboarding?", "purchase"),
    candidate("category_search", "consideration", "What tools help customer success teams standardize onboarding checklists?", "category"),
  ];
}

function candidate(
  group: CandidateDraft["group"],
  journeyPhase: CandidateDraft["journeyPhase"],
  prompt: string,
  source: CandidateDraft["source"],
): CandidateDraft {
  return {
    id: prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    group,
    journeyPhase,
    prompt,
    buyerJob: "LLM-crafted buyer question",
    source,
    llmRationale: `Maps to ${journeyPhase}.`,
  };
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

function saasStrategyFixture(): BuyerPromptStrategyInput {
  return buyerPromptStrategyInputSchema.parse({
    brand: {
      name: "OnboardKit",
      aliases: [],
      domains: ["onboardkit.example"],
    },
    provider: "perplexity",
    defaultRecheckDays: 1,
    experimentWindowDays: {
      min: 30,
      max: 60,
    },
    audience: "customer success teams",
    category: "customer onboarding checklist tool",
    positioning:
      "OnboardKit helps SaaS teams build repeatable onboarding checklists.",
    conversionGoal: "launching an onboarding workflow",
    primaryUseCases: ["launching customer onboarding flows"],
    market: "saas",
    buyerLanguage: {
      buyerNoun: "customer success teams",
      categoryNoun: "customer onboarding checklist tool",
      productNoun: "onboarding checklist tool",
      useCaseNoun: "launching customer onboarding flows",
      painNoun: "managing onboarding steps in spreadsheets",
      conversionNoun: "launching an onboarding workflow",
      comparisonNoun: "customer onboarding workflows",
    },
    portfolioSize: 10,
    buyerJobs: [
      {
        id: "replace-spreadsheets",
        group: "problem_aware",
        job: "Find a better way to manage onboarding steps.",
        pain: "managing onboarding steps in spreadsheets",
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "find-onboarding-tools",
        group: "category_search",
        job: "Discover onboarding checklist tools.",
        pain: "finding onboarding workflow tools",
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "understand-onboarding-workflow",
        group: "solution_aware",
        job: "Understand how onboarding checklist tools work.",
        pain: "standardizing onboarding workflows",
        commercialCloseness: 3,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "compare-onboarding-tools",
        group: "competitor_comparison",
        job: "Compare onboarding workflow tools.",
        pain: "comparing onboarding tool alternatives",
        commercialCloseness: 5,
        productFit: 5,
        assetOpportunity: 5,
      },
      {
        id: "prepare-onboarding-workflow",
        group: "integration_use_case",
        job: "Prepare an onboarding workflow.",
        pain: "preparing onboarding workflows",
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 3,
      },
      {
        id: "choose-onboarding-tool",
        group: "high_intent_purchase",
        job: "Choose an onboarding checklist tool.",
        pain: "choosing an onboarding checklist tool",
        commercialCloseness: 5,
        productFit: 5,
        assetOpportunity: 5,
      },
    ],
    competitors: [
      { name: "Userflow", aliases: [], domains: ["userflow.com"] },
      { name: "Chameleon", aliases: [], domains: ["chameleon.io"] },
      { name: "Appcues", aliases: [], domains: ["appcues.com"] },
      { name: "Userpilot", aliases: [], domains: ["userpilot.com"] },
    ],
    assetInventory: [
      {
        type: "comparison_page",
        status: "missing",
      },
      {
        type: "blog_guide",
        status: "unknown",
      },
    ],
  });
}

function politicalTradingStrategyFixture(
  overrides: Partial<BuyerPromptStrategyInput> = {},
): BuyerPromptStrategyInput {
  return buyerPromptStrategyInputSchema.parse({
    brand: {
      name: "Insider Alpha",
      aliases: [],
      domains: ["followtheinsider.com"],
    },
    provider: "perplexity",
    defaultRecheckDays: 1,
    experimentWindowDays: {
      min: 30,
      max: 60,
    },
    audience: "traders and researchers",
    category: "congressional stock trade data platform",
    positioning:
      "Insider Alpha helps traders track congressional stock trades and STOCK Act disclosures.",
    conversionGoal: "building a trading research workflow",
    primaryUseCases: ["trade alerts and filer analysis"],
    market: "saas",
    buyerLanguage: {
      buyerNoun: "traders and researchers",
      categoryNoun: "congressional stock trade data platform",
      productNoun: "political trading data tool",
      useCaseNoun: "trade alerts and filer analysis",
      painNoun: "STOCK Act disclosure tracking",
      conversionNoun: "a trading research workflow",
      comparisonNoun: "political trading data",
    },
    portfolioSize: 10,
    buyerJobs: [
      {
        id: "track-disclosures",
        group: "problem_aware",
        job: "Track congressional trade disclosures.",
        pain: "STOCK Act disclosure tracking",
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "find-platforms",
        group: "category_search",
        job: "Find congressional trade data platforms.",
        pain: "finding political trading data tools",
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "understand-alerts",
        group: "solution_aware",
        job: "Understand trade alert workflows.",
        pain: "getting real-time trade alerts",
        commercialCloseness: 3,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "compare-platforms",
        group: "competitor_comparison",
        job: "Compare political trading data platforms.",
        pain: "comparing political trading data tools",
        commercialCloseness: 5,
        productFit: 5,
        assetOpportunity: 5,
      },
      {
        id: "export-data",
        group: "integration_use_case",
        job: "Export data for research workflows.",
        pain: "exporting congressional trade data",
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 3,
      },
      {
        id: "choose-platform",
        group: "high_intent_purchase",
        job: "Choose a political trading data platform.",
        pain: "choosing a political trading data platform",
        commercialCloseness: 5,
        productFit: 5,
        assetOpportunity: 5,
      },
    ],
    competitors: [
      { name: "Quiver Quantitative", aliases: ["Quiver"], domains: ["quiverquant.com"] },
      { name: "Capitol Trades", aliases: [], domains: ["capitoltrades.com"] },
      { name: "HouseStockWatch", aliases: [], domains: ["housestockwatcher.com"] },
    ],
    assetInventory: [
      {
        type: "comparison_page",
        status: "missing",
      },
      {
        type: "blog_guide",
        status: "unknown",
      },
    ],
    ...overrides,
  });
}
