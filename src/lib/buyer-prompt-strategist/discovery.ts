import {
  buyerPromptDiscoveryFileSchema,
  discoveredBuyerPromptCandidateSchema,
  type BuyerJourneyPhase,
  type BuyerPromptDemandEvidence,
  type BuyerPromptDiscoveryFile,
  type BuyerPromptStrategyInput,
  type DiscoveredBuyerPromptCandidate,
} from "@/lib/buyer-prompt-strategist/schemas";
import type { PromptGroup } from "@/lib/prompt-scan/schemas";

export type SeedProbe = {
  query: string;
  group: PromptGroup;
  sourceField: string;
};

export type AutocompleteFetcher = (query: string) => Promise<string[]>;

export async function discoverBuyerPrompts(input: {
  strategy: BuyerPromptStrategyInput;
  generatedAt?: Date;
  strategySource?: string;
  fetchAutocomplete?: AutocompleteFetcher;
}): Promise<BuyerPromptDiscoveryFile> {
  const generatedAt = input.generatedAt ?? new Date();
  const observedAt = generatedAt.toISOString();
  const seedProbes = buildSeedProbes(input.strategy);
  const candidates: DiscoveredBuyerPromptCandidate[] = [];

  if (input.fetchAutocomplete) {
    for (const probe of seedProbes) {
      const suggestions = await input.fetchAutocomplete(probe.query);
      for (const suggestion of suggestions) {
        const candidate = candidateFromAutocomplete({
          suggestion,
          probe,
          strategy: input.strategy,
          observedAt,
        });
        if (candidate) candidates.push(candidate);
      }
    }
  }

  return buyerPromptDiscoveryFileSchema.parse({
    brand: input.strategy.brand.name,
    generatedAt: observedAt,
    strategySource: input.strategySource,
    seedProbes,
    candidates: dedupeDiscoveredCandidates(candidates).sort(sortDiscoveredCandidates),
  });
}

export function buildSeedProbes(strategy: BuyerPromptStrategyInput): SeedProbe[] {
  const category = strategy.buyerLanguage?.categoryNoun ?? strategy.category;
  const audience = strategy.buyerLanguage?.buyerNoun ?? strategy.audience;
  const useCase =
    strategy.buyerLanguage?.useCaseNoun ??
    strategy.primaryUseCases[0] ??
    strategy.category;
  const pain = strategy.buyerLanguage?.painNoun;
  const probes: SeedProbe[] = [
    probe(category, "category_search", "buyerLanguage.categoryNoun"),
    probe(`best ${category}`, "category_search", "buyerLanguage.categoryNoun"),
    probe(`${category} for ${audience}`, "category_search", "audience"),
    probe(`${useCase} app`, "solution_aware", "buyerLanguage.useCaseNoun"),
    probe(`best app for ${useCase}`, "high_intent_purchase", "buyerLanguage.useCaseNoun"),
    probe(`${useCase} tool`, "solution_aware", "buyerLanguage.useCaseNoun"),
  ];

  if (pain) {
    probes.push(probe(`tool for ${pain}`, "problem_aware", "buyerLanguage.painNoun"));
  }

  for (const competitor of strategy.competitors.slice(0, 3)) {
    probes.push(
      probe(`${competitor.name} alternative`, "competitor_comparison", "competitors"),
    );
  }

  return dedupeProbes(probes);
}

export async function fetchGoogleAutocomplete(query: string): Promise<string[]> {
  const url = new URL("https://suggestqueries.google.com/complete/search");
  url.searchParams.set("client", "firefox");
  url.searchParams.set("q", query);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google autocomplete failed for "${query}": HTTP ${response.status}`);
  }

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return [];

  return payload[1].filter((item): item is string => typeof item === "string");
}

function candidateFromAutocomplete(input: {
  suggestion: string;
  probe: SeedProbe;
  strategy: BuyerPromptStrategyInput;
  observedAt: string;
}): DiscoveredBuyerPromptCandidate | null {
  const rawQuery = normalizeWhitespace(input.suggestion);
  if (!rawQuery || rawQuery.length < 3) return null;
  if (!hasProductFit(rawQuery, input.strategy)) return null;

  const group = groupForQuery(rawQuery, input.probe.group);
  const journeyPhase = journeyPhaseForGroup(group);
  const evidence: BuyerPromptDemandEvidence = {
    sourceType: "autocomplete",
    query: input.probe.query,
    evidenceText: rawQuery,
    observedAt: input.observedAt,
  };
  const evidenceQuality = evidenceQualityForAutocomplete(rawQuery);
  const prompt = promptFromQuery(rawQuery, input.strategy);

  return discoveredBuyerPromptCandidateSchema.parse({
    id: slug(`${group} ${rawQuery}`),
    group,
    journeyPhase,
    rawQuery,
    prompt,
    buyerJob: buyerJobForGroup(group, input.strategy),
    source: sourceForGroup(group),
    evidenceQuality,
    serpIntent: serpIntentForQuery(rawQuery),
    intentMatch: evidenceQuality === "high" ? "strong" : "medium",
    demandEvidence: [evidence],
  });
}

function promptFromQuery(rawQuery: string, strategy: BuyerPromptStrategyInput) {
  const query = normalizeWhitespace(rawQuery);
  if (/^(what|which|how|is|are|can|should)\b/i.test(query)) {
    return query.endsWith("?") ? query : `${query}?`;
  }

  if (/\balternatives?\b/i.test(query)) {
    return `What are the best ${query} for ${comparisonContext(strategy)}?`;
  }

  if (/\bbest\b/i.test(query)) {
    return `What are the ${query}?`;
  }

  if (/\b(app|tool|software|generator|platform)s?\b/i.test(query)) {
    return `Which ${query} should ${strategy.buyerLanguage?.buyerNoun ?? strategy.audience} use?`;
  }

  return `What is the best way for ${strategy.buyerLanguage?.buyerNoun ?? strategy.audience} to handle ${query}?`;
}

function groupForQuery(query: string, fallback: PromptGroup): PromptGroup {
  const lower = query.toLowerCase();
  if (/\balternatives?\b|\bvs\b|\bcompare\b|\bcomparison\b/.test(lower)) {
    return "competitor_comparison";
  }
  if (/\bbest\b|\breviews?\b|\bpricing\b|\bwhich\b/.test(lower)) {
    return "high_intent_purchase";
  }
  if (/\bapp\b|\btool\b|\bsoftware\b|\bgenerator\b|\bplatform\b/.test(lower)) {
    return "category_search";
  }

  return fallback;
}

function journeyPhaseForGroup(group: PromptGroup): BuyerJourneyPhase {
  if (group === "problem_aware") return "awareness";
  if (group === "competitor_comparison") return "evaluation";
  if (group === "high_intent_purchase") return "decision";

  return "consideration";
}

function sourceForGroup(group: PromptGroup) {
  if (group === "competitor_comparison") return "competitor" as const;
  if (group === "high_intent_purchase") return "purchase" as const;
  if (group === "category_search") return "category" as const;

  return "buyer_job" as const;
}

function serpIntentForQuery(query: string) {
  const lower = query.toLowerCase();
  if (/\balternatives?\b|\bvs\b|\bcompare\b|\bcomparison\b/.test(lower)) {
    return "compare_tools" as const;
  }
  if (/\bbest\b|\breviews?\b|\bpricing\b|\bwhich\b/.test(lower)) {
    return "choose_tool" as const;
  }
  if (/\bapp\b|\btool\b|\bsoftware\b|\bgenerator\b|\bplatform\b/.test(lower)) {
    return "choose_tool" as const;
  }

  return "solve_problem" as const;
}

function evidenceQualityForAutocomplete(query: string) {
  const lower = query.toLowerCase();
  if (/\balternatives?\b|\bvs\b|\bcompare\b|\bcomparison\b|\bbest\b/.test(lower)) {
    return "high" as const;
  }
  if (/\bapp\b|\btool\b|\bsoftware\b|\bgenerator\b|\bplatform\b/.test(lower)) {
    return "medium" as const;
  }

  return "low" as const;
}

function buyerJobForGroup(group: PromptGroup, strategy: BuyerPromptStrategyInput) {
  const configured = strategy.buyerJobs.find((job) => job.group === group);
  if (configured) return configured.job;

  return `Find evidence-backed ${group.replace(/_/g, " ")} questions.`;
}

function hasProductFit(query: string, strategy: BuyerPromptStrategyInput) {
  const lower = query.toLowerCase();
  const terms = [
    strategy.category,
    strategy.buyerLanguage?.categoryNoun,
    strategy.buyerLanguage?.useCaseNoun,
    strategy.buyerLanguage?.productNoun,
    ...strategy.primaryUseCases,
    ...strategy.competitors.flatMap((competitor) => [
      competitor.name,
      ...competitor.aliases,
    ]),
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
    .filter((term) => term.length >= 4);

  return terms.some((term) => lower.includes(term));
}

function comparisonContext(strategy: BuyerPromptStrategyInput) {
  return strategy.buyerLanguage?.comparisonNoun ??
    strategy.buyerLanguage?.useCaseNoun ??
    strategy.category;
}

function probe(query: string, group: PromptGroup, sourceField: string): SeedProbe {
  return {
    query: normalizeWhitespace(query),
    group,
    sourceField,
  };
}

function dedupeProbes(probes: SeedProbe[]) {
  const seen = new Set<string>();
  return probes.filter((probeItem) => {
    const key = probeItem.query.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeDiscoveredCandidates(candidates: DiscoveredBuyerPromptCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.rawQuery.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortDiscoveredCandidates(
  left: DiscoveredBuyerPromptCandidate,
  right: DiscoveredBuyerPromptCandidate,
) {
  const quality = { high: 3, medium: 2, low: 1, unproven: 0 };
  const qualityDelta =
    quality[right.evidenceQuality] - quality[left.evidenceQuality];
  if (qualityDelta !== 0) return qualityDelta;

  return left.rawQuery.localeCompare(right.rawQuery);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
