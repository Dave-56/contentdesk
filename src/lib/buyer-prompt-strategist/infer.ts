import type { SiteProfile } from "@/lib/reddit-teardown/schemas";
import type { AssetInventoryItem, Competitor } from "@/lib/prompt-scan/schemas";
import {
  buyerPromptStrategyInputSchema,
  type BuyerPromptMarketClassification,
  type BuyerPromptStrategyInput,
  type PerplexityBusinessRead,
} from "@/lib/buyer-prompt-strategist/schemas";
import type { ResearchSource } from "@/lib/schemas";
import {
  assertProfileEvidence,
  profileBusinessForBuyerPrompts,
} from "@/lib/buyer-prompt-strategist/site-profile";

export type InferredBuyerPromptStrategy = {
  strategy: BuyerPromptStrategyInput;
  siteProfile: SiteProfile;
  researchSources: ResearchSource[];
};

export async function inferBuyerPromptStrategyFromWebsite(input: {
  url: string;
  portfolioSize?: number;
}): Promise<InferredBuyerPromptStrategy> {
  const { siteProfile, businessRead, researchSources } =
    await profileBusinessForBuyerPrompts({ url: input.url });
  assertProfileEvidence(siteProfile);
  const strategy = buildStrategyFromBusinessRead({
    siteProfile,
    businessRead,
    portfolioSize: input.portfolioSize,
  });

  return {
    strategy,
    siteProfile,
    researchSources,
  };
}

export function buildStrategyFromBusinessRead(input: {
  siteProfile: SiteProfile;
  businessRead: PerplexityBusinessRead;
  portfolioSize?: number;
}): BuyerPromptStrategyInput {
  const { businessRead, siteProfile } = input;
  const domain = new URL(siteProfile.websiteUrl).hostname.replace(/^www\./, "");
  const competitors = businessRead.competitors
    .filter((competitor) => competitor.clearAlternative && competitor.confidence >= 3)
    .map<Competitor>((competitor) => ({
      name: competitor.name,
      aliases: competitor.aliases,
      domains: competitor.domains,
    }))
    .slice(0, 6);

  return buyerPromptStrategyInputSchema.parse({
    brand: {
      name: businessRead.brandName,
      aliases: aliasCandidates(businessRead.brandName),
      domains: [domain],
    },
    provider: "perplexity",
    defaultRecheckDays: 1,
    experimentWindowDays: {
      min: 30,
      max: 60,
    },
    audience: businessRead.audience,
    category: businessRead.category,
    positioning: businessRead.positioning,
    conversionGoal: businessRead.conversionGoal,
    primaryUseCases: businessRead.primaryUseCases,
    market: businessRead.market,
    buyerLanguage: businessRead.buyerLanguage,
    classificationWarnings: siteProfile.profileWarnings,
    portfolioSize: input.portfolioSize ?? 10,
    buyerJobs: buildBuyerJobs({
      audience: businessRead.audience,
      category: businessRead.category,
      primaryUseCase: businessRead.buyerLanguage.useCaseNoun,
      conversionGoal: businessRead.buyerLanguage.conversionNoun,
      problemPain: businessRead.buyerLanguage.painNoun,
    }),
    competitors,
    assetInventory: inferAssetInventory(siteProfile, businessRead.market),
  });
}

export function buildStrategyFromMarketClassification(input: {
  siteProfile: SiteProfile;
  classification: BuyerPromptMarketClassification;
  portfolioSize?: number;
}): BuyerPromptStrategyInput {
  const { classification, siteProfile } = input;
  const domain = new URL(siteProfile.websiteUrl).hostname.replace(/^www\./, "");
  const primaryUseCase = classification.buyerLanguage.useCaseNoun;
  const problemPain = classification.buyerLanguage.painNoun;

  return buyerPromptStrategyInputSchema.parse({
    brand: {
      name: classification.brandName,
      aliases: aliasCandidates(classification.brandName),
      domains: [domain],
    },
    provider: "perplexity",
    defaultRecheckDays: 1,
    experimentWindowDays: {
      min: 30,
      max: 60,
    },
    audience: classification.audience,
    category: classification.category,
    positioning: classification.positioning,
    conversionGoal: classification.conversionGoal,
    primaryUseCases: classification.primaryUseCases,
    market: classification.market,
    buyerLanguage: classification.buyerLanguage,
    classificationWarnings: classification.warnings,
    portfolioSize: input.portfolioSize ?? 10,
    buyerJobs: buildBuyerJobs({
      audience: classification.audience,
      category: classification.category,
      primaryUseCase,
      conversionGoal: classification.buyerLanguage.conversionNoun,
      problemPain,
    }),
    competitors: [],
    assetInventory: inferAssetInventory(siteProfile, classification.market),
  });
}

export function buildStrategyFromSiteProfile(input: {
  siteProfile: SiteProfile;
  portfolioSize?: number;
  classificationError?: string;
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
  const market = inferMarket(combinedText);

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
    market,
    classificationWarnings: [
      {
        field: "buyerLanguage",
        message:
          input.classificationError
            ? `AI classification failed: ${input.classificationError.slice(0, 500)}`
            : "AI classification was unavailable. Fill buyerLanguage manually before running prompt:select.",
        severity: "manual_review",
      },
    ],
    portfolioSize: input.portfolioSize ?? 10,
    buyerJobs: buildBuyerJobs({
      audience,
      category,
      primaryUseCase,
      conversionGoal,
      problemPain,
    }),
    competitors: [],
    assetInventory: inferAssetInventory(siteProfile, market),
  });
}

function buildBuyerJobs(input: {
  audience: string;
  category: string;
  primaryUseCase: string;
  conversionGoal: string;
  problemPain: string;
}): BuyerPromptStrategyInput["buyerJobs"] {
  return [
    {
      id: "solve-core-problem",
      group: "problem_aware",
      job: `Find a better way to handle ${input.problemPain}.`,
      pain: input.problemPain,
      commercialCloseness: 3,
      productFit: 5,
      assetOpportunity: 4,
    },
    {
      id: "find-category-tools",
      group: "category_search",
      job: `Discover which ${input.category} options exist for ${input.audience}.`,
      pain: `finding ${input.category} options`,
      commercialCloseness: 4,
      productFit: 5,
      assetOpportunity: 4,
    },
    {
      id: "understand-workflow",
      group: "solution_aware",
      job: `Understand whether ${input.category} can handle ${input.primaryUseCase}.`,
      pain: `understanding ${input.category} workflows`,
      commercialCloseness: 3,
      productFit: 5,
      assetOpportunity: 4,
    },
    {
      id: "compare-alternatives",
      group: "competitor_comparison",
      job: `Compare known ${input.category} options and decide which one fits ${input.audience}.`,
      pain: `comparing ${input.category} alternatives`,
      commercialCloseness: 5,
      productFit: 5,
      assetOpportunity: 5,
    },
    {
      id: "prepare-workflow",
      group: "integration_use_case",
      job: `Prepare ${input.primaryUseCase} for ${input.conversionGoal}.`,
      pain: `preparing ${input.primaryUseCase}`,
      commercialCloseness: 4,
      productFit: 5,
      assetOpportunity: 3,
    },
    {
      id: "choose-product",
      group: "high_intent_purchase",
      job: `Choose the ${input.category} to try or buy.`,
      pain: `choosing the right ${input.category}`,
      commercialCloseness: 5,
      productFit: 5,
      assetOpportunity: 5,
    },
  ];
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
  // Broad, brand-neutral buckets only. Anything product-specific is the AI
  // classifier's job; this fallback must not assume any one product.
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

function inferMarket(text: string) {
  const lower = text.toLowerCase();
  if (
    lower.includes("shopify") &&
    /\b(app|merchant|store|product page|pdp|catalog|checkout|admin)\b/.test(lower)
  ) {
    return "shopify_app" as const;
  }

  return "saas" as const;
}

function inferPrimaryUseCases(siteProfile: SiteProfile) {
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

function inferAssetInventory(
  siteProfile: SiteProfile,
  market: BuyerPromptStrategyInput["market"] = "saas",
): AssetInventoryItem[] {
  const pageByKind = new Map(siteProfile.existingContent.map((page) => [page.kind, page]));
  const homepage = pageByKind.get("homepage");
  const blog = pageByKind.get("blog") ?? pageByKind.get("resources");
  const docs = pageByKind.get("docs") ?? pageByKind.get("faq");

  return [
    {
      type: "shopify_app_store_listing",
      status: market === "shopify_app" ? "unknown" : "missing",
      notes:
        market === "shopify_app"
          ? "Infer from website/search later; not confirmed from standard site crawl."
          : "Not classified as a Shopify app.",
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
  // Brand-neutral: lift the problem statement straight from site copy, no
  // product-specific rewriting. The AI classifier owns nuanced pain phrasing.
  const cleaned = problem
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
  if (!cleaned || cleaned.length > 140) return fallback;

  return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
}

function cleanupUseCase(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim()
    .slice(0, 120);
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
    ?.replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || raw || "Brand";
}
