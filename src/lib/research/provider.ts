import type { BrandProfile, ResearchSource } from "@/lib/schemas";

export type ResearchObjective = {
  objective: string;
  searchQueries: string[];
};

export type ResearchProvider = {
  search(objectives: ResearchObjective[]): Promise<ResearchSource[]>;
  extract(sources: ResearchSource[], objectives: ResearchObjective[]): Promise<ResearchSource[]>;
};

export function buildResearchObjectives(profile: BrandProfile): ResearchObjective[] {
  const app = profile.appName;
  const merchant = profile.targetMerchant;
  const primaryUseCase = profile.featuresUseCases[0] ?? "Shopify app workflow";
  const competitors = profile.competitors.slice(0, 3);
  const competitorNames = competitors.join(", ");
  const primaryCompetitor = competitors[0];

  const objectives: ResearchObjective[] = [
    {
      objective: [
        `Find Shopify-specific merchant pains and content opportunities for ${app}.`,
        `The app targets ${merchant} and is positioned as: ${profile.positioning}.`,
        `Focus on ${primaryUseCase}, app workflows, merchant operations, and educational content gaps.`,
      ].join(" "),
      searchQueries: [
        `${primaryUseCase} Shopify merchants`,
        `${merchant} Shopify app pain`,
        `${app} Shopify content ideas`,
      ],
    },
    {
      objective: [
        `Find authoritative Shopify sources that explain app, merchant, and operational context relevant to ${app}.`,
        `Prioritize Shopify docs, Shopify Help Center, Shopify blog, and merchant-facing guidance.`,
      ].join(" "),
      searchQueries: [
        "Shopify app merchant workflow",
        "Shopify Help Center apps merchants",
        "Shopify blog merchant operations",
      ],
    },
    {
      objective: [
        competitorNames
          ? `Find content gaps and positioning angles around competitors or adjacent tools: ${competitorNames}.`
          : `Find content gaps around adjacent Shopify app categories for ${primaryUseCase}.`,
        `Look for angles that are useful to ${merchant}, not generic ecommerce content.`,
      ].join(" "),
      searchQueries: [
        competitorNames || `${primaryUseCase} Shopify apps`,
        "Shopify app comparison merchant pain",
        "Shopify merchant education app workflow",
      ],
    },
  ];

  objectives.push({
    objective: [
      `Find buyer-intent and comparison content opportunities for ${app}.`,
      competitorNames
        ? `Use competitor and adjacent-tool context from: ${competitorNames}.`
        : `Use the product category and primary use case when named competitors are unavailable.`,
      `Look for alternatives, versus, best-tools, how-to-choose, switching, and category evaluation angles that would help ${merchant} compare options honestly.`,
      `Avoid thin competitor attack pages; prioritize useful decision criteria and bottom-of-funnel search intent.`,
    ].join(" "),
    searchQueries: [
      primaryCompetitor
        ? `${primaryCompetitor} alternative Shopify`
        : `best Shopify apps for ${primaryUseCase}`,
      primaryCompetitor
        ? `${primaryCompetitor} vs ${app}`
        : `how to choose ${primaryUseCase} Shopify app`,
      `${primaryUseCase} Shopify app comparison`,
    ],
  });

  return objectives;
}

export function buildArticleRequestResearchObjectives(input: {
  profile: BrandProfile;
  articleIdea: string;
}): ResearchObjective[] {
  const { profile, articleIdea } = input;
  const app = profile.appName;
  const merchant = profile.targetMerchant;
  const primaryUseCase = profile.featuresUseCases[0] ?? "Shopify app workflow";
  const competitors = profile.competitors.slice(0, 3);
  const competitorNames = competitors.join(", ");

  return [
    {
      objective: [
        `Research the exact requested ContentDesk article: ${articleIdea}.`,
        `The article is for ${app}, which targets ${merchant} and is positioned as: ${profile.positioning}.`,
        `Find evidence, examples, decision criteria, Shopify workflow context, and source-backed angles that make this specific article useful.`,
      ].join(" "),
      searchQueries: [
        `${articleIdea} Shopify`,
        `${articleIdea} ${merchant}`,
        `${articleIdea} ${primaryUseCase}`,
      ],
    },
    {
      objective: [
        `Find authoritative Shopify or ecommerce sources that support the requested article: ${articleIdea}.`,
        `Prioritize Shopify docs, Shopify Help Center, Shopify blog, platform docs, merchant guidance, and primary product/category sources.`,
      ].join(" "),
      searchQueries: [
        `Shopify ${articleIdea}`,
        `Shopify ${primaryUseCase}`,
        `${merchant} ${primaryUseCase}`,
      ],
    },
    {
      objective: [
        competitorNames
          ? `Find comparison, alternatives, versus, and category evaluation context involving these competitors or adjacent tools: ${competitorNames}.`
          : `Find comparison, alternatives, versus, and category evaluation context for ${primaryUseCase}.`,
        `Use this only where it helps the requested article answer a real merchant decision.`,
      ].join(" "),
      searchQueries: [
        competitorNames
          ? `${competitorNames} alternatives Shopify`
          : `best Shopify apps for ${primaryUseCase}`,
        `${articleIdea} alternatives`,
        `${articleIdea} comparison`,
      ],
    },
  ];
}
