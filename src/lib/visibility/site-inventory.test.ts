import assert from "node:assert/strict";
import test from "node:test";
import { crawlOwnedContentPages } from "@/lib/visibility/owned-content-crawler";
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
      evidenceQuality: "thin",
      profileSources: [],
      profileWarnings: [],
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
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.counts.total, 3);
  assert.equal(inventory.counts.totalPages, 3);
  assert.equal(inventory.counts.siteProfilePages, 2);
  assert.equal(inventory.counts.blogArticles, 1);
  assert.deepEqual(
    inventory.pages.map((page) => page.pageType).sort(),
    ["blog", "blog_article", "homepage"],
  );
  assert.deepEqual(
    inventory.assets.map((asset) => asset.kind).sort(),
    ["blog", "blog_article", "homepage"],
  );
  assert.equal(
    inventory.assets.find((asset) => asset.kind === "blog_article")?.url,
    "https://tinylemon.xyz/blog/best-modelia-alternatives-for-shopify-fashion-product-photos",
  );
});

test("crawler discovers owned pages from sitemap and blog index", async () => {
  const fetchImpl = fakeFetch({
    "https://tinylemon.xyz/sitemap.xml": xmlResponse(`
      <urlset>
        <url><loc>https://tinylemon.xyz/</loc></url>
        <url><loc>https://tinylemon.xyz/blog/best-modelia-alternatives</loc></url>
      </urlset>
    `),
    "https://tinylemon.xyz/sitemap_index.xml": missingResponse(),
    "https://tinylemon.xyz/": htmlResponse(`
      <html>
        <head>
          <title>Tiny Lemon</title>
          <meta name="description" content="AI product photos for Shopify fashion brands">
          <link rel="canonical" href="https://tinylemon.xyz/">
        </head>
        <body>
          <h1>Studio shots in 60 seconds</h1>
          <a href="/blog/best-modelia-alternatives">Modelia alternatives</a>
          <a href="/pricing">Pricing</a>
        </body>
      </html>
    `),
    "https://tinylemon.xyz/blog": htmlResponse(`
      <html><body>
        <h1>Blog</h1>
        <a href="/blog/best-modelia-alternatives">Best Modelia Alternatives</a>
      </body></html>
    `),
    "https://tinylemon.xyz/blog/best-modelia-alternatives": htmlResponse(`
      <html>
        <head>
          <title>Best Modelia Alternatives for Shopify</title>
          <meta name="description" content="Compare Modelia alternatives for Shopify product photos.">
          <meta property="article:published_time" content="2026-06-01T00:00:00.000Z">
          <link rel="canonical" href="https://tinylemon.xyz/blog/best-modelia-alternatives">
        </head>
        <body>
          <h1>Best Modelia Alternatives for Shopify Fashion Product Photos</h1>
          <h2>What to look for</h2>
          <h2>Modelia vs Tiny Lemon</h2>
          <p>Compare AI product photography tools for Shopify fashion stores.</p>
        </body>
      </html>
    `),
    "https://tinylemon.xyz/pricing": htmlResponse(`
      <html><head><title>Pricing</title></head><body><h1>Pricing</h1></body></html>
    `),
  });

  const pages = await crawlOwnedContentPages({
    url: "https://tinylemon.xyz",
    fetchImpl,
    validatePublicUrl: false,
    generatedAt: new Date("2026-06-03T00:00:00.000Z"),
    limits: {
      maxPages: 10,
      maxDepth: 1,
      timeoutMs: 1000,
      maxBytes: 100_000,
    },
  });

  const article = pages.find((page) => page.url.endsWith("/blog/best-modelia-alternatives"));

  assert.ok(article);
  assert.equal(article.pageType, "alternative");
  assert.equal(article.title, "Best Modelia Alternatives for Shopify");
  assert.equal(article.h1, "Best Modelia Alternatives for Shopify Fashion Product Photos");
  assert.deepEqual(article.headings, ["What to look for", "Modelia vs Tiny Lemon"]);
  assert.equal(article.publishedAt, "2026-06-01T00:00:00.000Z");
  assert.equal(article.crawlStatus, "success");
  assert.equal(article.understandingStatus, "pending");
});

test("crawler classifies path-specific FAQ and contact pages before noisy page text", async () => {
  const fetchImpl = fakeFetch({
    "https://datajelly.com/sitemap.xml": missingResponse(),
    "https://datajelly.com/sitemap_index.xml": missingResponse(),
    "https://datajelly.com/": htmlResponse(`
      <html>
        <head><title>DataJelly Guard</title></head>
        <body>
          <h1>Production monitoring</h1>
          <a href="/faq">FAQ</a>
          <a href="/contact">Contact support</a>
        </body>
      </html>
    `),
    "https://datajelly.com/faq": htmlResponse(`
      <html>
        <head><title>FAQ | DataJelly</title></head>
        <body>
          <h1>Frequently Asked Questions</h1>
          <h2>Pricing and plans</h2>
          <h2>Can I change plans?</h2>
        </body>
      </html>
    `),
    "https://datajelly.com/contact": htmlResponse(`
      <html>
        <head><title>Contact DataJelly</title></head>
        <body>
          <h1>Contact DataJelly</h1>
          <h2>Support</h2>
          <p>Send a message to our team.</p>
        </body>
      </html>
    `),
  });

  const pages = await crawlOwnedContentPages({
    url: "https://datajelly.com",
    fetchImpl,
    validatePublicUrl: false,
    generatedAt: new Date("2026-06-03T00:00:00.000Z"),
    limits: {
      maxPages: 3,
      maxDepth: 1,
      timeoutMs: 1000,
      maxBytes: 100_000,
    },
  });

  assert.equal(pages.find((page) => page.url.endsWith("/faq"))?.pageType, "faq");
  assert.equal(pages.find((page) => page.url.endsWith("/contact"))?.pageType, "other");
});

function fakeFetch(responses: Record<string, Response>) {
  return async (url: string) => responses[normalizeTestUrl(url)] ?? missingResponse();
}

function htmlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html",
    },
  });
}

function xmlResponse(body: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/xml",
    },
  });
}

function missingResponse() {
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/html",
    },
  });
}

function normalizeTestUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}
