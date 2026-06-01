import { query } from "@/lib/db";
import { id } from "@/lib/repository";
import type { BrandProfile, PublishKit } from "@/lib/schemas";

export type ArticleMemoryStatus =
  | "handoff_sent"
  | "published_confirmed"
  | "not_found_on_blog";

export type ArticleMemoryItem = {
  id: string;
  url: string | null;
  slug: string;
  title: string;
  excerpt: string;
  status: ArticleMemoryStatus;
  topicSummary: string;
  targetQueries: string[];
  headings: string[];
  publishedAt: string | null;
};

type ArticleMemoryRow = {
  id: string;
  url: string | null;
  slug: string;
  title: string;
  excerpt: string;
  status: ArticleMemoryStatus;
  topic_summary: string;
  target_queries: string[];
  headings: string[];
  published_at: string | null;
};

export type BlogArticleCandidate = {
  url: string;
  slug: string;
  title: string;
  excerpt: string;
  headings: string[];
  publishedAt?: string;
};

type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export async function getArticleMemoryForResearch(brandId: string) {
  const result = await query<ArticleMemoryRow>(
    `select
       id,
       url,
       slug,
       title,
       excerpt,
       status,
       topic_summary,
       target_queries,
       headings,
       published_at
     from published_articles
     where brand_id = $1
       and (
         status = 'published_confirmed'
         or (status = 'handoff_sent' and created_at > now() - interval '30 days')
       )
     order by
       case status when 'published_confirmed' then 0 else 1 end,
       updated_at desc
     limit 80`,
    [brandId],
  );

  return result.rows.map(articleMemoryRowToItem);
}

export async function recordPublishKitHandoff(input: {
  organizationId: string;
  brandId: string;
  cycleId: string;
  artifactId: string;
  publishKit: PublishKit;
  brandProfile?: BrandProfile;
}) {
  const slug = slugFromTitle(input.publishKit.metadata.title);
  const url = input.brandProfile
    ? inferArticleUrl(input.brandProfile.existingBlogDocsUrls, slug)
    : null;

  await query(
    `insert into published_articles
      (
        id,
        organization_id,
        brand_id,
        content_cycle_id,
        publish_kit_artifact_id,
        status,
        source,
        url,
        slug,
        title,
        excerpt,
        topic_summary,
        target_queries,
        headings,
        published_at,
        last_seen_at
      )
     values ($1, $2, $3, $4, $5, 'handoff_sent', 'contentdesk_handoff', $6, $7, $8, $9, $10, $11, $12, null, null)
     on conflict (brand_id, slug)
     do update set
       content_cycle_id = excluded.content_cycle_id,
       publish_kit_artifact_id = coalesce(published_articles.publish_kit_artifact_id, excluded.publish_kit_artifact_id),
       status = case
         when published_articles.status = 'published_confirmed' then published_articles.status
         else 'handoff_sent'
       end,
       source = 'contentdesk_handoff',
       url = coalesce(published_articles.url, excluded.url),
       title = excluded.title,
       excerpt = excluded.excerpt,
       topic_summary = excluded.topic_summary,
       target_queries = excluded.target_queries,
       headings = excluded.headings,
       updated_at = now()`,
    [
      id("article"),
      input.organizationId,
      input.brandId,
      input.cycleId,
      input.artifactId,
      url,
      slug,
      input.publishKit.metadata.title,
      input.publishKit.metadata.metaDescription,
      topicSummaryFromPublishKit(input.publishKit),
      JSON.stringify(input.publishKit.metadata.targetQueries),
      JSON.stringify(headingsFromMarkdown(input.publishKit.markdown)),
    ],
  );
}

export async function refreshArticleMemoryFromBlog(input: {
  organizationId: string;
  brandId: string;
  blogUrls: string[];
  fetchImpl?: FetchLike;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const articles = await discoverBlogArticles(input.blogUrls, fetchImpl);

  for (const article of articles) {
    await upsertPublishedArticle({
      organizationId: input.organizationId,
      brandId: input.brandId,
      article,
    });
  }

  return {
    discoveredCount: articles.length,
    articles,
  };
}

async function upsertPublishedArticle(input: {
  organizationId: string;
  brandId: string;
  article: BlogArticleCandidate;
}) {
  await query(
    `insert into published_articles
      (
        id,
        organization_id,
        brand_id,
        status,
        source,
        url,
        slug,
        title,
        excerpt,
        topic_summary,
        target_queries,
        headings,
        published_at,
        last_seen_at
      )
     values ($1, $2, $3, 'published_confirmed', 'blog_crawler', $4, $5, $6, $7, $8, '[]'::jsonb, $9, $10, now())
     on conflict (brand_id, slug)
     do update set
       status = 'published_confirmed',
       source = 'blog_crawler',
       url = excluded.url,
       title = excluded.title,
       excerpt = excluded.excerpt,
       topic_summary = case
         when published_articles.topic_summary = '' then excluded.topic_summary
         else published_articles.topic_summary
       end,
       headings = excluded.headings,
       published_at = coalesce(excluded.published_at, published_articles.published_at),
       last_seen_at = now(),
       updated_at = now()`,
    [
      id("article"),
      input.organizationId,
      input.brandId,
      input.article.url,
      input.article.slug,
      input.article.title,
      input.article.excerpt,
      input.article.title,
      JSON.stringify(input.article.headings),
      input.article.publishedAt ?? null,
    ],
  );
}

export async function discoverBlogArticles(
  blogUrls: string[],
  fetchImpl: FetchLike = fetch,
) {
  const discoveryUrls = blogDiscoveryUrls(blogUrls);
  const discovered = new Map<string, Partial<BlogArticleCandidate> & { url: string }>();

  for (const discoveryUrl of discoveryUrls) {
    const text = await fetchText(discoveryUrl, fetchImpl);
    if (!text) continue;

    for (const article of parseArticleLinks(text, discoveryUrl)) {
      discovered.set(article.url, {
        ...discovered.get(article.url),
        ...article,
      });
    }
  }

  const articles: BlogArticleCandidate[] = [];
  for (const article of [...discovered.values()].slice(0, 50)) {
    const detailText = await fetchText(article.url, fetchImpl);
    const detail = detailText ? parseArticleDetail(detailText, article.url) : null;
    const slug = article.slug || slugFromUrl(article.url);
    const title = cleanText(detail?.title || article.title || titleFromSlug(slug));

    if (!slug || !title) continue;

    articles.push({
      url: article.url,
      slug,
      title,
      excerpt: cleanText(detail?.excerpt || article.excerpt || ""),
      headings: detail?.headings ?? [],
      publishedAt: detail?.publishedAt,
    });
  }

  return dedupeArticles(articles);
}

export function formatArticleMemoryForPrompt(articles: ArticleMemoryItem[]) {
  if (articles.length === 0) return "- None";

  return articles
    .map((article, index) => {
      const queries = article.targetQueries.length
        ? `\n  Target queries: ${article.targetQueries.join(", ")}`
        : "";
      const headings = article.headings.length
        ? `\n  Headings: ${article.headings.slice(0, 5).join(" | ")}`
        : "";

      return [
        `${index + 1}. ${article.title}`,
        `  Status: ${article.status}`,
        `  Slug: ${article.slug}`,
        article.url ? `  URL: ${article.url}` : "",
        article.topicSummary ? `  Topic summary: ${article.topicSummary}` : "",
        article.excerpt ? `  Excerpt: ${article.excerpt}` : "",
        `${queries}${headings}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function articleMemoryRowToItem(row: ArticleMemoryRow): ArticleMemoryItem {
  return {
    id: row.id,
    url: row.url,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    status: row.status,
    topicSummary: row.topic_summary,
    targetQueries: row.target_queries ?? [],
    headings: row.headings ?? [],
    publishedAt: row.published_at,
  };
}

function topicSummaryFromPublishKit(publishKit: PublishKit) {
  return [
    publishKit.topic.topic,
    publishKit.topic.workingTitle,
    publishKit.topic.targetMerchantPain,
    publishKit.topic.shopifySpecificAngle,
    publishKit.topic.searchIntent,
  ]
    .map(cleanText)
    .filter(Boolean)
    .join(" | ");
}

function headingsFromMarkdown(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => line.match(/^##\s+(.+)/)?.[1])
    .filter((heading): heading is string => Boolean(heading))
    .map(cleanText)
    .slice(0, 12);
}

function inferArticleUrl(blogUrls: string[], slug: string) {
  for (const value of blogUrls) {
    const url = parseUrl(value);
    if (!url) continue;

    const pathname = url.pathname.replace(/\/+$/, "");
    if (pathname === "/blog" || pathname.endsWith("/blog")) {
      url.pathname = `${pathname}/${slug}`;
      url.search = "";
      url.hash = "";
      return url.toString();
    }
  }

  return null;
}

function blogDiscoveryUrls(blogUrls: string[]) {
  const urls = new Set<string>();

  for (const value of blogUrls) {
    const url = parseUrl(value);
    if (!url) continue;

    urls.add(normalizeUrl(url));
    const origin = url.origin;
    urls.add(`${origin}/sitemap.xml`);
    urls.add(`${origin}/rss.xml`);
    urls.add(`${origin}/feed.xml`);

    const pathname = url.pathname.replace(/\/+$/, "");
    if (pathname === "/blog" || pathname.endsWith("/blog")) {
      urls.add(`${origin}${pathname}`);
      urls.add(`${origin}${pathname}/rss.xml`);
      urls.add(`${origin}${pathname}/feed.xml`);
    }
  }

  return [...urls];
}

function parseArticleLinks(text: string, sourceUrl: string) {
  return [
    ...parseSitemapLinks(text),
    ...parseFeedLinks(text),
    ...parseHtmlLinks(text, sourceUrl),
  ].filter((article) => isBlogArticleUrl(article.url));
}

function parseSitemapLinks(text: string) {
  const links: BlogArticleCandidate[] = [];
  const locPattern = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = locPattern.exec(text))) {
    const url = decodeHtml(match[1]);
    links.push({
      url,
      slug: slugFromUrl(url),
      title: "",
      excerpt: "",
      headings: [],
    });
  }

  return links;
}

function parseFeedLinks(text: string) {
  const links: BlogArticleCandidate[] = [];
  const itemPattern = /<(item|entry)\b[\s\S]*?<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(text))) {
    const item = match[0];
    const url =
      firstXmlValue(item, "link") ||
      item.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ||
      "";
    if (!url) continue;

    links.push({
      url: decodeHtml(url),
      slug: slugFromUrl(url),
      title: decodeHtml(firstXmlValue(item, "title") || ""),
      excerpt: stripTags(decodeHtml(firstXmlValue(item, "description") || "")),
      headings: [],
      publishedAt:
        firstXmlValue(item, "pubDate") ||
        firstXmlValue(item, "published") ||
        firstXmlValue(item, "updated") ||
        undefined,
    });
  }

  return links;
}

function parseHtmlLinks(text: string, sourceUrl: string) {
  const links: BlogArticleCandidate[] = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(text))) {
    const url = absoluteUrl(match[1], sourceUrl);
    if (!url) continue;

    links.push({
      url,
      slug: slugFromUrl(url),
      title: cleanText(stripTags(decodeHtml(match[2]))),
      excerpt: "",
      headings: [],
    });
  }

  return links;
}

function parseArticleDetail(text: string, url: string) {
  return {
    title:
      metaContent(text, "og:title") ||
      metaContent(text, "twitter:title") ||
      firstTagText(text, "h1") ||
      titleFromSlug(slugFromUrl(url)),
    excerpt:
      metaContent(text, "description") ||
      metaContent(text, "og:description") ||
      metaContent(text, "twitter:description") ||
      "",
    headings: [...text.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)]
      .map((match) => cleanText(stripTags(decodeHtml(match[1]))))
      .filter(Boolean)
      .slice(0, 12),
    publishedAt:
      metaContent(text, "article:published_time") ||
      text.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1] ||
      undefined,
  };
}

async function fetchText(url: string, fetchImpl: FetchLike) {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function isBlogArticleUrl(value: string) {
  const url = parseUrl(value);
  if (!url) return false;

  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname.includes("/blog/")) return false;
  if (pathname.endsWith("/tag") || pathname.endsWith("/category")) return false;
  if (/\.(png|jpe?g|gif|webp|svg|css|js|json|xml)$/i.test(pathname)) return false;

  return slugFromUrl(value).length > 0;
}

function dedupeArticles(articles: BlogArticleCandidate[]) {
  const bySlug = new Map<string, BlogArticleCandidate>();

  for (const article of articles) {
    const existing = bySlug.get(article.slug);
    if (!existing || article.title.length > existing.title.length) {
      bySlug.set(article.slug, article);
    }
  }

  return [...bySlug.values()];
}

function firstXmlValue(text: string, tag: string) {
  return text.match(new RegExp(`<${tag}[^>]*>\\s*([\\s\\S]*?)\\s*<\\/${tag}>`, "i"))?.[1];
}

function metaContent(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match =
    text.match(
      new RegExp(
        `<meta\\b[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
        "i",
      ),
    ) ||
    text.match(
      new RegExp(
        `<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`,
        "i",
      ),
    );

  return match ? cleanText(decodeHtml(match[1])) : "";
}

function firstTagText(text: string, tag: string) {
  const match = text.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(stripTags(decodeHtml(match[1]))) : "";
}

function absoluteUrl(value: string, sourceUrl: string) {
  try {
    return new URL(value, sourceUrl).toString();
  } catch {
    return null;
  }
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeUrl(url: URL) {
  url.hash = "";
  return url.toString();
}

function slugFromUrl(value: string) {
  const url = parseUrl(value);
  if (!url) return "";

  return url.pathname
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .at(-1) ?? "";
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function slugFromTitle(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "article";
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
