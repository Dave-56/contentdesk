import { generateText, Output } from "ai";
import { z } from "zod";
import {
  buyerPromptCandidateSchema,
  buyerPromptPortfolioSchema,
  llmBuyerPromptCandidateSchema,
  type BuyerPromptCandidate,
  type BuyerPromptPortfolio,
  type DiscoveredBuyerPromptCandidate,
  type LlmBuyerPromptCandidate,
  type BuyerPromptStrategyInput,
  type PromptQualityScore,
} from "@/lib/buyer-prompt-strategist/schemas";
import type { PromptGroup, PromptInput } from "@/lib/prompt-scan/schemas";

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

type BuyerPromptCandidateDraft =
  Omit<BuyerPromptCandidate, "score" | "totalScore" | "rationale"> & {
    llmRationale?: string;
  };

type BuyerPromptCandidateGenerator = (
  strategy: BuyerPromptStrategyInput,
) => Promise<BuyerPromptCandidateDraft[]>;

export class ManualReviewRequiredError extends Error {
  readonly warnings: NonNullable<BuyerPromptStrategyInput["classificationWarnings"]>;

  constructor(warnings: NonNullable<BuyerPromptStrategyInput["classificationWarnings"]>) {
    super(
      [
        "Strategy has unresolved manual_review warnings; refusing to select prompts.",
        "Resolve these in strategy.json (or re-run prompt:infer), or pass --force to override:",
        ...warnings.map((warning) => `- [${warning.field}] ${warning.message}`),
      ].join("\n"),
    );
    this.name = "ManualReviewRequiredError";
    this.warnings = warnings;
  }
}

export function buildBuyerPromptPortfolio(input: {
  strategy: BuyerPromptStrategyInput;
  generatedAt?: Date;
  allowManualReview?: boolean;
  discoveredCandidates?: DiscoveredBuyerPromptCandidate[];
  candidateGenerator?: BuyerPromptCandidateGenerator;
}): Promise<BuyerPromptPortfolio> {
  return buildBuyerPromptPortfolioAsync(input);
}

export async function buildBuyerPromptPortfolioAsync(input: {
  strategy: BuyerPromptStrategyInput;
  generatedAt?: Date;
  allowManualReview?: boolean;
  discoveredCandidates?: DiscoveredBuyerPromptCandidate[];
  candidateGenerator?: BuyerPromptCandidateGenerator;
}) {
  if (!input.allowManualReview) {
    const blocking = (input.strategy.classificationWarnings ?? []).filter(
      (warning) => warning.severity === "manual_review",
    );
    if (blocking.length > 0) throw new ManualReviewRequiredError(blocking);
  }

  const generatedAt = input.generatedAt ?? new Date();
  const candidateGenerator =
    input.candidateGenerator ??
    (input.discoveredCandidates
      ? async () => discoveredCandidateDrafts(input.discoveredCandidates ?? [])
      : generateBuyerPromptCandidates);
  const candidates = (await candidateGenerator(input.strategy))
    .map((candidate) => scoreCandidate(candidate, input.strategy))
    .sort(sortCandidates);
  const selectedCandidates = selectPromptPortfolio({
    candidates,
    portfolioSize: input.strategy.portfolioSize,
  });
  const selectedPrompts = selectedCandidates.map<PromptInput>((candidate) => ({
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

export async function generateBuyerPromptCandidates(
  strategy: BuyerPromptStrategyInput,
): Promise<BuyerPromptCandidateDraft[]> {
  assertPromptLanguage(strategy);
  const { output } = await generateText({
    model: process.env.CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4",
    output: Output.object({
      schema: z.object({
        candidates: z.array(llmBuyerPromptCandidateSchema).min(12).max(25),
      }),
    }),
    prompt: buyerPromptCandidatePrompt(strategy),
  });

  const candidates = output.candidates.map(candidateFromLlm);

  return dedupeCandidates(candidates).filter((candidate) =>
    promptQualityIssues(candidate.prompt, strategy).length === 0
  );
}

function assertPromptLanguage(strategy: BuyerPromptStrategyInput) {
  if (!strategy.buyerLanguage) {
    throw new Error(
      "buyerLanguage is required before selecting prompts. Run prompt:infer with AI classification or edit strategy.json manually.",
    );
  }
}

function buyerPromptCandidatePrompt(strategy: BuyerPromptStrategyInput) {
  return [
    "You are ContentDesk's buyer-prompt strategist.",
    "Generate natural answer-engine buyer questions from the reviewed strategy.",
    "",
    "Framework:",
    "- Prompts are buyer questions, not keywords.",
    "- Map each prompt to buyer journey phase: awareness, consideration, evaluation, decision.",
    "- Cover the journey, but overweight evaluation and decision prompts.",
    "- Include competitor/alternative prompts only for credible competitors in strategy.",
    "- Use ICP language from buyerLanguage and buyerJobs.",
    "- Prompts must be realistic questions a buyer would ask ChatGPT, Perplexity, Google AI, or Claude.",
    "- Avoid formulaic noun stuffing.",
    "",
    "Prompt group mapping:",
    "- awareness: problem_aware",
    "- consideration: category_search, solution_aware, integration_use_case",
    "- evaluation: competitor_comparison, category_search",
    "- decision: high_intent_purchase, competitor_comparison",
    "",
    "Return 15-25 candidates. Each prompt must end with a question mark.",
    "",
    "Strategy:",
    JSON.stringify(strategy, null, 2),
  ].join("\n");
}

function candidateFromLlm(candidate: LlmBuyerPromptCandidate): BuyerPromptCandidateDraft {
  return {
    id: slug(`${candidate.group} ${candidate.prompt}`),
    group: candidate.group,
    journeyPhase: candidate.journeyPhase,
    prompt: candidate.prompt,
    buyerJob: candidate.buyerJob,
    source: candidate.source,
    llmRationale: candidate.rationale,
  };
}

function promptQualityIssues(prompt: string, strategy: BuyerPromptStrategyInput) {
  const issues: string[] = [];
  if (!prompt.endsWith("?")) issues.push("Prompt must be a question.");
  if (prompt.length > 180) issues.push("Prompt is too long.");
  if (!/^(What|Which|How|Is|Are|Can|Should)\b/.test(prompt)) {
    issues.push("Prompt must start like a buyer question.");
  }
  if (effectiveMarket(strategy) !== "shopify_app" && /\bshopify\b/i.test(prompt)) {
    issues.push("Non-Shopify strategy cannot generate Shopify prompts.");
  }
  if (/\b(with|for|prepare)\s+[A-Z][a-z]+(?:\s+[a-z]+){2,}/.test(prompt)) {
    issues.push("Prompt appears to contain a pasted marketing clause.");
  }
  if (/\bfor\s+(record|install|choose|upgrade|create)\b/i.test(prompt)) {
    issues.push("Prompt contains an ungrammatical verb phrase.");
  }
  if (/\bteams\s+recording\b/i.test(prompt)) {
    issues.push("Prompt contains clause-like audience wording.");
  }

  return issues;
}

function scoreCandidate(
  candidate: BuyerPromptCandidateDraft,
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
    effectiveMarket(strategy) === "shopify_app" &&
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
  candidate: Pick<
    BuyerPromptCandidateDraft,
    "group" | "source" | "llmRationale" | "evidenceQuality" | "demandEvidence"
  >,
  score: PromptQualityScore,
) {
  return [
    candidate.llmRationale ? `LLM rationale: ${candidate.llmRationale}` : "",
    candidate.evidenceQuality
      ? `Demand evidence: ${candidate.evidenceQuality}; ${(candidate.demandEvidence ?? [])
        .map((item) => `${item.sourceType} "${item.evidenceText}"`)
        .slice(0, 3)
        .join("; ")}.`
      : "",
    `Selected candidate for ${candidate.group}.`,
    candidate.source === "competitor"
      ? "It tests a competitor-shaped evaluation gap."
      : "It maps to a buyer job and can be rechecked after an asset is shipped.",
    `Scores: buyer intent ${score.buyerIntent}, commercial closeness ${score.commercialCloseness}, ICP fit ${score.icpFit}, product fit ${score.productFit}, competitive likelihood ${score.competitiveLikelihood}, asset opportunity ${score.assetOpportunity}.`,
  ].filter(Boolean).join(" ");
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
  const evidenceDelta = evidenceRank(right.evidenceQuality) - evidenceRank(left.evidenceQuality);
  if (evidenceDelta !== 0) return evidenceDelta;
  return left.prompt.localeCompare(right.prompt);
}

function discoveredCandidateDrafts(
  candidates: DiscoveredBuyerPromptCandidate[],
): BuyerPromptCandidateDraft[] {
  return candidates
    .filter((candidate) =>
      candidate.evidenceQuality === "medium" || candidate.evidenceQuality === "high"
    )
    .map((candidate) => ({
      id: candidate.id,
      group: candidate.group,
      journeyPhase: candidate.journeyPhase,
      prompt: candidate.prompt,
      buyerJob: candidate.buyerJob,
      source: candidate.source,
      rawQuery: candidate.rawQuery,
      evidenceQuality: candidate.evidenceQuality,
      serpIntent: candidate.serpIntent,
      intentMatch: candidate.intentMatch,
      demandEvidence: candidate.demandEvidence,
      llmRationale: `Normalized from evidence-backed query: ${candidate.rawQuery}`,
    }));
}

function evidenceRank(quality: BuyerPromptCandidate["evidenceQuality"]) {
  if (quality === "high") return 3;
  if (quality === "medium") return 2;
  if (quality === "low") return 1;

  return 0;
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

function effectiveMarket(strategy: BuyerPromptStrategyInput) {
  const text = [
    strategy.market,
    strategy.audience,
    strategy.category,
    strategy.positioning,
    strategy.conversionGoal,
    ...strategy.primaryUseCases,
  ].join(" ").toLowerCase();
  if (
    text.includes("shopify") &&
    /\b(app|merchant|store|product page|pdp|catalog|checkout|admin|fashion brand)\b/.test(text)
  ) {
    return "shopify_app" as const;
  }

  return strategy.market;
}
