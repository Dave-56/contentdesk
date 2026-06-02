import assert from "node:assert/strict";
import test from "node:test";
import { buildVisibilityRecommendations } from "@/lib/visibility/recommender";

test("recommends Botika alternatives page from competitor comparison gap", () => {
  const recommendations = buildVisibilityRecommendations({
    generatedAt: new Date("2026-06-02T00:00:00.000Z"),
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
        {
          name: "Modelia",
          aliases: [],
          domains: ["modelia.ai"],
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
        tinyLemonMentionedCount: 0,
        tinyLemonCitedCount: 0,
        competitorOnlyCount: 1,
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
            tinyLemonMentioned: false,
            tinyLemonCited: false,
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
  assert.match(top.why.join(" "), /No Botika-specific alternatives page found/);
  assert.match(top.why.join(" "), /Related competitor asset exists/);
});
