import { normalizeAndValidatePublicUrl } from "@/lib/reddit-teardown/site-profiler";
import type {
  OwnedContentCrawlLimits,
  OwnedContentPage,
  OwnedContentPageType,
} from "@/lib/visibility/site-inventory";

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type OwnedContentCrawlProgress = {
  phase: "crawl_page";
  status: "start" | "success" | "failed" | "skipped";
  url: string;
  index: number;
  maxPages: number;
  pageType?: OwnedContentPageType;
  failureReason?: string | null;
};

export const DEFAULT_OWNED_CONTENT_CRAWL_LIMITS: OwnedContentCrawlLimits = {
  maxPages: 80,
  maxDepth: 2,
  timeoutMs: 8000,
  maxBytes: 750_000,
};

const COMMON_PATHS = [
  "/",
  "/about",
  "/blog",
  "/guides",
  "/resources",
  "/docs",
  "/help",
  "/comparisons",
  "/alternatives",
  "/integrations",
  "/case-studies",
  "/customers",
  "/pricing",
  "/faq",
];

export async function crawlOwnedContentPages(input: {
  url: string;
  limits?: Partial<OwnedContentCrawlLimits>;
  fetchImpl?: FetchLike;
  generatedAt?: Date;
  validatePublicUrl?: boolean;
  onProgress?: (event: OwnedContentCrawlProgress) => void;
}) {
  const limits = {
    ...DEFAULT_OWNED_CONTENT_CRAWL_LIMITS,
    ...input.limits,
  };
  const fetchImpl = input.fetchImpl ?? fetch;
  const websiteUrl = input.validatePublicUrl === false
    ? normalizeUrl(new URL(withProtocol(input.url)))
    : await normalizeAndValidatePublicUrl(input.url);
  const baseUrl = new URL(websiteUrl);
  const lastCrawledAt = (input.generatedAt ?? new Date()).toISOString();
  const candidates = new Map<string, { url: string; depth: number; discoveredFrom: string[] }>();
  const pages: OwnedContentPage[] = [];
  const processed = new Set<string>();
  const canonicalSeen = new Set<string>();

  addCandidate(candidates, baseUrl.toString(), 0, "seed");
  for (const path of COMMON_PATHS) {
    addCandidate(candidates, new URL(path, baseUrl).toString(), 0, "common_path");
  }

  for (const sitemapUrl of sitemapSeedUrls(baseUrl)) {
    const sitemapLinks = await discoverSitemapLinks({
      url: sitemapUrl,
      baseUrl,
      fetchImpl,
      limits,
    });
    for (const link of sitemapLinks) {
      addCandidate(candidates, link, 0, "sitemap");
    }
  }

  while (pages.length < limits.maxPages) {
    const next = [...candidates.values()].find((candidate) => {
      const key = crawlKey(candidate.url);
      return key && !processed.has(key);
    });
    if (!next) break;

    const key = crawlKey(next.url);
    if (!key) continue;
    processed.add(key);
    const index = pages.length + 1;
    input.onProgress?.({
      phase: "crawl_page",
      status: "start",
      url: next.url,
      index,
      maxPages: limits.maxPages,
    });

    const page = await fetchOwnedContentPage({
      url: next.url,
      baseUrl,
      fetchImpl,
      limits,
      discoveredFrom: next.discoveredFrom,
      lastCrawledAt,
    });

    if (!page) continue;
    if (page.crawlStatus === "failed" && page.discoveredFrom.every((source) => source === "common_path")) {
      input.onProgress?.({
        phase: "crawl_page",
        status: "skipped",
        url: next.url,
        index,
        maxPages: limits.maxPages,
        failureReason: page.failureReason,
      });
      continue;
    }

    const canonicalKey = page.crawlStatus === "success" ? crawlKey(page.canonicalUrl || page.url) : null;
    if (canonicalKey) {
      if (canonicalSeen.has(canonicalKey)) {
        input.onProgress?.({
          phase: "crawl_page",
          status: "skipped",
          url: page.url,
          index,
          maxPages: limits.maxPages,
          pageType: page.pageType,
        });
        continue;
      }
      canonicalSeen.add(canonicalKey);
    }

    pages.push(page);
    input.onProgress?.({
      phase: "crawl_page",
      status: page.crawlStatus,
      url: page.url,
      index,
      maxPages: limits.maxPages,
      pageType: page.pageType,
      failureReason: page.failureReason,
    });

    if (page.crawlStatus === "success" && next.depth < limits.maxDepth) {
      const html = "rawHtml" in page ? page.rawHtml ?? "" : "";
      for (const link of extractOwnedLinks(html, page.url, baseUrl)) {
        addCandidate(candidates, link, next.depth + 1, "same_domain_link");
      }
    }
  }

  return pages.map((page) => {
    const { rawHtml: _rawHtml, ...publicPage } = page as OwnedContentPage & { rawHtml?: string };
    return publicPage;
  });
}

async function discoverSitemapLinks(input: {
  url: string;
  baseUrl: URL;
  fetchImpl: FetchLike;
  limits: OwnedContentCrawlLimits;
  depth?: number;
}): Promise<string[]> {
  if ((input.depth ?? 0) > 1) return [];

  const response = await fetchText({
    url: input.url,
    fetchImpl: input.fetchImpl,
    limits: input.limits,
    accept: "application/xml,text/xml,text/plain,*/*;q=0.1",
  }).catch(() => null);
  if (!response?.text) return [];

  const locs = [...response.text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => decodeHtml(match[1] ?? "").trim())
    .filter(Boolean);

  const nestedSitemaps = locs.filter((url) => /sitemap[^/]*\.xml/i.test(url)).slice(0, 8);
  const pages = locs.filter((url) => isOwnedPageUrl(url, input.baseUrl));

  for (const sitemap of nestedSitemaps) {
    const nested = await discoverSitemapLinks({
      ...input,
      url: sitemap,
      depth: (input.depth ?? 0) + 1,
    });
    pages.push(...nested);
  }

  return [...new Set(pages)].slice(0, input.limits.maxPages * 3);
}

async function fetchOwnedContentPage(input: {
  url: string;
  baseUrl: URL;
  fetchImpl: FetchLike;
  limits: OwnedContentCrawlLimits;
  discoveredFrom: string[];
  lastCrawledAt: string;
}): Promise<(OwnedContentPage & { rawHtml?: string }) | null> {
  if (!isOwnedPageUrl(input.url, input.baseUrl)) return null;
  const normalizedUrl = normalizeUrl(new URL(input.url));

  try {
    const response = await fetchText({
      url: normalizedUrl,
      fetchImpl: input.fetchImpl,
      limits: input.limits,
      accept: "text/html,application/xhtml+xml,*/*;q=0.1",
    });
    const contentType = response.contentType;
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return failedPage({
        url: normalizedUrl,
        discoveredFrom: input.discoveredFrom,
        lastCrawledAt: input.lastCrawledAt,
        httpStatus: response.httpStatus,
        failureReason: `Unsupported content type: ${contentType || "unknown"}`,
      });
    }

    return pageFromHtml({
      url: response.url,
      html: response.text,
      discoveredFrom: input.discoveredFrom,
      lastCrawledAt: input.lastCrawledAt,
      httpStatus: response.httpStatus,
    });
  } catch (error) {
    return failedPage({
      url: normalizedUrl,
      discoveredFrom: input.discoveredFrom,
      lastCrawledAt: input.lastCrawledAt,
      failureReason: error instanceof Error ? error.message : String(error),
    });
  }
}

function pageFromHtml(input: {
  url: string;
  html: string;
  discoveredFrom: string[];
  lastCrawledAt: string;
  httpStatus: number;
}): OwnedContentPage & { rawHtml: string } {
  const title = extractTitle(input.html);
  const h1 = firstTagText(input.html, "h1");
  const metaDescription = metaContent(input.html, "description") || metaContent(input.html, "og:description");
  const canonical = extractCanonicalUrl(input.html, input.url) ?? input.url;
  const text = htmlToText(input.html);
  const headings = extractHeadings(input.html);
  const publishedAt =
    metaContent(input.html, "article:published_time") ||
    jsonLdDate(input.html, "datePublished") ||
    timeDatetime(input.html);
  const updatedAt =
    metaContent(input.html, "article:modified_time") ||
    jsonLdDate(input.html, "dateModified") ||
    "";

  return {
    url: input.url,
    canonicalUrl: canonical,
    title,
    h1,
    metaDescription,
    headings,
    excerpt: text.slice(0, 5000),
    publishedAt: publishedAt || null,
    updatedAt: updatedAt || null,
    lastCrawledAt: input.lastCrawledAt,
    pageType: classifyPageType({
      url: input.url,
      title,
      h1,
      headings,
    }),
    discoveredFrom: [...new Set(input.discoveredFrom)],
    crawlStatus: "success",
    httpStatus: input.httpStatus,
    failureReason: null,
    summary: null,
    primaryTopic: null,
    secondaryTopics: [],
    contentRole: null,
    audience: null,
    keyClaims: [],
    understandingStatus: "pending",
    understandingFailureReason: null,
    rawHtml: input.html,
  };
}

function failedPage(input: {
  url: string;
  discoveredFrom: string[];
  lastCrawledAt: string;
  httpStatus?: number;
  failureReason: string;
}): OwnedContentPage {
  return {
    url: input.url,
    canonicalUrl: input.url,
    title: "",
    h1: "",
    metaDescription: "",
    headings: [],
    excerpt: "",
    publishedAt: null,
    updatedAt: null,
    lastCrawledAt: input.lastCrawledAt,
    pageType: "other",
    discoveredFrom: [...new Set(input.discoveredFrom)],
    crawlStatus: "failed",
    httpStatus: input.httpStatus ?? null,
    failureReason: input.failureReason.slice(0, 500),
    summary: null,
    primaryTopic: null,
    secondaryTopics: [],
    contentRole: null,
    audience: null,
    keyClaims: [],
    understandingStatus: "skipped",
    understandingFailureReason: null,
  };
}

async function fetchText(input: {
  url: string;
  fetchImpl: FetchLike;
  limits: OwnedContentCrawlLimits;
  accept: string;
}) {
  const response = await input.fetchImpl(input.url, {
    redirect: "follow",
    signal: AbortSignal.timeout(input.limits.timeoutMs),
    headers: {
      "User-Agent": "ContentDesk-OwnedContentCrawler/0.1",
      Accept: input.accept,
    },
  });

  const text = await readCappedText(response, input.limits.maxBytes);
  return {
    url: response.url || input.url,
    httpStatus: response.status,
    contentType: response.headers.get("content-type") ?? "",
    text,
  };
}

async function readCappedText(response: Response, byteLimit: number) {
  if (!response.ok) {
    throw new Error(`Fetch failed with ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) return response.text();

  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > byteLimit) throw new Error("Response exceeded size limit.");
    chunks.push(value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

function addCandidate(
  candidates: Map<string, { url: string; depth: number; discoveredFrom: string[] }>,
  value: string,
  depth: number,
  discoveredFrom: string,
) {
  const key = crawlKey(value);
  if (!key) return;

  const existing = candidates.get(key);
  if (existing) {
    existing.depth = Math.min(existing.depth, depth);
    existing.discoveredFrom = [...new Set([...existing.discoveredFrom, discoveredFrom])];
    return;
  }

  candidates.set(key, {
    url: normalizeUrl(new URL(value)),
    depth,
    discoveredFrom: [discoveredFrom],
  });
}

function extractOwnedLinks(html: string, sourceUrl: string, baseUrl: URL) {
  const links = new Set<string>();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const href = match[1] ?? "";
    let url: string;
    try {
      url = new URL(href, sourceUrl).toString();
    } catch {
      continue;
    }
    if (isOwnedPageUrl(url, baseUrl)) links.add(normalizeUrl(new URL(url)));
  }

  return [...links];
}

function isOwnedPageUrl(value: string, baseUrl: URL) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.hostname.replace(/^www\./, "") !== baseUrl.hostname.replace(/^www\./, "")) {
    return false;
  }
  if (!["http:", "https:"].includes(url.protocol)) return false;
  if (url.searchParams.size > 0) return false;

  const pathname = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
  if (/\.(png|jpe?g|gif|webp|svg|css|js|json|pdf|zip|mp4|mov|xml|ico|woff2?)$/i.test(pathname)) {
    return false;
  }
  if (/\/(tag|tags|category|author|account|cart|checkout|login|signup|wp-json|privacy|terms|cookies?)(\/|$)/i.test(pathname)) {
    return false;
  }

  return true;
}

function classifyPageType(input: {
  url: string;
  title: string;
  h1: string;
  headings: string[];
}): OwnedContentPageType {
  const url = new URL(input.url);
  const path = url.pathname.toLowerCase().replace(/\/+$/, "") || "/";
  const text = [path, input.title, input.h1, ...input.headings.slice(0, 3)].join(" ").toLowerCase();

  if (path === "/") return "homepage";
  if (path === "/blog") return "blog";
  if (path === "/about" || /^\/about(\/|$)/.test(path)) return "about";
  if (path === "/faq" || /^\/faqs?(\/|$)/.test(path)) return "faq";
  if (path === "/pricing" || /^\/pricing(\/|$)/.test(path) || /^\/plans?(\/|$)/.test(path)) return "pricing";
  if (path === "/contact" || /^\/contact(\/|$)/.test(path)) return "other";
  if (/^\/docs?(\/|$)|^\/documentation(\/|$)|^\/help(\/|$)|^\/support(\/|$)/.test(path)) return "docs";
  if (/^\/guides?(\/|$)/.test(path)) return "guide";
  if (/^\/resources?(\/|$)/.test(path)) return "resources";
  if (/^\/integrations?(\/|$)/.test(path)) return "integration";
  if (/^\/case-studies(\/|$)|^\/customers?(\/|$)/.test(path)) return "case_study";
  if (/^\/alternatives?(\/|$)/.test(path)) return "alternative";
  if (/^\/comparisons?(\/|$)|^\/compare(\/|$)/.test(path)) return "comparison";
  if (/\babout\b/.test(text)) return "about";
  if (/\bfaq|frequently asked\b/.test(text)) return "faq";
  if (/\b(case-studies|case-studies|case study|customers?)\b/.test(text)) return "case_study";
  if (/\bintegrations?\b/.test(text)) return "integration";
  if (/\balternatives?\b/.test(text)) return "alternative";
  if (/\bcompare|comparison| versus | vs\.? \b/.test(text)) return "comparison";
  if (/\bpricing\b|\bplans?\b/.test(text)) return "pricing";
  if (/\bdocs?|documentation\b/.test(text)) return "docs";
  if (/\/blog(\/|$)/.test(path)) return "blog_article";

  return "other";
}

function sitemapSeedUrls(baseUrl: URL) {
  return [
    new URL("/sitemap.xml", baseUrl).toString(),
    new URL("/sitemap_index.xml", baseUrl).toString(),
  ];
}

function crawlKey(value: string) {
  try {
    const url = new URL(value);
    return normalizeUrl(url);
  } catch {
    return null;
  }
}

function normalizeUrl(url: URL) {
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function withProtocol(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function extractTitle(html: string) {
  return cleanText(decodeHtml((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").trim()));
}

function metaContent(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match =
    html.match(
      new RegExp(
        `<meta\\b[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`,
        "i",
      ),
    ) ||
    html.match(
      new RegExp(
        `<meta\\b[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`,
        "i",
      ),
    );

  return match ? cleanText(decodeHtml(match[1] ?? "")) : "";
}

function extractCanonicalUrl(html: string, sourceUrl: string) {
  const match = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  if (!match?.[1]) return null;

  try {
    return normalizeUrl(new URL(decodeHtml(match[1]), sourceUrl));
  } catch {
    return null;
  }
}

function firstTagText(html: string, tag: string) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(stripTags(decodeHtml(match[1] ?? ""))) : "";
}

function extractHeadings(html: string) {
  return [...html.matchAll(/<h[2-3]\b[^>]*>([\s\S]*?)<\/h[2-3]>/gi)]
    .map((match) => cleanText(stripTags(decodeHtml(match[1] ?? ""))))
    .filter(Boolean)
    .slice(0, 24);
}

function timeDatetime(html: string) {
  return html.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
}

function jsonLdDate(html: string, field: "datePublished" | "dateModified") {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`"${escaped}"\\s*:\\s*"([^"]+)"`, "i"))?.[1] ?? "";
}

function htmlToText(html: string) {
  return cleanText(
    decodeHtml(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
