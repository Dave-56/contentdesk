import assert from "node:assert/strict";
import test from "node:test";
import { buildVisibilityRecommendations } from "@/lib/visibility/recommender";
import { ownedContentInventorySchema } from "@/lib/visibility/site-inventory";
import type { CrossProviderSynthesis } from "@/lib/visibility/synthesis";

test("recommends Botika alternatives page from competitor comparison gap", () => {
  const recommendations = buildVisibilityRecommendations({
    generatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ownedInventory: ownedContentInventorySchema.parse({
      brand: "Tiny Lemon",
      websiteUrl: "https://tinylemon.xyz/",
      generatedAt: "2026-06-02T00:00:00.000Z",
      scope: "owned_site_raw_assets",
      counts: {
        total: 1,
        siteProfilePages: 0,
        blogArticles: 1,
      },
      assets: [
        {
          url: "https://tinylemon.xyz/blog/best-modelia-alternatives-for-shopify-fashion-product-photos",
          slug: "best-modelia-alternatives-for-shopify-fashion-product-photos",
          title: "Modelia Alternatives for Shopify Fashion Photos",
          kind: "blog_article",
          source: "blog_discovery",
          excerpt:
            "Compare the top Modelia competitors for Shopify fashion brands.",
          headings: ["Best Modelia alternatives for Shopify fashion brands"],
          publishedAt: "2026-05-28",
        },
      ],
    }),
    siteProfile: {
      websiteUrl: "https://tinylemon.xyz/",
      companyName: "Tiny Lemon",
      title: "Tiny Lemon Shopify App for AI Model Photos",
      metaDescription: "Tiny Lemon turns flat-lay photos into model photos.",
      headline: "Studio shots in 60 seconds",
      summary: "Tiny Lemon helps Shopify fashion brands create model photos.",
      audienceGuess: "Shopify fashion brands",
      problemSolved: "Create model photos without a photoshoot.",
      featuresUseCases: ["AI on-model photos"],
      existingContent: [
        {
          url: "https://tinylemon.xyz/blog",
          title: "Shopify AI Photo Guides",
          kind: "blog",
          excerpt:
            "Best Modelia Alternatives for Shopify Fashion Product Photos. Compare the top Modelia competitors for Shopify fashion brands.",
        },
      ],
      evidenceQuality: "thin",
      profileSources: [],
      profileWarnings: [],
    },
    strategy: {
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
      positioning: "Create AI on-model photos for Shopify fashion products.",
      conversionGoal: "install Shopify app",
      primaryUseCases: ["AI on-model product photos"],
      market: "shopify_app",
      classificationWarnings: [],
      portfolioSize: 10,
      buyerJobs: [
        {
          id: "compare-alternatives",
          group: "competitor_comparison",
          job: "Compare known AI photo tools.",
          pain: "compare AI photo app alternatives",
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
          type: "homepage",
          status: "present",
          url: "https://tinylemon.xyz/",
          notes: "Primary owned page.",
        },
        {
          type: "alternative_page",
          status: "missing",
          notes: "No known alternatives pages.",
        },
      ],
    },
    run: {
      brand: "Tiny Lemon",
      provider: "perplexity",
      runDate: "2026-06-01T22:00:05.548Z",
      recheckCadenceDays: 1,
      experimentWindowDays: {
        min: 30,
        max: 60,
      },
      summary: {
        promptCount: 1,
        brandMentionedCount: 0,
        brandCitedCount: 0,
        brandRecommendedCount: 0,
        brandTopPickCount: 0,
        competitorOnlyCount: 1,
        competitorRecommendedOnlyCount: 0,
        citedButNotRecommendedCount: 0,
        recommendedButNotCitedCount: 0,
        averageVisibilityScore: 0,
      },
      records: [
        {
          id: "competitor-botika-alternatives",
          prompt: "What are the best Botika alternatives for Shopify fashion brands?",
          promptGroup: "competitor_comparison",
          provider: "perplexity",
          answerText: "Botika alternatives include WearView and Picjam.",
          citedUrls: ["https://www.wearview.co/alternatives/botika-alternatives"],
          citedDomains: ["wearview.co"],
          citedSources: [
            {
              url: "https://www.wearview.co/alternatives/botika-alternatives",
              domain: "wearview.co",
              sourceFormat: "comparison_page",
              citationQuality: "affiliate_seo",
            },
          ],
          runDate: "2026-06-01T22:00:05.548Z",
          visibilityScore: {
            brandMentioned: false,
            brandCited: false,
            mentionPosition: "absent",
            competitorsMentioned: [
              {
                name: "Botika",
                mentioned: true,
                mentionCount: 1,
                cited: false,
                citationCount: 0,
              },
            ],
            competitorsCited: [],
            citationCount: 1,
            sourceStrength: "medium",
            score: 0,
          },
          recommendedNextAction:
            "Create or improve a comparison page because comparison assets are the trusted citation surface for this prompt.",
          recommendationConfidence: "medium",
          recheckDate: "2026-06-02",
        },
      ],
    },
  });

  const [top] = recommendations.recommendations;
  assert.equal(top.title, "Build Botika alternatives page");
  assert.equal(top.taskType, "alternative_page");
  assert.equal(top.targetPromptId, "competitor-botika-alternatives");
  assert.deepEqual(top.recheck.promptIds, ["competitor-botika-alternatives"]);
  assert.equal(top.evidence.targetCompetitorAssetStatus, "missing");
  assert.equal(top.evidence.relatedAssets[0]?.matchedCompetitors[0], "Modelia");
  assert.equal(
    top.evidence.relatedAssets[0]?.url,
    "https://tinylemon.xyz/blog/best-modelia-alternatives-for-shopify-fashion-product-photos",
  );
  assert.match(top.why.join(" "), /No Botika-specific alternatives page found/);
  assert.match(top.why.join(" "), /Related competitor asset exists/);
});

test("recommender uses synthesis repeated provider gaps for high confidence", () => {
  const recommendations = buildVisibilityRecommendations({
    generatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ownedInventory: ownedInventoryFixture(),
    strategy: strategyFixture(),
    synthesis: synthesisFixture(),
  });

  const [top] = recommendations.recommendations;
  assert.equal(recommendations.provider, "synthesis");
  assert.deepEqual(recommendations.providers, ["perplexity", "openai", "anthropic"]);
  assert.equal(recommendations.promptGaps[0]?.promptId, "competitor-botika-alternatives");
  assert.equal(recommendations.promptGaps[0]?.brandStatus, "recommended");
  assert.deepEqual(recommendations.promptGaps[0]?.competitorStatus.mentioned, ["Botika"]);
  assert.equal(recommendations.promptGaps[0]?.gapType, "recommendation_gap");
  assert.equal(recommendations.promptGaps[0]?.sourcesUsed[0]?.domain, "wearview.co");
  assert.equal(top.title, "Build Botika alternatives page");
  assert.equal(top.confidence, "high");
  assert.equal(top.priority, "high");
  assert.equal(top.evidence.targetCompetitorAssetStatus, "missing");
  assert.match(top.why.join(" "), /2 providers show competitor-only answers/);
});

test("recommender skips synthesis prompts that already have no gap", () => {
  const recommendations = buildVisibilityRecommendations({
    generatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ownedInventory: ownedInventoryFixture(),
    strategy: strategyFixture(),
    synthesis: {
      ...synthesisFixture(),
      summary: {
        promptCount: 2,
        providerCount: 3,
        failedProviderCount: 0,
        repeatedGapCount: 1,
        brandRecommendedCount: 1,
        brandTopPickCount: 0,
        competitorRecommendedOnlyCount: 0,
        citedButNotRecommendedCount: 0,
        recommendedButNotCitedCount: 0,
      },
      prompts: [
        {
          promptId: "competitor-botika-vs-tiny-lemon",
          prompt: "Which is better for Shopify fashion brands: Tiny Lemon or Botika?",
          promptGroup: "competitor_comparison",
          brandMentionedProviders: ["perplexity", "openai"],
          brandCitedProviders: ["openai"],
          brandRecommendedProviders: ["perplexity", "openai"],
          brandTopPickProviders: [],
          competitorOnlyProviders: [],
          competitorRecommendedOnlyProviders: [],
          dominantCompetitors: ["Botika"],
          dominantSourceFormats: ["comparison_page"],
          recommendedGapType: "no_gap",
          providerResults: [
            providerResultFixture("perplexity", {
              brandMentioned: true,
              brandCited: false,
              competitorOnly: false,
              dominantSourceFormat: "comparison_page",
            }),
            providerResultFixture("openai", {
              brandMentioned: true,
              brandCited: true,
              competitorOnly: false,
              dominantSourceFormat: "comparison_page",
            }),
          ],
        },
        {
          promptId: "category-best-ai-product-photography-apps",
          prompt: "What AI product photography apps are best for Shopify fashion brands?",
          promptGroup: "category_search",
          brandMentionedProviders: [],
          brandCitedProviders: [],
          brandRecommendedProviders: [],
          brandTopPickProviders: [],
          competitorOnlyProviders: [],
          competitorRecommendedOnlyProviders: [],
          dominantCompetitors: [],
          dominantSourceFormats: ["marketplace_listing"],
          recommendedGapType: "absent_gap",
          providerResults: [
            providerResultFixture("perplexity", {
              brandMentioned: false,
              brandCited: false,
              competitorOnly: false,
              dominantSourceFormat: "marketplace_listing",
            }),
            providerResultFixture("openai", {
              brandMentioned: false,
              brandCited: false,
              competitorOnly: false,
              dominantSourceFormat: "marketplace_listing",
            }),
          ],
        },
      ],
    },
  });

  const [top] = recommendations.recommendations;
  assert.equal(top.targetPromptId, "category-best-ai-product-photography-apps");
  assert.equal(top.taskType, "shopify_app_store_listing");
  assert.match(top.why.join(" "), /absent gap/);
});

test("recommender emits no synthesis recommendations without owned inventory", () => {
  const recommendations = buildVisibilityRecommendations({
    generatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ownedInventory: {
      ...ownedInventoryFixture(),
      counts: {
        total: 0,
        totalPages: 0,
        successfulPages: 0,
        failedPages: 0,
        siteProfilePages: 0,
        blogArticles: 0,
      },
      pages: [],
      assets: [],
    },
    strategy: strategyFixture(),
    synthesis: synthesisFixture(),
  });

  assert.equal(recommendations.provider, "synthesis");
  assert.deepEqual(recommendations.recommendations, []);
});

function ownedInventoryFixture() {
  return ownedContentInventorySchema.parse({
    brand: "Tiny Lemon",
    websiteUrl: "https://tinylemon.xyz/",
    generatedAt: "2026-06-02T00:00:00.000Z",
    scope: "owned_site_raw_assets" as const,
    counts: {
      total: 1,
      siteProfilePages: 0,
      blogArticles: 1,
    },
    assets: [
      {
        url: "https://tinylemon.xyz/blog/best-modelia-alternatives-for-shopify-fashion-product-photos",
        slug: "best-modelia-alternatives-for-shopify-fashion-product-photos",
        title: "Modelia Alternatives for Shopify Fashion Photos",
        kind: "blog_article" as const,
        source: "blog_discovery" as const,
        excerpt: "Compare the top Modelia competitors for Shopify fashion brands.",
        headings: ["Best Modelia alternatives for Shopify fashion brands"],
        publishedAt: "2026-05-28",
      },
    ],
  });
}

function strategyFixture() {
  return {
    brand: {
      name: "Tiny Lemon",
      aliases: ["TinyLemon"],
      domains: ["tinylemon.xyz"],
    },
    provider: "perplexity" as const,
    defaultRecheckDays: 1,
    experimentWindowDays: {
      min: 30,
      max: 60,
    },
    audience: "Shopify fashion brands",
    category: "AI model photo app",
    positioning: "Create AI on-model photos for Shopify fashion products.",
    conversionGoal: "install Shopify app",
    primaryUseCases: ["AI on-model product photos"],
    market: "shopify_app" as const,
    classificationWarnings: [],
    portfolioSize: 10,
    buyerJobs: [
      {
        id: "compare-alternatives",
        group: "competitor_comparison" as const,
        job: "Compare known AI photo tools.",
        pain: "compare AI photo app alternatives",
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
      {
        name: "Modelia",
        aliases: [],
        domains: ["modelia.ai"],
      },
    ],
    assetInventory: [
      {
        type: "homepage" as const,
        status: "present" as const,
        url: "https://tinylemon.xyz/",
        notes: "Primary owned page.",
      },
      {
        type: "alternative_page" as const,
        status: "missing" as const,
        notes: "No known alternatives pages.",
      },
    ],
  };
}

function synthesisFixture(): CrossProviderSynthesis {
  return {
    brand: "Tiny Lemon",
    generatedAt: "2026-06-02T00:00:00.000Z",
    runDate: "2026-06-02T00:00:00.000Z",
    providers: ["perplexity", "openai", "anthropic"],
    providerErrors: [],
    summary: {
      promptCount: 1,
      providerCount: 3,
      failedProviderCount: 0,
      repeatedGapCount: 1,
      brandRecommendedCount: 0,
      brandTopPickCount: 0,
      competitorRecommendedOnlyCount: 0,
      citedButNotRecommendedCount: 1,
      recommendedButNotCitedCount: 0,
    },
    prompts: [
      {
        promptId: "competitor-botika-alternatives",
        prompt: "What are the best Botika alternatives for Shopify fashion brands?",
        promptGroup: "competitor_comparison",
        brandMentionedProviders: ["anthropic"],
        brandCitedProviders: ["anthropic"],
        brandRecommendedProviders: [],
        brandTopPickProviders: [],
        competitorOnlyProviders: ["perplexity", "openai"],
        competitorRecommendedOnlyProviders: [],
        dominantCompetitors: ["Botika"],
        dominantSourceFormats: ["comparison_page", "product_page"],
        recommendedGapType: "recommendation_gap",
        providerResults: [
          providerResultFixture("perplexity", {
            brandMentioned: false,
            brandCited: false,
            competitorOnly: true,
            dominantSourceFormat: "comparison_page",
          }),
          providerResultFixture("openai", {
            brandMentioned: false,
            brandCited: false,
            competitorOnly: true,
            dominantSourceFormat: "comparison_page",
          }),
          providerResultFixture("anthropic", {
            brandMentioned: true,
            brandCited: true,
            competitorOnly: false,
            dominantSourceFormat: "product_page",
          }),
        ],
      },
    ],
  };
}

function providerResultFixture(
  provider: "perplexity" | "openai" | "anthropic",
  input: {
    brandMentioned: boolean;
    brandCited: boolean;
    competitorOnly: boolean;
    dominantSourceFormat: string;
  },
) {
  const owned = input.brandCited;

  return {
    provider,
    answerText: input.brandMentioned
      ? "Tiny Lemon can help Shopify fashion brands."
      : "Botika alternatives include WearView and Picjam.",
    citedUrls: owned
      ? ["https://tinylemon.xyz/"]
      : ["https://wearview.co/alternatives/botika"],
    citedDomains: owned ? ["tinylemon.xyz"] : ["wearview.co"],
    brandMentioned: input.brandMentioned,
    brandCited: input.brandCited,
    brandRecommendation: input.brandMentioned ? "recommended" as const : "absent" as const,
    brandRank: null,
    competitorOnly: input.competitorOnly,
    competitorRecommendedOnly: false,
    competitorsMentioned: input.competitorOnly ? ["Botika"] : [],
    competitorsCited: [],
    competitorsRecommended: [],
    sourceFormats: [input.dominantSourceFormat],
    dominantSourceFormat: input.dominantSourceFormat,
    recommendationConfidence: "medium" as const,
  };
}
