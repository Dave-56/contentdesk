import { z } from "zod";
import {
  crawlOwnedContentPages,
  DEFAULT_OWNED_CONTENT_CRAWL_LIMITS,
  type OwnedContentCrawlProgress,
} from "@/lib/visibility/owned-content-crawler";
import {
  addOwnedContentUnderstanding,
  type OwnedContentUnderstandingProgress,
} from "@/lib/visibility/owned-content-understanding";
import type { BlogArticleCandidate } from "@/lib/article-memory";
import { profileSite } from "@/lib/reddit-teardown/site-profiler";
import type { DiscoveredPage, SiteProfile } from "@/lib/reddit-teardown/schemas";

const nullableText = z.string().nullable();

export const ownedContentPageTypeSchema = z.enum([
  "homepage",
  "about",
  "blog",
  "blog_article",
  "guide",
  "docs",
  "resources",
  "comparison",
  "alternative",
  "integration",
  "case_study",
  "pricing",
  "faq",
  "other",
]);

export type OwnedContentPageType = z.infer<typeof ownedContentPageTypeSchema>;

export const ownedContentCrawlLimitsSchema = z.object({
  maxPages: z.number().int().min(1),
  maxDepth: z.number().int().min(0),
  timeoutMs: z.number().int().min(1),
  maxBytes: z.number().int().min(1),
});

export type OwnedContentCrawlLimits = z.infer<typeof ownedContentCrawlLimitsSchema>;

export const ownedContentPageSchema = z.object({
  url: z.string().url(),
  canonicalUrl: z.string().url(),
  title: z.string(),
  h1: z.string(),
  metaDescription: z.string(),
  headings: z.array(z.string()),
  excerpt: z.string(),
  publishedAt: nullableText,
  updatedAt: nullableText,
  lastCrawledAt: z.string().datetime(),
  pageType: ownedContentPageTypeSchema,
  discoveredFrom: z.array(z.string().trim().min(1)),
  crawlStatus: z.enum(["success", "failed"]),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  failureReason: nullableText,
  summary: nullableText,
  primaryTopic: nullableText,
  secondaryTopics: z.array(z.string()),
  contentRole: nullableText,
  audience: nullableText,
  keyClaims: z.array(z.string()),
  understandingStatus: z.enum(["pending", "complete", "skipped", "failed"]),
  understandingFailureReason: nullableText.default(null),
});

export type OwnedContentPage = z.infer<typeof ownedContentPageSchema>;

export const ownedSiteAssetSchema = z.object({
  url: z.string().url(),
  slug: z.string().trim(),
  title: z.string().trim(),
  kind: z.enum([
    "homepage",
    "about",
    "pricing",
    "blog",
    "resources",
    "docs",
    "faq",
    "other",
    "blog_article",
  ]),
  source: z.enum(["site_profile", "blog_discovery", "owned_content_crawler"]),
  excerpt: z.string(),
  headings: z.array(z.string()),
  publishedAt: z.string().nullable(),
});

export type OwnedSiteAsset = z.infer<typeof ownedSiteAssetSchema>;

const ownedContentInventoryBaseSchema = z.object({
  schemaVersion: z.literal(1),
  brand: z.string().trim().min(1),
  websiteUrl: z.string().url(),
  generatedAt: z.string().datetime(),
  scope: z.literal("owned_site_raw_assets"),
  crawlLimits: ownedContentCrawlLimitsSchema,
  pages: z.array(ownedContentPageSchema),
  assets: z.array(ownedSiteAssetSchema),
  counts: z.object({
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    successfulPages: z.number().int().min(0),
    failedPages: z.number().int().min(0),
    siteProfilePages: z.number().int().min(0),
    blogArticles: z.number().int().min(0),
  }),
});

export const ownedContentInventorySchema = z.preprocess(
  normalizeInventoryInput,
  ownedContentInventoryBaseSchema,
);

export type OwnedContentInventory = z.infer<typeof ownedContentInventorySchema>;
export type OwnedContentInventoryProgress =
  | OwnedContentCrawlProgress
  | OwnedContentUnderstandingProgress;

export async function profileOwnedSiteInventory(input: {
  url: string;
  generatedAt?: Date;
  limits?: Partial<OwnedContentCrawlLimits>;
  includeUnderstanding?: boolean;
  onProgress?: (event: OwnedContentInventoryProgress) => void;
}) {
  const siteProfile = await profileSite(input.url);
  const inventory = await crawlOwnedSiteInventory({
    url: siteProfile.websiteUrl,
    brand: siteProfile.companyName,
    generatedAt: input.generatedAt,
    limits: input.limits,
    includeUnderstanding: input.includeUnderstanding,
    onProgress: input.onProgress,
  });

  return {
    siteProfile,
    inventory,
  };
}

export async function crawlOwnedSiteInventory(input: {
  url: string;
  brand: string;
  generatedAt?: Date;
  limits?: Partial<OwnedContentCrawlLimits>;
  includeUnderstanding?: boolean;
  onProgress?: (event: OwnedContentInventoryProgress) => void;
}) {
  const generatedAt = input.generatedAt ?? new Date();
  let pages = await crawlOwnedContentPages({
    url: input.url,
    limits: input.limits,
    generatedAt,
    onProgress: input.onProgress,
  });

  if (input.includeUnderstanding ?? true) {
    pages = await addOwnedContentUnderstanding({
      brand: input.brand,
      pages,
      onProgress: input.onProgress,
    });
  }

  return buildOwnedContentInventory({
    brand: input.brand,
    websiteUrl: input.url,
    generatedAt,
    limits: {
      ...DEFAULT_OWNED_CONTENT_CRAWL_LIMITS,
      ...input.limits,
    },
    pages,
  });
}

export function buildOwnedContentInventory(input: {
  siteProfile?: SiteProfile;
  blogArticles?: BlogArticleCandidate[];
  brand?: string;
  websiteUrl?: string;
  pages?: OwnedContentPage[];
  limits?: OwnedContentCrawlLimits;
  generatedAt?: Date;
}): OwnedContentInventory {
  const generatedAt = (input.generatedAt ?? new Date()).toISOString();
  const pages =
    input.pages ??
    pagesFromLegacyInputs({
      siteProfile: input.siteProfile,
      blogArticles: input.blogArticles,
      generatedAt,
    });
  const assets = dedupeAssets(pages.map(assetFromPage));
  const successfulPages = pages.filter((page) => page.crawlStatus === "success").length;
  const failedPages = pages.filter((page) => page.crawlStatus === "failed").length;
  const blogArticles = pages.filter((page) => page.pageType === "blog_article").length;
  const siteProfilePages = pages.length - blogArticles;

  return ownedContentInventorySchema.parse({
    schemaVersion: 1,
    brand: input.brand ?? input.siteProfile?.companyName ?? "Unknown brand",
    websiteUrl: input.websiteUrl ?? input.siteProfile?.websiteUrl,
    generatedAt,
    scope: "owned_site_raw_assets",
    crawlLimits: input.limits ?? DEFAULT_OWNED_CONTENT_CRAWL_LIMITS,
    pages,
    assets,
    counts: {
      total: assets.length,
      totalPages: pages.length,
      successfulPages,
      failedPages,
      siteProfilePages,
      blogArticles,
    },
  });
}

function pagesFromLegacyInputs(input: {
  siteProfile?: SiteProfile;
  blogArticles?: BlogArticleCandidate[];
  generatedAt: string;
}) {
  const sitePages = input.siteProfile?.existingContent.map((page) =>
    pageFromDiscoveredPage(page, input.generatedAt),
  ) ?? [];
  const articlePages = (input.blogArticles ?? []).map((article) =>
    pageFromBlogArticle(article, input.generatedAt),
  );

  return dedupePages([...sitePages, ...articlePages]);
}

function pageFromDiscoveredPage(
  page: DiscoveredPage,
  lastCrawledAt: string,
): OwnedContentPage {
  return ownedContentPageSchema.parse({
    url: page.url,
    canonicalUrl: page.url,
    title: page.title || titleFromSlug(slugFromUrl(page.url)) || page.kind,
    h1: "",
    metaDescription: "",
    headings: [],
    excerpt: page.excerpt,
    publishedAt: null,
    updatedAt: null,
    lastCrawledAt,
    pageType: page.kind,
    discoveredFrom: ["site_profile"],
    crawlStatus: "success",
    httpStatus: null,
    failureReason: null,
    summary: null,
    primaryTopic: null,
    secondaryTopics: [],
    contentRole: null,
    audience: null,
    keyClaims: [],
    understandingStatus: "pending",
    understandingFailureReason: null,
  });
}

function pageFromBlogArticle(
  article: BlogArticleCandidate,
  lastCrawledAt: string,
): OwnedContentPage {
  return ownedContentPageSchema.parse({
    url: article.url,
    canonicalUrl: article.url,
    title: article.title,
    h1: article.title,
    metaDescription: "",
    headings: article.headings,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt ?? null,
    updatedAt: null,
    lastCrawledAt,
    pageType: "blog_article",
    discoveredFrom: ["blog_discovery"],
    crawlStatus: "success",
    httpStatus: null,
    failureReason: null,
    summary: null,
    primaryTopic: null,
    secondaryTopics: [],
    contentRole: null,
    audience: null,
    keyClaims: [],
    understandingStatus: "pending",
    understandingFailureReason: null,
  });
}

function assetFromPage(page: OwnedContentPage): OwnedSiteAsset {
  return ownedSiteAssetSchema.parse({
    url: page.canonicalUrl || page.url,
    slug: slugFromUrl(page.canonicalUrl || page.url),
    title: page.title || page.h1 || titleFromSlug(slugFromUrl(page.url)) || page.pageType,
    kind: assetKindFromPageType(page.pageType),
    source: "owned_content_crawler",
    excerpt: page.summary || page.excerpt,
    headings: page.headings,
    publishedAt: page.publishedAt,
  });
}

function assetKindFromPageType(
  pageType: OwnedContentPage["pageType"],
): OwnedSiteAsset["kind"] {
  if (pageType === "blog_article") return "blog_article";
  if (pageType === "guide") return "blog_article";
  if (pageType === "resources") return "resources";
  if (pageType === "comparison" || pageType === "alternative") return "blog_article";
  if (pageType === "integration" || pageType === "case_study") return "other";
  if (pageType === "docs") return "docs";

  return pageType;
}

function dedupePages(pages: OwnedContentPage[]) {
  const byUrl = new Map<string, OwnedContentPage>();

  for (const page of pages) {
    const key = normalizeAssetUrl(page.canonicalUrl || page.url);
    const existing = byUrl.get(key);
    if (!existing || page.discoveredFrom.includes("blog_discovery")) {
      byUrl.set(key, page);
    }
  }

  return [...byUrl.values()].sort((left, right) => left.url.localeCompare(right.url));
}

function dedupeAssets(assets: OwnedSiteAsset[]) {
  const byUrl = new Map<string, OwnedSiteAsset>();

  for (const asset of assets) {
    const key = normalizeAssetUrl(asset.url);
    const existing = byUrl.get(key);
    if (!existing || asset.source === "owned_content_crawler") {
      byUrl.set(key, asset);
    }
  }

  return [...byUrl.values()].sort((left, right) => left.url.localeCompare(right.url));
}

function normalizeInventoryInput(value: unknown) {
  if (!value || typeof value !== "object") return value;
  const record = value as Partial<OwnedContentInventory> & {
    assets?: OwnedSiteAsset[];
    pages?: OwnedContentPage[];
    generatedAt?: string;
  };
  const generatedAt = record.generatedAt ?? new Date(0).toISOString();

  if (record.schemaVersion === 1 && record.pages && record.assets && record.crawlLimits) {
    return value;
  }

  const pages = record.pages ?? (record.assets ?? []).map((asset) =>
    pageFromLegacyAsset(asset, generatedAt),
  );
  const assets = record.assets ?? pages.map(assetFromPage);
  const successfulPages = pages.filter((page) => page.crawlStatus === "success").length;
  const failedPages = pages.filter((page) => page.crawlStatus === "failed").length;
  const blogArticles = pages.filter((page) => page.pageType === "blog_article").length;

  return {
    ...record,
    schemaVersion: 1,
    crawlLimits: record.crawlLimits ?? DEFAULT_OWNED_CONTENT_CRAWL_LIMITS,
    pages,
    assets,
    counts: {
      total: assets.length,
      totalPages: pages.length,
      successfulPages,
      failedPages,
      siteProfilePages: pages.length - blogArticles,
      blogArticles,
      ...(record.counts ?? {}),
    },
  };
}

function pageFromLegacyAsset(
  asset: OwnedSiteAsset,
  lastCrawledAt: string,
): OwnedContentPage {
  return ownedContentPageSchema.parse({
    url: asset.url,
    canonicalUrl: asset.url,
    title: asset.title,
    h1: "",
    metaDescription: "",
    headings: asset.headings,
    excerpt: asset.excerpt,
    publishedAt: asset.publishedAt,
    updatedAt: null,
    lastCrawledAt,
    pageType: asset.kind,
    discoveredFrom: [asset.source],
    crawlStatus: "success",
    httpStatus: null,
    failureReason: null,
    summary: null,
    primaryTopic: null,
    secondaryTopics: [],
    contentRole: null,
    audience: null,
    keyClaims: [],
    understandingStatus: "pending",
    understandingFailureReason: null,
  });
}

function normalizeAssetUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function slugFromUrl(value: string) {
  const url = new URL(value);
  return (
    url.pathname
      .replace(/\/+$/, "")
      .split("/")
      .filter(Boolean)
      .at(-1) ?? "homepage"
  );
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}
