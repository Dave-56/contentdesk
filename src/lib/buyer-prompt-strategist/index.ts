import {
  buyerPromptCandidateSchema,
  buyerPromptPortfolioSchema,
  type BuyerPromptCandidate,
  type BuyerPromptStrategyInput,
  type PromptQualityScore,
} from "@/lib/buyer-prompt-strategist/schemas";
import type { PromptGroup, TinyLemonPromptInput } from "@/lib/prompt-scan/schemas";

const DEFAULT_SELECTION_RULE =
  "Cover the journey, but overweight prompts closest to purchase, competitor comparison, and realistic asset opportunities.";

const GROUP_TARGETS_10: Record<PromptGroup, number> = {
  problem_aware: 1,
  category_search: 2,
  solution_aware: 1,
  integration_use_case: 1,
  competitor_comparison: 3,
  high_intent_purchase: 2,
};

export function buildBuyerPromptPortfolio(input: {
  strategy: BuyerPromptStrategyInput;
  generatedAt?: Date;
}) {
  const generatedAt = input.generatedAt ?? new Date();
  const candidates = generateBuyerPromptCandidates(input.strategy)
    .map((candidate) => scoreCandidate(candidate, input.strategy))
    .sort(sortCandidates);
  const selectedCandidates = selectPromptPortfolio({
    candidates,
    portfolioSize: input.strategy.portfolioSize,
  });
  const selectedPrompts = selectedCandidates.map<TinyLemonPromptInput>((candidate) => ({
    id: candidate.id,
    group: candidate.group,
    prompt: candidate.prompt,
  }));

  return buyerPromptPortfolioSchema.parse({
    brand: input.strategy.brand.name,
    generatedAt: generatedAt.toISOString(),
    portfolioSize: input.strategy.portfolioSize,
    selectionRule: DEFAULT_SELECTION_RULE,
    selectedPrompts,
    selectedCandidates,
    candidates,
  });
}

export function generateBuyerPromptCandidates(
  strategy: BuyerPromptStrategyInput,
): Array<Omit<BuyerPromptCandidate, "score" | "totalScore" | "rationale">> {
  const primaryUseCase = strategy.primaryUseCases[0];
  const categoryPlural = pluralCategory(strategy.category);
  const candidates: Array<
    Omit<BuyerPromptCandidate, "score" | "totalScore" | "rationale">
  > = [];

  for (const job of strategy.buyerJobs) {
    if (job.group === "problem_aware") {
      candidates.push({
        id: slug(`problem ${job.id}`),
        group: job.group,
        source: "buyer_job",
        buyerJob: job.job,
        prompt: `How can ${strategy.audience} ${job.pain}?`,
      });
    }

    if (job.group === "category_search") {
      candidates.push(
        {
          id: slug(`category best ${job.id}`),
          group: job.group,
          source: "category",
          buyerJob: job.job,
          prompt: `What are the best ${categoryPlural} for ${strategy.audience}?`,
        },
        {
          id: slug(`category apps ${job.id}`),
          group: job.group,
          source: "category",
          buyerJob: job.job,
          prompt: `Which apps help ${strategy.audience} with ${primaryUseCase}?`,
        },
      );
    }

    if (job.group === "solution_aware") {
      candidates.push({
          id: slug(`solution ${job.id}`),
          group: job.group,
          source: "buyer_job",
          buyerJob: job.job,
          prompt: `How do ${categoryPlural} work for ${strategy.audience}?`,
      });
    }

    if (job.group === "integration_use_case") {
      candidates.push({
        id: slug(`integration ${job.id}`),
        group: job.group,
        source: "buyer_job",
        buyerJob: job.job,
        prompt: `How should ${strategy.audience} prepare ${primaryUseCase} for ${strategy.conversionGoal}?`,
      });
    }

    if (job.group === "high_intent_purchase") {
      candidates.push(
        {
          id: slug(`purchase choose ${job.id}`),
          group: job.group,
          source: "purchase",
          buyerJob: job.job,
          prompt: `Which ${strategy.category} should I choose for ${strategy.audience}?`,
        },
        {
          id: slug(`purchase app ${job.id}`),
          group: job.group,
          source: "purchase",
          buyerJob: job.job,
          prompt: `Is there a Shopify app that helps ${strategy.audience} with ${primaryUseCase}?`,
        },
      );
    }
  }

  const comparisonJob =
    strategy.buyerJobs.find((job) => job.group === "competitor_comparison") ??
    strategy.buyerJobs[0];

  for (const competitor of strategy.competitors.slice(0, 5)) {
    candidates.push({
      id: slug(`competitor ${competitor.name} alternatives`),
      group: "competitor_comparison",
      source: "competitor",
      buyerJob: comparisonJob.job,
      prompt: `What are the best ${competitor.name} alternatives for ${strategy.audience}?`,
    });
  }

  return dedupeCandidates(candidates);
}

function scoreCandidate(
  candidate: Omit<BuyerPromptCandidate, "score" | "totalScore" | "rationale">,
  strategy: BuyerPromptStrategyInput,
): BuyerPromptCandidate {
  const job = strategy.buyerJobs.find((item) => item.group === candidate.group);
  const score: PromptQualityScore = {
    buyerIntent: buyerIntentScore(candidate),
    commercialCloseness: job?.commercialCloseness ?? groupCommercialCloseness(candidate.group),
    icpFit: icpFitScore(candidate.prompt, strategy),
    productFit: Math.max(job?.productFit ?? 1, productFitScore(candidate.prompt, strategy)),
    competitiveLikelihood: competitiveLikelihoodScore(candidate),
    assetOpportunity: job?.assetOpportunity ?? assetOpportunityScore(candidate.group, strategy),
  };
  const totalScore = Object.values(score).reduce((sum, value) => sum + value, 0);

  return buyerPromptCandidateSchema.parse({
    ...candidate,
    score,
    totalScore,
    rationale: rationaleForCandidate(candidate, score),
  });
}

function selectPromptPortfolio(input: {
  candidates: BuyerPromptCandidate[];
  portfolioSize: number;
}) {
  const targets = scaledTargets(input.portfolioSize);
  const selected: BuyerPromptCandidate[] = [];

  for (const group of Object.keys(targets) as PromptGroup[]) {
    selected.push(
      ...input.candidates
        .filter((candidate) => candidate.group === group)
        .slice(0, targets[group]),
    );
  }

  for (const candidate of input.candidates) {
    if (selected.length >= input.portfolioSize) break;
    if (selected.some((item) => item.id === candidate.id)) continue;
    selected.push(candidate);
  }

  return selected.sort(sortCandidates);
}

function scaledTargets(portfolioSize: number): Record<PromptGroup, number> {
  if (portfolioSize <= 5) {
    return {
      problem_aware: 1,
      category_search: 1,
      solution_aware: 0,
      integration_use_case: 0,
      competitor_comparison: 2,
      high_intent_purchase: 1,
    };
  }

  return GROUP_TARGETS_10;
}

function buyerIntentScore(candidate: Pick<BuyerPromptCandidate, "group" | "prompt">) {
  if (candidate.group === "competitor_comparison") return 5;
  if (candidate.group === "high_intent_purchase") return 5;
  if (candidate.group === "category_search") return 4;
  if (candidate.group === "solution_aware") return 4;
  if (candidate.group === "integration_use_case") return 3;

  return candidate.prompt.toLowerCase().includes("how can") ? 3 : 2;
}

function groupCommercialCloseness(group: PromptGroup) {
  if (group === "competitor_comparison" || group === "high_intent_purchase") return 5;
  if (group === "category_search" || group === "solution_aware") return 3;
  if (group === "integration_use_case") return 3;

  return 2;
}

function icpFitScore(prompt: string, strategy: BuyerPromptStrategyInput) {
  const lower = prompt.toLowerCase();
  const terms = strategy.audience
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 3);
  const matches = terms.filter((term) => lower.includes(term)).length;

  return Math.max(1, Math.min(5, matches + 2));
}

function productFitScore(prompt: string, strategy: BuyerPromptStrategyInput) {
  const lower = prompt.toLowerCase();
  const terms = [
    strategy.category,
    ...strategy.primaryUseCases,
  ].flatMap((value) => value.toLowerCase().split(/\s+/));
  const matches = terms
    .filter((term) => term.length > 3)
    .filter((term) => lower.includes(term)).length;

  return Math.max(1, Math.min(5, matches));
}

function competitiveLikelihoodScore(candidate: Pick<BuyerPromptCandidate, "group" | "source" | "prompt">) {
  if (candidate.group === "competitor_comparison" || candidate.source === "competitor") {
    return 5;
  }
  const lower = candidate.prompt.toLowerCase();
  if (lower.includes("best") || lower.includes("which")) return 4;
  if (lower.includes("tools") || lower.includes("apps")) return 3;

  return 2;
}

function assetOpportunityScore(
  group: PromptGroup,
  strategy: BuyerPromptStrategyInput,
) {
  if (
    group === "competitor_comparison" &&
    hasMissingAsset(strategy, "comparison_page")
  ) {
    return 5;
  }
  if (
    group === "high_intent_purchase" &&
    hasUnknownOrMissingAsset(strategy, "shopify_app_store_listing")
  ) {
    return 5;
  }
  if (
    (group === "problem_aware" || group === "category_search" || group === "solution_aware") &&
    hasUnknownOrMissingAsset(strategy, "blog_guide")
  ) {
    return 4;
  }

  return 3;
}

function rationaleForCandidate(
  candidate: Pick<BuyerPromptCandidate, "group" | "source">,
  score: PromptQualityScore,
) {
  return [
    `Selected candidate for ${candidate.group}.`,
    candidate.source === "competitor"
      ? "It tests a competitor-shaped evaluation gap."
      : "It maps to a buyer job and can be rechecked after an asset is shipped.",
    `Scores: buyer intent ${score.buyerIntent}, commercial closeness ${score.commercialCloseness}, ICP fit ${score.icpFit}, product fit ${score.productFit}, competitive likelihood ${score.competitiveLikelihood}, asset opportunity ${score.assetOpportunity}.`,
  ].join(" ");
}

function hasMissingAsset(
  strategy: BuyerPromptStrategyInput,
  type: BuyerPromptStrategyInput["assetInventory"][number]["type"],
) {
  return strategy.assetInventory.some(
    (asset) => asset.type === type && asset.status === "missing",
  );
}

function hasUnknownOrMissingAsset(
  strategy: BuyerPromptStrategyInput,
  type: BuyerPromptStrategyInput["assetInventory"][number]["type"],
) {
  return strategy.assetInventory.some(
    (asset) =>
      asset.type === type &&
      (asset.status === "missing" || asset.status === "unknown"),
  );
}

function sortCandidates(left: BuyerPromptCandidate, right: BuyerPromptCandidate) {
  if (right.totalScore !== left.totalScore) return right.totalScore - left.totalScore;
  return left.prompt.localeCompare(right.prompt);
}

function dedupeCandidates<T extends { prompt: string }>(candidates: T[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidate.prompt.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pluralCategory(category: string) {
  if (/\btools?$/i.test(category)) return category;
  if (/\bapps?$/i.test(category)) return category.replace(/\bapp$/i, "apps");

  return `${category} tools`;
}
