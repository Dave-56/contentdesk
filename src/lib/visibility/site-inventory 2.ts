import { z } from "zod";
import {
  discoverBlogArticles,
  type BlogArticleCandidate,
} from "@/lib/article-memory";
import { profileSite } from "@/lib/reddit-teardown/site-profiler";
import type { DiscoveredPage, SiteProfile } from "@/lib/reddit-teardown/schemas";

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
  source: z.enum(["site_profile", "blog_discovery"]),
  excerpt: z.string(),
  headings: z.array(z.string()),
  publishedAt: z.string().nullable(),
});

export type OwnedSiteAsset = z.infer<typeof ownedSiteAssetSchema>;

export const ownedContentInventorySchema = z.object({
  brand: z.string().trim().min(1),
  websiteUrl: z.string().url(),
  generatedAt: z.string().datetime(),
  scope: z.literal("owned_site_raw_assets"),
  assets: z.array(ownedSiteAssetSchema),
  counts: z.object({
    total: z.number().int().min(0),
    siteProfilePages: z.number().int().min(0),
    blogArticles: z.number().int().min(0),
  }),
});

export type OwnedContentInventory = z.infer<typeof ownedContentInventorySchema>;

export async function profileOwnedSiteInventory(input: {
  url: string;
  generatedAt?: Date;
}) {
  const siteProfile = await profileSite(input.url);
  const blogArticles = await discoverBlogArticles(blogDiscoveryInputs(siteProfile));
  const inventory = buildOwnedContentInventory({
    siteProfile,
    blogArticles,
    generatedAt: input.generatedAt,
  });

  return {
    siteProfile,
    inventory,
  };
}

export function buildOwnedContentInventory(input: {
  siteProfile: SiteProfile;
  blogArticles?: BlogArticleCandidate[];
  generatedAt?: Date;
}): OwnedContentInventory {
  const siteAssets = input.siteProfile.existingContent.map(assetFromDiscoveredPage);
  const articleAssets = (input.blogArticles ?? []).map(assetFromBlogArticle);
  const assets = dedupeAssets([...siteAssets, ...articleAssets]);

  return ownedContentInventorySchema.parse({
    brand: input.siteProfile.companyName,
    websiteUrl: input.siteProfile.websiteUrl,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    scope: "owned_site_raw_assets",
    assets,
    counts: {
      total: assets.length,
      siteProfilePages: siteAssets.length,
      blogArticles: articleAssets.length,
    },
  });
}

function assetFromDiscoveredPage(page: DiscoveredPage): OwnedSiteAsset {
  return ownedSiteAssetSchema.parse({
    url: page.url,
    slug: slugFromUrl(page.url),
    title: page.title || titleFromSlug(slugFromUrl(page.url)) || page.kind,
    kind: page.kind,
    source: "site_profile",
    excerpt: page.excerpt,
    headings: [],
    publishedAt: null,
  });
}

function assetFromBlogArticle(article: BlogArticleCandidate): OwnedSiteAsset {
  return ownedSiteAssetSchema.parse({
    url: article.url,
    slug: article.slug,
    title: article.title,
    kind: "blog_article",
    source: "blog_discovery",
    excerpt: article.excerpt,
    headings: article.headings,
    publishedAt: article.publishedAt ?? null,
  });
}

function blogDiscoveryInputs(siteProfile: SiteProfile) {
  const urls = new Set<string>();
  const baseUrl = new URL(siteProfile.websiteUrl);
  urls.add(new URL("/blog", baseUrl).toString());

  for (const page of siteProfile.existingContent) {
    if (page.kind === "blog" || page.kind === "resources") {
      urls.add(page.url);
    }
  }

  return [...urls];
}

function dedupeAssets(assets: OwnedSiteAsset[]) {
  const byUrl = new Map<string, OwnedSiteAsset>();

  for (const asset of assets) {
    const key = normalizeAssetUrl(asset.url);
    const existing = byUrl.get(key);
    if (!existing || asset.source === "blog_discovery") {
      byUrl.set(key, asset);
    }
  }

  return [...byUrl.values()].sort((left, right) => left.url.localeCompare(right.url));
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
