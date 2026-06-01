import type { BrandProfile, ResearchSource } from "@/lib/schemas";
import type { ResearchObjective } from "@/lib/research/provider";

const SHOPIFY_SEED_SOURCES = [
  {
    url: "https://shopify.dev/docs/apps",
    title: "Shopify app development documentation",
    excerpt:
      "Shopify's app documentation explains how apps fit into merchant workflows, admin surfaces, extensions, and storefront operations.",
  },
  {
    url: "https://help.shopify.com/en/manual/apps",
    title: "Shopify Help Center: Apps",
    excerpt:
      "Shopify's merchant-facing app help covers app installation, permissions, configuration, usage, and app management concerns.",
  },
  {
    url: "https://www.shopify.com/blog",
    title: "Shopify Blog",
    excerpt:
      "Shopify's blog covers merchant education, ecommerce operations, seasonal planning, merchandising, and growth topics.",
  },
  {
    url: "https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
    title: "Google Search: Creating helpful, reliable, people-first content",
    excerpt:
      "Google's guidance emphasizes useful, reliable, people-first content with clear expertise and audience value.",
  },
];

export function seedResearchSources(
  profile: BrandProfile,
  objectives: ResearchObjective[],
): ResearchSource[] {
  const fetchedAt = new Date().toISOString();
  const primaryQuery = objectives[0]?.objective ?? `${profile.appName} Shopify research`;
  const profileSources = profile.existingBlogDocsUrls.map((url) => ({
    provider: "seed" as const,
    query: primaryQuery,
    url,
    title: `${profile.appName} existing content`,
    excerpt:
      "Existing brand blog or documentation URL from the Brand Profile. Use as context for content gaps, voice, and internal linking.",
    extractedMarkdown: "",
    fetchedAt,
  }));

  return [
    ...profileSources,
    ...SHOPIFY_SEED_SOURCES.map((source) => ({
      provider: "seed" as const,
      query: primaryQuery,
      ...source,
      extractedMarkdown: "",
      fetchedAt,
    })),
  ];
}

