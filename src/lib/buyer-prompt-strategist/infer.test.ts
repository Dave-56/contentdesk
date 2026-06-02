import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStrategyFromMarketClassification,
  buildStrategyFromSiteProfile,
} from "@/lib/buyer-prompt-strategist/infer";
import type { SiteProfile } from "@/lib/reddit-teardown/schemas";

test("infers buyer prompt strategy fields from a website profile", () => {
  const strategy = buildStrategyFromSiteProfile({
    siteProfile: siteProfileFixture(),
    portfolioSize: 10,
  });

  assert.equal(strategy.brand.name, "Tiny Lemon");
  assert.equal(strategy.audience, "Shopify fashion brands");
  assert.equal(strategy.category, "AI model photo app");
  assert.equal(strategy.market, "shopify_app");
  assert.equal(strategy.buyerLanguage, undefined);
  assert.equal(strategy.classificationWarnings[0]?.severity, "manual_review");
  assert.equal(strategy.conversionGoal, "a Shopify product page launch");
  assert.ok(
    strategy.primaryUseCases.some((useCase) =>
      useCase.toLowerCase().includes("on-model"),
    ),
  );
  assert.equal(strategy.buyerJobs.length, 6);
  assert.ok(
    strategy.assetInventory.some(
      (asset) => asset.type === "homepage" && asset.status === "present",
    ),
  );
});

test("builds strategy from LLM market classification", () => {
  const strategy = buildStrategyFromMarketClassification({
    siteProfile: saasSiteProfileFixture(),
    classification: {
      brandName: "OnboardKit",
      market: "saas",
      category: "customer onboarding checklist tool",
      audience: "customer success teams",
      positioning:
        "OnboardKit helps SaaS teams launch repeatable onboarding workflows.",
      conversionGoal: "launching an onboarding workflow",
      primaryUseCases: ["launching customer onboarding flows"],
      buyerLanguage: {
        buyerNoun: "customer success teams",
        categoryNoun: "customer onboarding checklist tool",
        productNoun: "onboarding checklist tool",
        useCaseNoun: "launching customer onboarding flows",
        painNoun: "managing onboarding steps in spreadsheets",
        conversionNoun: "launching an onboarding workflow",
        comparisonNoun: "customer onboarding workflows",
      },
      confidence: {
        brand: 5,
        category: 5,
        audience: 4,
        buyerLanguage: 5,
      },
      warnings: [],
    },
    portfolioSize: 10,
  });

  assert.equal(strategy.brand.name, "OnboardKit");
  assert.equal(strategy.market, "saas");
  assert.equal(strategy.category, "customer onboarding checklist tool");
  assert.equal(strategy.buyerLanguage?.painNoun, "managing onboarding steps in spreadsheets");
  assert.ok(
    strategy.assetInventory.some(
      (asset) => asset.type === "shopify_app_store_listing" && asset.status === "missing",
    ),
  );
});

function siteProfileFixture(): SiteProfile {
  return {
    websiteUrl: "https://tinylemon.xyz/",
    companyName: "Tiny Lemon",
    title: "Tiny Lemon | AI model photos for Shopify fashion brands",
    metaDescription:
      "Create AI on-model product photos for your Shopify fashion catalog.",
    headline:
      "Turn flat lay photos into consistent AI on-model product photos for Shopify product pages.",
    summary:
      "Tiny Lemon helps Shopify fashion brands create AI on-model product photos without coordinating a traditional photoshoot.",
    audienceGuess: "Shopify merchants or ecommerce teams",
    problemSolved:
      "Create model photos without hiring models or booking a photoshoot.",
    featuresUseCases: [
      "AI on-model product photos",
      "turning flat lay photos into model photos",
    ],
    existingContent: [
      {
        url: "https://tinylemon.xyz/",
        title: "Tiny Lemon",
        kind: "homepage",
        excerpt:
          "Tiny Lemon helps Shopify fashion brands create AI on-model product photos for product page launches.",
      },
      {
        url: "https://tinylemon.xyz/blog",
        title: "Blog",
        kind: "blog",
        excerpt: "AI product photography guides for Shopify fashion brands.",
      },
    ],
  };
}

function saasSiteProfileFixture(): SiteProfile {
  return {
    websiteUrl: "https://onboardkit.example/",
    companyName: "OnboardKit",
    title: "OnboardKit | Customer onboarding checklists for SaaS teams",
    metaDescription:
      "Build repeatable onboarding workflows without managing customer steps in spreadsheets.",
    headline: "Launch customer onboarding checklists faster",
    summary:
      "OnboardKit helps customer success teams launch repeatable onboarding workflows.",
    audienceGuess: "customer success teams",
    problemSolved:
      "Customer onboarding steps get lost across spreadsheets and manual handoffs.",
    featuresUseCases: [
      "Build onboarding checklists",
      "Track customer onboarding progress",
    ],
    existingContent: [
      {
        url: "https://onboardkit.example/",
        title: "OnboardKit",
        kind: "homepage",
        excerpt:
          "OnboardKit helps customer success teams manage onboarding workflows.",
      },
    ],
  };
}
