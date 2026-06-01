import { generateText, Output } from "ai";
import { ParallelResearchProvider } from "@/lib/research/parallel";
import type { ResearchObjective } from "@/lib/research/provider";
import {
  teardownPacketSchema,
  type DiscoverySearch,
  type SiteProfile,
  type TeardownPacket,
} from "@/lib/reddit-teardown/schemas";
import { profileSite } from "@/lib/reddit-teardown/site-profiler";

const aiTeardownSchema = teardownPacketSchema.omit({
  websiteUrl: true,
  siteProfile: true,
  usedAi: true,
  usedSearchProvider: true,
});

export async function runRedditTeardown(input: { websiteUrl: string }): Promise<TeardownPacket> {
  const siteProfile = await profileSite(input.websiteUrl);
  const fallback = buildFallbackPacket(siteProfile);
  const searchSources = await discoverSources(fallback).catch(() => []);
  const aiPacket = await generateAiPacket({
    siteProfile,
    fallback,
    searchContext: searchSources
      .map((source) => `${source.title || source.url}: ${source.excerpt}`)
      .join("\n\n")
      .slice(0, 12000),
  }).catch(() => null);

  return teardownPacketSchema.parse({
    ...(aiPacket ?? fallback),
    websiteUrl: siteProfile.websiteUrl,
    siteProfile,
    usedAi: Boolean(aiPacket),
    usedSearchProvider: searchSources.length > 0,
  });
}

function buildFallbackPacket(siteProfile: SiteProfile): TeardownPacket {
  const category = inferCategory(siteProfile);
  const company = siteProfile.companyName;
  const audience = siteProfile.audienceGuess;
  const problem = siteProfile.problemSolved;
  const primaryUseCase = siteProfile.featuresUseCases[0] ?? problem;
  const discoverySearches = buildDiscoverySearches(category, company, audience);

  return {
    websiteUrl: siteProfile.websiteUrl,
    siteProfile,
    categoryGuess: category,
    categoryConfidence: "low",
    likelyCompetitorsOrSources: [],
    discoverySearches,
    buyerPrompts: [
      {
        prompt: `What are the best ${category} tools for ${audience}?`,
        intent: "best_tools",
        runIn: ["Google", "ChatGPT", "Perplexity"],
        lookFor: "Competitor names, directories, listicles, and comparison pages.",
      },
      {
        prompt: `How can ${audience} solve ${problem}?`,
        intent: "use_case",
        runIn: ["Google", "ChatGPT", "Perplexity"],
        lookFor: "How-to guides, product categories, and recurring workflow language.",
      },
      {
        prompt: `What should I look for in a ${category} tool?`,
        intent: "trust",
        runIn: ["Google", "ChatGPT", "Perplexity"],
        lookFor: "Evaluation criteria, objections, and proof buyers expect.",
      },
      {
        prompt: `How much does ${category} software cost?`,
        intent: "pricing",
        runIn: ["Google", "ChatGPT"],
        lookFor: "Pricing pages, buyer guides, and decision-stage questions.",
      },
      {
        prompt: `How do I set up ${primaryUseCase}?`,
        intent: "implementation",
        runIn: ["Google", "ChatGPT"],
        lookFor: "Setup guides, docs, FAQs, and implementation blockers.",
      },
    ],
    firstPassGap:
      "Likely owned content gap: the site needs a clear buyer-facing page that answers the decision question behind this category.",
    recommendedAsset: {
      assetType: "guide",
      title: `How to choose a ${category} tool for ${audience}`,
      whyItMatters:
        "This gives buyers and search/AI systems a clear decision page with category language, evaluation criteria, product fit, and FAQs.",
      suggestedStructure: [
        "Answer-first summary",
        "Who this is for",
        "The buyer problem and when this category matters",
        "Evaluation criteria",
        "Common alternatives and tradeoffs",
        "Product-specific proof or examples",
        "FAQ",
        "Clear next step",
      ],
    },
    caveats: [
      "This packet is directional until the manual Google/ChatGPT/Perplexity checks are run.",
      "Competitors and surfaced page types should be verified manually before posting.",
    ],
    usedAi: false,
    usedSearchProvider: false,
  };
}

async function discoverSources(packet: TeardownPacket) {
  const apiKey = process.env.PARALLEL_API_KEY;
  if (!apiKey) return [];

  const objectives: ResearchObjective[] = [
    {
      objective: `Find likely competitors, directories, listicles, review pages, and comparison pages for ${packet.categoryGuess}.`,
      searchQueries: packet.discoverySearches.slice(0, 5).map((search) => search.query),
    },
  ];

  const provider = new ParallelResearchProvider(apiKey);
  return provider.search(objectives);
}

async function generateAiPacket(input: {
  siteProfile: SiteProfile;
  fallback: TeardownPacket;
  searchContext: string;
}) {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) return null;

  const model = process.env.CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";
  const { output } = await generateText({
    model,
    output: Output.object({
      schema: aiTeardownSchema,
    }),
    prompt: teardownPrompt(input),
  });

  return output;
}

function teardownPrompt(input: {
  siteProfile: SiteProfile;
  fallback: TeardownPacket;
  searchContext: string;
}) {
  return [
    "You are creating an ephemeral Reddit teardown research packet for ContentDesk.",
    "Do not claim rankings, AI visibility, or definitive competitors.",
    "Use careful language: likely, I would test, sources I would inspect.",
    "The output must help a human quickly reply to a founder who submitted their website.",
    "",
    `Site profile:\n${JSON.stringify(input.siteProfile, null, 2)}`,
    "",
    input.searchContext ? `Search context:\n${input.searchContext}` : "No search provider context is available.",
    "",
    `Fallback packet to improve:\n${JSON.stringify(input.fallback, null, 2)}`,
  ].join("\n");
}

function inferCategory(siteProfile: SiteProfile) {
  const text = `${siteProfile.title} ${siteProfile.headline} ${siteProfile.summary}`.toLowerCase();
  const suffix = text.includes("shopify")
    ? "for Shopify stores"
    : text.includes("developer")
      ? "for developers"
      : text.includes("sales")
        ? "for sales teams"
        : text.includes("marketing")
          ? "for marketing teams"
          : "for startups";

  if (text.includes("ai")) return `AI software ${suffix}`;
  if (text.includes("analytics")) return `analytics software ${suffix}`;
  if (text.includes("support") || text.includes("helpdesk")) return `customer support software ${suffix}`;
  if (text.includes("email")) return `email software ${suffix}`;
  if (text.includes("crm")) return `CRM software ${suffix}`;
  if (text.includes("payment")) return `payments software ${suffix}`;
  return `software ${suffix}`;
}

function buildDiscoverySearches(
  category: string,
  companyName: string,
  audience: string,
): DiscoverySearch[] {
  return [
    { query: `best ${category}`, purpose: "Find listicles, directories, and competitor shortlists." },
    { query: `${category} tools for ${audience}`, purpose: "Find audience-specific competitors." },
    { query: `${category} alternatives`, purpose: "Find comparison and alternatives pages." },
    { query: `${companyName} alternatives`, purpose: "Check whether the brand has known direct competitors." },
    { query: `${category} comparison`, purpose: "Find decision-stage comparison content." },
    { query: `${category} reddit`, purpose: "Find community threads and buyer language." },
  ];
}
