import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverBlogArticles,
  formatArticleMemoryForPrompt,
  type ArticleMemoryItem,
} from "@/lib/article-memory";

test("discovers blog articles from blog index and sitemap URLs", async () => {
  const pages = new Map<string, string>([
    [
      "https://tinylemon.xyz/blog",
      `
        <html>
          <body>
            <a href="/blog/ai-fashion-photos-for-shopify">AI fashion photos for Shopify</a>
            <a href="/pricing">Pricing</a>
          </body>
        </html>
      `,
    ],
    [
      "https://tinylemon.xyz/sitemap.xml",
      `
        <urlset>
          <url><loc>https://tinylemon.xyz/blog/on-model-photo-quality-checklist</loc></url>
          <url><loc>https://tinylemon.xyz/</loc></url>
        </urlset>
      `,
    ],
    [
      "https://tinylemon.xyz/blog/ai-fashion-photos-for-shopify",
      `
        <html>
          <head>
            <meta property="og:title" content="AI Fashion Photos for Shopify Stores">
            <meta name="description" content="A practical guide for fashion merchants.">
          </head>
          <body>
            <h1>Fallback title</h1>
            <h2>Start with a real garment</h2>
            <h2>Review the generated shoot</h2>
          </body>
        </html>
      `,
    ],
    [
      "https://tinylemon.xyz/blog/on-model-photo-quality-checklist",
      `
        <html>
          <body>
            <h1>On-model photo quality checklist</h1>
            <h2>Check garment fidelity</h2>
          </body>
        </html>
      `,
    ],
  ]);

  const articles = await discoverBlogArticles(["https://tinylemon.xyz/blog"], async (url) => ({
    ok: pages.has(url),
    status: pages.has(url) ? 200 : 404,
    async text() {
      return pages.get(url) ?? "";
    },
  }));

  assert.deepEqual(
    articles.map((article) => article.slug).sort(),
    ["ai-fashion-photos-for-shopify", "on-model-photo-quality-checklist"],
  );
  assert.equal(articles[0]?.title, "AI Fashion Photos for Shopify Stores");
  assert.deepEqual(articles[0]?.headings, [
    "Start with a real garment",
    "Review the generated shoot",
  ]);
});

test("formats article memory as a duplicate-avoidance prompt section", () => {
  const articles: ArticleMemoryItem[] = [
    {
      id: "article_1",
      url: "https://tinylemon.xyz/blog/ai-fashion-photos-for-shopify",
      slug: "ai-fashion-photos-for-shopify",
      title: "AI Fashion Photos for Shopify Stores",
      excerpt: "A practical guide for fashion merchants.",
      status: "published_confirmed",
      topicSummary: "AI fashion photos | Shopify fashion merchants",
      targetQueries: ["AI fashion photos Shopify"],
      headings: ["Start with a real garment"],
      publishedAt: null,
    },
  ];

  const prompt = formatArticleMemoryForPrompt(articles);

  assert.match(prompt, /AI Fashion Photos for Shopify Stores/);
  assert.match(prompt, /Status: published_confirmed/);
  assert.match(prompt, /Target queries: AI fashion photos Shopify/);
});
