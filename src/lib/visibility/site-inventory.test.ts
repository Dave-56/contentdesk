import assert from "node:assert/strict";
import test from "node:test";
import { buildOwnedContentInventory } from "@/lib/visibility/site-inventory";

test("builds raw owned-content inventory from site profile and blog articles", () => {
  const inventory = buildOwnedContentInventory({
    generatedAt: new Date("2026-06-02T00:00:00.000Z"),
    siteProfile: {
      websiteUrl: "https://tinylemon.xyz/",
      companyName: "Tiny Lemon",
      title: "Tiny Lemon",
      metaDescription: "",
      headline: "Studio shots in 60 seconds",
      summary: "Tiny Lemon helps Shopify fashion brands.",
      audienceGuess: "Shopify fashion brands",
      problemSolved: "Create model photos without a photoshoot.",
      featuresUseCases: [],
      existingContent: [
        {
          url: "https://tinylemon.xyz/",
          title: "Tiny Lemon",
          kind: "homepage",
          excerpt: "Homepage copy.",
        },
        {
          url: "https://tinylemon.xyz/blog",
          title: "Shopify AI Photo Guides",
          kind: "blog",
          excerpt: "Blog index.",
        },
      ],
    },
    blogArticles: [
      {
        url: "https://tinylemon.xyz/blog/best-modelia-alternatives-for-shopify-fashion-product-photos",
        slug: "best-modelia-alternatives-for-shopify-fashion-product-photos",
        title: "Best Modelia Alternatives for Shopify Fashion Product Photos",
        excerpt: "Compare Modelia competitors.",
        headings: ["Modelia alternatives", "Shopify workflow fit"],
      },
    ],
  });

  assert.equal(inventory.scope, "owned_site_raw_assets");
  assert.equal(inventory.counts.total, 3);
  assert.equal(inventory.counts.siteProfilePages, 2);
  assert.equal(inventory.counts.blogArticles, 1);
  assert.deepEqual(
    inventory.assets.map((asset) => asset.kind).sort(),
    ["blog", "blog_article", "homepage"],
  );
  assert.equal(
    inventory.assets.find((asset) => asset.kind === "blog_article")?.url,
    "https://tinylemon.xyz/blog/best-modelia-alternatives-for-shopify-fashion-product-photos",
  );
});
