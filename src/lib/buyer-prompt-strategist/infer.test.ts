import assert from "node:assert/strict";
import test from "node:test";

import { buildStrategyFromSiteProfile } from "@/lib/buyer-prompt-strategist/infer";
import type { SiteProfile } from "@/lib/reddit-teardown/schemas";

test("infers buyer prompt strategy fields from a website profile", () => {
  const strategy = buildStrategyFromSiteProfile({
    siteProfile: siteProfileFixture(),
    portfolioSize: 10,
  });

  assert.equal(strategy.brand.name, "Tiny Lemon");
  assert.equal(strategy.audience, "Shopify fashion brands");
  assert.equal(strategy.category, "AI model photo app");
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
