import type { ResearchObjective } from "@/lib/research/provider";
import { ParallelResearchProvider } from "@/lib/research/parallel";
import { profileSite } from "@/lib/reddit-teardown/site-profiler";
import type { SiteProfile } from "@/lib/reddit-teardown/schemas";
import type { AssetInventoryItem, Competitor } from "@/lib/prompt-scan/schemas";
import {
  buyerPromptStrategyInputSchema,
  type BuyerPromptStrategyInput,
} from "@/lib/buyer-prompt-strategist/schemas";
import type { ResearchSource } from "@/lib/schemas";

export type InferredBuyerPromptStrategy = {
  strategy: BuyerPromptStrategyInput;
  siteProfile: SiteProfile;
  researchSources: ResearchSource[];
};

export async function inferBuyerPromptStrategyFromWebsite(input: {
  url: string;
  portfolioSize?: number;
}): Promise<InferredBuyerPromptStrategy> {
  const siteProfile = await profileSite(input.url);
  const baseStrategy = buildStrategyFromSiteProfile({
    siteProfile,
    portfolioSize: input.portfolioSize,
  });
  const researchSources = await discoverMarketSources(baseStrategy).catch(() => []);
  const competitors = inferCompetitors({
    brandName: baseStrategy.brand.name,
    brandDomains: baseStrategy.brand.domains,
    sources: researchSources,
  });

  const strategy = buyerPromptStrategyInputSchema.parse({
    ...baseStrategy,
    competitors: competitors.length > 0 ? competitors : baseStrategy.competitors,
  });

  return {
    strategy,
    siteProfile,
    researchSources,
  };
}

export function buildStrategyFromSiteProfile(input: {
  siteProfile: SiteProfile;
  portfolioSize?: number;
}): BuyerPromptStrategyInput {
  const { siteProfile } = input;
  const combinedText = [
    siteProfile.title,
    siteProfile.headline,
    siteProfile.metaDescription,
    siteProfile.summary,
    siteProfile.problemSolved,
    ...siteProfile.featuresUseCases,
    ...siteProfile.existingContent.map((page) => page.excerpt),
  ].join(" ");
  const audience = inferAudience(combinedText, siteProfile.audienceGuess);
  const category = inferCategory(combinedText, siteProfile);
  const primaryUseCases = inferPrimaryUseCases(siteProfile);
  const primaryUseCase = primaryUseCases[0] ?? category;
  const conversionGoal = inferConversionGoal(combinedText);
  const problemPain = normalizePain(siteProfile.problemSolved, primaryUseCase);
  const domain = new URL(siteProfile.websiteUrl).hostname.replace(/^www\./, "");
  const brandName = inferBrandName(siteProfile, domain);

  return buyerPromptStrategyInputSchema.parse({
    brand: {
      name: brandName,
      aliases: aliasCandidates(brandName),
      domains: [domain],
    },
    provider: "perplexity",
    defaultRecheckDays: 1,
    experimentWindowDays: {
      min: 30,
      max: 60,
    },
    audience,
    category,
    positioning: siteProfile.summary,
    conversionGoal,
    primaryUseCases,
    portfolioSize: input.portfolioSize ?? 10,
    buyerJobs: [
      {
        id: "solve-core-problem",
        group: "problem_aware",
        job: `Find a better way to ${problemPain}.`,
        pain: problemPain,
        commercialCloseness: 3,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "find-category-tools",
        group: "category_search",
        job: `Discover which ${category} options exist for ${audience}.`,
        pain: `find ${category} options for ${audience}`,
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "understand-workflow",
        group: "solution_aware",
        job: `Understand whether ${category} can handle ${primaryUseCase}.`,
        pain: `understand how ${category} works for ${primaryUseCase}`,
        commercialCloseness: 3,
        productFit: 5,
        assetOpportunity: 4,
      },
      {
        id: "compare-alternatives",
        group: "competitor_comparison",
        job: `Compare known ${category} options and decide which one fits ${audience}.`,
        pain: `compare ${category} alternatives for ${primaryUseCase}`,
        commercialCloseness: 5,
        productFit: 5,
        assetOpportunity: 5,
      },
      {
        id: "prepare-workflow",
        group: "integration_use_case",
        job: `Prepare ${primaryUseCase} for ${conversionGoal}.`,
        pain: `prepare ${primaryUseCase} for ${conversionGoal}`,
        commercialCloseness: 4,
        productFit: 5,
        assetOpportunity: 3,
      },
      {
        id: "choose-product",
        group: "high_intent_purchase",
        job: `Choose the ${category} to try or buy.`,
        pain: `choose the right ${category} for ${audience}`,
        commercialCloseness: 5,
        productFit: 5,
        assetOpportunity: 5,
      },
    ],
    competitors: [],
    assetInventory: inferAssetInventory(siteProfile),
  });
}

async function discoverMarketSources(strategy: BuyerPromptStrategyInput) {
  const apiKey = process.env.PARALLEL_API_KEY;
  if (!apiKey) return [];

  const provider = new ParallelResearchProvider(apiKey);
  const objectives: ResearchObjective[] = [
    {
      objective: `Find competitors, alternatives, directories, and review/list pages for ${strategy.brand.name}, a ${strategy.category} for ${strategy.audience}.`,
      searchQueries: [
        `${strategy.brand.name} ${strategy.category} alternatives`,
        `best ${strategy.category} for ${strategy.audience}`,
        `${strategy.primaryUseCases[0]} ${strategy.audience} tools`,
      ],
    },
  ];
  const searched = await provider.search(objectives);
  return provider.extract(searched, objectives);
}

function inferCompetitors(input: {
  brandName: string;
  brandDomains: string[];
  sources: ResearchSource[];
}): Competitor[] {
  const blockedDomains = new Set([
    ...input.brandDomains,
    "google.com",
    "youtube.com",
    "reddit.com",
    "shopify.com",
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
  ]);
  const byName = new Map<string, Competitor>();

  for (const source of input.sources) {
    const domain = safeDomain(source.url);
    if (!domain || blockedDomains.has(domain)) continue;
    if (isPublisherDomain(domain)) continue;

    const name = inferNameFromSource(source, domain);
    if (!name || sameName(name, input.brandName)) continue;
    if (isGenericSourceName(name)) continue;

    const existing = byName.get(name.toLowerCase());
    byName.set(name.toLowerCase(), {
      name,
      aliases: existing?.aliases ?? [],
      domains: [...new Set([...(existing?.domains ?? []), domain])],
    });
  }

  return [...byName.values()].slice(0, 6);
}

function inferAudience(text: string, fallback: string) {
  const lower = text.toLowerCase();
  if (lower.includes("shopify") && /\b(fashion|apparel|clothing|boutique)\b/.test(lower)) {
    return "Shopify fashion brands";
  }
  if (lower.includes("shopify")) return "Shopify merchants";
  if (/\bdeveloper|api|sdk\b/.test(lower)) return "developers";
  if (/\bsales|pipeline|crm\b/.test(lower)) return "sales teams";
  if (/\bmarketing|marketer|campaign\b/.test(lower)) return "marketing teams";

  return fallback;
}

function inferCategory(text: string, siteProfile: SiteProfile) {
  const lower = text.toLowerCase();
  if (lower.includes("shopify") && lower.includes("model") && lower.includes("photo")) {
    return "AI model photo app";
  }
  if (lower.includes("shopify") && lower.includes("photo")) return "AI product photography app";
  if (/\bseo|aeo|content\b/.test(lower) && lower.includes("shopify")) {
    return "Shopify content visibility tool";
  }
  if (/\banalytics|dashboard|reporting\b/.test(lower)) return "analytics tool";
  if (/\bcrm|sales\b/.test(lower)) return "sales tool";

  const titleCategory = siteProfile.title
    .replace(siteProfile.companyName, "")
    .replace(/[|:—-]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");

  return titleCategory || "software product";
}

function inferPrimaryUseCases(siteProfile: SiteProfile) {
  const combinedText = [
    ...siteProfile.featuresUseCases,
    siteProfile.problemSolved,
    siteProfile.headline,
  ].join(" ");
  const normalized = normalizeKnownUseCases(combinedText);
  if (normalized.length > 0) return normalized.slice(0, 3);

  const candidates = [
    ...siteProfile.featuresUseCases,
    siteProfile.problemSolved,
    siteProfile.headline,
  ]
    .map((value) => cleanupUseCase(value))
    .filter(Boolean);

  return [...new Set(candidates)].slice(0, 3);
}

function inferConversionGoal(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("shopify") && /\b(product page|pdp|catalog|launch)\b/.test(lower)) {
    return "a Shopify product page launch";
  }
  if (/\binstall|app store|shopify app\b/.test(lower)) return "a Shopify app install";
  if (/\bdemo|book a call|sales\b/.test(lower)) return "a demo request";
  if (/\bsign up|get started|trial\b/.test(lower)) return "a product trial";

  return "a buying decision";
}

function inferAssetInventory(siteProfile: SiteProfile): AssetInventoryItem[] {
  const pageByKind = new Map(siteProfile.existingContent.map((page) => [page.kind, page]));
  const homepage = pageByKind.get("homepage");
  const blog = pageByKind.get("blog") ?? pageByKind.get("resources");
  const docs = pageByKind.get("docs") ?? pageByKind.get("faq");

  return [
    {
      type: "shopify_app_store_listing",
      status: "unknown",
      notes: "Infer from website/search later; not confirmed from standard site crawl.",
    },
    {
      type: "homepage",
      status: homepage ? "present" : "unknown",
      url: homepage?.url,
      notes: "Homepage found during website profiling.",
    },
    {
      type: "comparison_page",
      status: "missing",
      notes: "No canonical comparison page found during standard site crawl.",
    },
    {
      type: "alternative_page",
      status: "missing",
      notes: "No alternatives page found during standard site crawl.",
    },
    {
      type: "blog_guide",
      status: blog ? "present" : "unknown",
      url: blog?.url,
      notes: blog ? "Blog/resources page found." : "Blog coverage not confirmed.",
    },
    {
      type: "docs_help",
      status: docs ? "present" : "unknown",
      url: docs?.url,
      notes: docs ? "Docs/help page found." : "Docs/help coverage not confirmed.",
    },
    {
      type: "reddit_community_mention",
      status: "unknown",
      notes: "Community mentions require separate search.",
    },
    {
      type: "youtube_video",
      status: "unknown",
      notes: "Video proof requires separate search.",
    },
    {
      type: "review_profile",
      status: "unknown",
      notes: "Review profiles require separate search.",
    },
    {
      type: "case_study",
      status: "unknown",
      notes: "Case studies require separate search.",
    },
  ];
}

function aliasCandidates(name: string) {
  const compact = name.replace(/\s+/g, "");
  return compact.toLowerCase() === name.toLowerCase() ? [] : [compact];
}

function normalizePain(problem: string, fallback: string) {
  const lower = problem.toLowerCase();
  if (lower.includes("model") && lower.includes("photo") && lower.includes("without")) {
    return "create model photos without hiring models or booking a photoshoot";
  }
  if (lower.includes("flat") && lower.includes("model")) {
    return "turn flat lay photos into model photos";
  }
  if (fallback.toLowerCase().includes("photo")) {
    return `create ${fallback} without a traditional photoshoot`;
  }

  const cleaned = problem
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!cleaned || cleaned.length > 140) return fallback;

  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

function cleanupUseCase(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("on-model") || (lower.includes("model") && lower.includes("photo"))) {
    return "AI on-model product photos";
  }
  if (lower.includes("flat") && lower.includes("model")) {
    return "turning flat lay photos into model photos";
  }
  if (lower.includes("product page") || lower.includes("shopify product")) {
    return "Shopify product page photos";
  }

  return value
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim()
    .slice(0, 120);
}

function normalizeKnownUseCases(text: string) {
  const lower = text.toLowerCase();
  const useCases: string[] = [];
  if (lower.includes("on-model") || (lower.includes("model") && lower.includes("photo"))) {
    useCases.push("AI on-model product photos");
  }
  if (lower.includes("flat") && lower.includes("model")) {
    useCases.push("turning flat lay photos into model photos");
  }
  if (lower.includes("shopify") && lower.includes("product page")) {
    useCases.push("Shopify product page photos");
  }

  return useCases;
}

function safeDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function inferNameFromSource(source: ResearchSource, domain: string) {
  const titleName = (source.title || "")
    .split(/[|:—-]/)[0]
    ?.replace(/\b(alternatives?|reviews?|pricing|comparison|vs\.?)\b/gi, "")
    .trim();
  if (titleName && titleName.length <= 40 && /^[A-Z0-9]/.test(titleName)) {
    return titleName;
  }

  return domain
    .split(".")[0]
    ?.replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function inferBrandName(siteProfile: SiteProfile, domain: string) {
  const raw = siteProfile.companyName.trim();
  const titleBrand = siteProfile.title
    .split(/\b(shopify|app|software|tool|ai|model|photo|photos)\b/i)[0]
    ?.replace(/[|:—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (titleBrand && titleBrand.length >= 2 && titleBrand.length <= 32) {
    return titleBrand;
  }

  if (
    raw &&
    raw.length <= 32 &&
    !/\b(shopify|app|software|tool|ai|model|photo|photos)\b/i.test(raw)
  ) {
    return raw;
  }

  return domain
    .split(".")[0]
    ?.replace(/tiny/i, "Tiny ")
    ?.replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || raw || "Brand";
}

function sameName(left: string, right: string) {
  return normalizeName(left) === normalizeName(right);
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isGenericSourceName(name: string) {
  const trimmed = name.trim();
  if (/^\d/.test(trimmed)) return true;
  if (/^ai\s+(on|product|photo|image|photography)$/i.test(trimmed)) return true;
  if (/^(ai\s+)?product photography$/i.test(trimmed)) return true;
  return /^(best|top|compare|comparison|alternatives|shopify|app store|product hunt)\b/i.test(
    trimmed,
  );
}

function isPublisherDomain(domain: string) {
  return /\b(blog|review|reviews|directory|directories|dropshipping|ecommerce|commerce|news)\b/i.test(
    domain,
  );
}
