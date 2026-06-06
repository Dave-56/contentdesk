import { generateText, Output } from "ai";
import { z } from "zod";
import {
  buyerPromptCandidateSchema,
  buyerPromptPortfolioSchema,
  llmBuyerPromptCandidateSchema,
  type BuyerPromptCandidate,
  type BuyerPromptPortfolio,
  type LlmBuyerPromptCandidate,
  type PromptPortfolioBucket,
  type PromptPortfolioIntent,
  type BuyerPromptStrategyInput,
  type PromptQualityScore,
} from "@/lib/buyer-prompt-strategist/schemas";
import type { PromptGroup, PromptInput } from "@/lib/prompt-scan/schemas";

const DEFAULT_SELECTION_RULE =
  "Discovery baseline: market demand questions by bucket; no brand evaluation or direct comparison prompts.";

const BRAND_EVALUATION_SELECTION_RULE =
  "Brand/evaluation: brand-fit and competitor comparison prompts for later trust and decision scans.";

const MIN_SELECTABLE_JOB_FIT = 13;

const DISCOVERY_BUCKET_TARGETS = {
  neutral_discovery: 3,
  category_best_tool: 2,
  use_case_fit: 2,
  competitor_alternative: 2,
  implementation: 1,
  brand_evaluation: 0,
  direct_comparison: 0,
} satisfies Record<PromptPortfolioBucket, number>;

const DISCOVERY_BUCKET_CAPS = {
  neutral_discovery: 10,
  category_best_tool: 10,
  use_case_fit: 10,
  competitor_alternative: 3,
  implementation: 3,
  brand_evaluation: 0,
  direct_comparison: 0,
} satisfies Record<PromptPortfolioBucket, number>;

const BRAND_EVALUATION_BUCKET_TARGETS = {
  neutral_discovery: 0,
  category_best_tool: 1,
  use_case_fit: 1,
  competitor_alternative: 3,
  implementation: 0,
  brand_evaluation: 3,
  direct_comparison: 2,
} satisfies Record<PromptPortfolioBucket, number>;

const BRAND_EVALUATION_BUCKET_CAPS = {
  neutral_discovery: 1,
  category_best_tool: 2,
  use_case_fit: 2,
  competitor_alternative: 10,
  implementation: 1,
  brand_evaluation: 10,
  direct_comparison: 10,
} satisfies Record<PromptPortfolioBucket, number>;

const DISCOVERY_BUCKET_ORDER: PromptPortfolioBucket[] = [
  "neutral_discovery",
  "category_best_tool",
  "use_case_fit",
  "competitor_alternative",
  "implementation",
];

const BRAND_EVALUATION_BUCKET_ORDER: PromptPortfolioBucket[] = [
  "brand_evaluation",
  "direct_comparison",
  "competitor_alternative",
  "category_best_tool",
  "use_case_fit",
];

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
  candidateGenerator?: BuyerPromptCandidateGenerator;
}): Promise<BuyerPromptPortfolio> {
  return buildBuyerPromptPortfolioAsync(input);
}

export async function buildBuyerPromptPortfolioAsync(input: {
  strategy: BuyerPromptStrategyInput;
  generatedAt?: Date;
  allowManualReview?: boolean;
  candidateGenerator?: BuyerPromptCandidateGenerator;
}) {
  if (!input.allowManualReview) {
    const blocking = (input.strategy.classificationWarnings ?? []).filter(
      (warning) => warning.severity === "manual_review",
    );
    if (blocking.length > 0) throw new ManualReviewRequiredError(blocking);
  }

  const generatedAt = input.generatedAt ?? new Date();
  const candidateGenerator = input.candidateGenerator ?? generateBuyerPromptCandidates;
  const generatedCandidates = ensureStrategyCoverage(
    dedupeCandidates(await candidateGenerator(input.strategy)),
    input.strategy,
  ).filter((candidate) =>
    promptQualityIssues(candidate.prompt, input.strategy).length === 0
  );
  const candidates = dedupeCandidates(generatedCandidates)
    .map((candidate) => scoreCandidate(candidate, input.strategy))
    .sort(sortCandidates);
  const promptSets = buildPromptSets({
    candidates,
    strategy: input.strategy,
    portfolioSize: input.strategy.portfolioSize,
  });
  const selectedCandidates = promptSets.discoveryBaseline.selectedCandidates;
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
    promptSets,
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

  return dedupeCandidates(candidates.map(normalizeCandidatePrompt)).filter((candidate) =>
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
    "- Generate mostly neutral buyer prompts that do not mention the brand.",
    "- Brand-name prompts are allowed only for explicit fit, install, or comparison checks.",
    "- Competitor prompts should include alternatives/comparisons buyers might ask before knowing the brand.",
    "- Include at least one competitor prompt for each credible competitor, up to 4 competitors.",
    "- Target mix in candidates: 12-15 neutral, 4-6 competitor/comparison, 2-4 brand-specific.",
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

function normalizeCandidatePrompt(
  candidate: BuyerPromptCandidateDraft,
): BuyerPromptCandidateDraft {
  const prompt = candidate.prompt
    .replace(/\bappss\b/gi, "apps")
    .replace(/\btoolss\b/gi, "tools")
    .replace(/\bgeneratorss\b/gi, "generators")
    .replace(/\bplatformss\b/gi, "platforms");
  if (prompt === candidate.prompt) return candidate;

  return {
    ...candidate,
    id: slug(`${candidate.group} ${prompt}`),
    prompt,
  };
}

function ensureStrategyCoverage(
  candidates: BuyerPromptCandidateDraft[],
  strategy: BuyerPromptStrategyInput,
) {
  return [
    ...candidates,
    ...strategyLedCoverageCandidates(strategy),
  ].map(normalizeCandidatePrompt);
}

function strategyLedCoverageCandidates(
  strategy: BuyerPromptStrategyInput,
): BuyerPromptCandidateDraft[] {
  const buyer = strategy.buyerLanguage?.buyerNoun ?? strategy.audience;
  const category = pluralizePromptNoun(
    strategy.buyerLanguage?.categoryNoun ?? strategy.category,
  );
  const useCase =
    strategy.buyerLanguage?.useCaseNoun ??
    strategy.primaryUseCases[0] ??
    strategy.category;
  const pain = strategy.buyerLanguage?.painNoun ?? strategy.buyerJobs[0]?.pain;
  const comparison = comparisonTopic(strategy);
  const competitorNames = strategy.competitors.slice(0, 4).map((item) => item.name);
  const prompts: BuyerPromptCandidateDraft[] = [
    strategyCandidate(
      "problem_aware",
      "awareness",
      problemPromptForStrategy({ buyer, pain, category, useCase, strategy }),
      "buyer_job",
      "Strategy coverage: core pain prompt.",
    ),
    strategyCandidate(
      "category_search",
      "consideration",
      `Which ${category} help ${buyer} with ${useCase}?`,
      "category",
      "Strategy coverage: neutral category prompt.",
    ),
    strategyCandidate(
      "solution_aware",
      "consideration",
      `How do ${category} handle ${useCase}?`,
      "buyer_job",
      "Strategy coverage: workflow understanding prompt.",
    ),
    strategyCandidate(
      "integration_use_case",
      "consideration",
      `How should ${buyer} use ${useCase} on Shopify product pages?`,
      "buyer_job",
      "Strategy coverage: integration prompt.",
    ),
  ];

  for (const competitor of competitorNames) {
    prompts.push(
      strategyCandidate(
        "competitor_comparison",
        "evaluation",
        `What are the best alternatives to ${competitor} for ${comparison}?`,
        "competitor",
        "Strategy coverage: competitor alternative prompt.",
      ),
    );
  }

  if (competitorNames[0]) {
    prompts.push(
      strategyCandidate(
        "competitor_comparison",
        "evaluation",
        `How does ${strategy.brand.name} compare with ${competitorNames[0]} for ${comparison}?`,
        "competitor",
        "Strategy coverage: brand comparison prompt.",
      ),
    );
  }

  prompts.push(
    strategyCandidate(
      "high_intent_purchase",
      "decision",
      `Is ${strategy.brand.name} a good fit for ${buyer} that need ${useCase}?`,
      "purchase",
      "Strategy coverage: brand-fit prompt.",
    ),
  );

  return prompts.filter((candidate) =>
    promptQualityIssues(candidate.prompt, strategy).length === 0
  );
}

function problemPromptForStrategy(input: {
  buyer: string;
  pain: string | undefined;
  category: string;
  useCase: string;
  strategy: BuyerPromptStrategyInput;
}) {
  const pain =
    input.pain ??
    input.strategy.buyerJobs[0]?.pain ??
    input.useCase ??
    input.category;
  const domainText = [
    input.category,
    input.useCase,
    pain,
    input.buyer,
    ...input.strategy.primaryUseCases,
  ].join(" ").toLowerCase();

  if (isPhotoStrategyText(domainText)) {
    return `How can ${input.buyer} get professional product photos without ${formatPainAsConstraint(pain)}?`;
  }

  if (/\b(stock act|disclosure|disclosures|filing|filings|trade|trades|tracking|alerts?)\b/.test(domainText)) {
    const trackingObject = pain.replace(/\btracking\b/gi, "").replace(/\s+/g, " ").trim();
    return `How can ${input.buyer} track ${trackingObject || pain} without manually checking filings every day?`;
  }

  if (/\bwithout\b/i.test(pain)) {
    return `How can ${input.buyer} ${formatPainAsTask(pain)}?`;
  }

  return `How can ${input.buyer} solve ${pain} without manual work?`;
}

function strategyCandidate(
  group: BuyerPromptCandidateDraft["group"],
  journeyPhase: BuyerPromptCandidateDraft["journeyPhase"],
  prompt: string,
  source: BuyerPromptCandidateDraft["source"],
  llmRationale: string,
): BuyerPromptCandidateDraft {
  return {
    id: slug(`${group} ${prompt}`),
    group,
    journeyPhase,
    prompt,
    buyerJob: llmRationale,
    source,
    llmRationale,
  };
}

function pluralizePromptNoun(value: string) {
  if (/\b(apps|tools|generators|platforms)\b/i.test(value)) return value;
  if (/\b(app|tool|generator|platform)\b/i.test(value)) {
    return value.replace(/\b(app|tool|generator|platform)\b/gi, (match) => {
      const lower = match.toLowerCase();
      if (lower === "app") return "apps";
      if (lower === "tool") return "tools";
      if (lower === "generator") return "generators";
      return "platforms";
    });
  }

  return value;
}

function formatPainAsConstraint(value: string | undefined) {
  if (!value) return "a traditional photoshoot";
  return value.replace(/^no\s+/i, "a ");
}

function formatPainAsTask(value: string) {
  return value
    .replace(/^automating\b/i, "automate")
    .replace(/^choosing\b/i, "choose")
    .replace(/^comparing\b/i, "compare")
    .replace(/^connecting\b/i, "connect")
    .replace(/^finding\b/i, "find")
    .replace(/^getting\b/i, "get")
    .replace(/^handling\b/i, "handle")
    .replace(/^managing\b/i, "manage")
    .replace(/^preparing\b/i, "prepare")
    .replace(/^scaling\b/i, "scale")
    .replace(/^understanding\b/i, "understand");
}

function comparisonTopic(strategy: BuyerPromptStrategyInput) {
  const candidates = [
    strategy.buyerLanguage?.comparisonNoun,
    strategy.buyerLanguage?.useCaseNoun,
    strategy.buyerLanguage?.productNoun,
    strategy.category,
    ...strategy.primaryUseCases,
  ].filter((value): value is string => Boolean(value));
  const clean = candidates
    .map(sanitizeComparisonTopic)
    .find((value) => value.length > 0);

  return clean ?? strategy.category;
}

function sanitizeComparisonTopic(value: string) {
  const normalized = value
    .replace(/\b(product\s+)?photoshoot alternatives?\b/gi, "")
    .replace(/\balternatives?\b/gi, "")
    .replace(/\bvs\.?\b/gi, "")
    .replace(/\bcompare(?:d|s|ing)?\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  if (/^(for|to|with)\b/i.test(normalized)) return "";

  return normalized;
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
  if (/\bfor\s+[^?]*\balternatives?\b/i.test(prompt)) {
    issues.push("Prompt uses alternatives as the comparison topic.");
  }
  if (/\bproduct photoshoot alternatives?\b/i.test(prompt)) {
    issues.push("Prompt uses awkward product photoshoot alternatives wording.");
  }
  if (!isPhotoStrategy(strategy) && /\b(product photos?|photoshoot|model photos?)\b/i.test(prompt)) {
    issues.push("Prompt uses product-photo wording for a non-photo strategy.");
  }
  if (/\bteams\s+recording\b/i.test(prompt)) {
    issues.push("Prompt contains clause-like audience wording.");
  }

  return issues;
}

function isPhotoStrategy(strategy: BuyerPromptStrategyInput) {
  return isPhotoStrategyText([
    strategy.audience,
    strategy.category,
    strategy.positioning,
    strategy.conversionGoal,
    strategy.buyerLanguage?.buyerNoun,
    strategy.buyerLanguage?.categoryNoun,
    strategy.buyerLanguage?.productNoun,
    strategy.buyerLanguage?.useCaseNoun,
    strategy.buyerLanguage?.painNoun,
    strategy.buyerLanguage?.comparisonNoun,
    ...strategy.primaryUseCases,
    ...strategy.buyerJobs.map((job) => `${job.job} ${job.pain}`),
  ].filter(Boolean).join(" ").toLowerCase());
}

function isPhotoStrategyText(value: string) {
  return /\b(photo|photos|image|images|model|models|fashion|apparel|shoot|product page)\b/.test(value);
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
  applyPromptQualityPolicy(score, candidate, strategy);
  const totalScore = Object.values(score).reduce((sum, value) => sum + value, 0);

  return buyerPromptCandidateSchema.parse({
    ...candidate,
    promptIntent: candidate.promptIntent ?? classifyPromptIntent(candidate, strategy),
    portfolioBucket: candidate.portfolioBucket ?? classifyPortfolioBucket(candidate, strategy),
    score,
    totalScore,
    rationale: rationaleForCandidate(candidate, score),
  });
}

function buildPromptSets(input: {
  candidates: BuyerPromptCandidate[];
  strategy: BuyerPromptStrategyInput;
  portfolioSize: number;
}) {
  const discoveryBaseline = buildPortfolioSet({
    id: "discovery_baseline",
    label: "Discovery baseline",
    selectionRule: DEFAULT_SELECTION_RULE,
    candidates: input.candidates,
    strategy: input.strategy,
    portfolioSize: input.portfolioSize,
    bucketTargets: scaleBucketTargets(DISCOVERY_BUCKET_TARGETS, input.portfolioSize),
    bucketCaps: scaleBucketTargets(DISCOVERY_BUCKET_CAPS, input.portfolioSize),
    bucketOrder: DISCOVERY_BUCKET_ORDER,
  });
  const brandEvaluation = buildPortfolioSet({
    id: "brand_evaluation",
    label: "Brand/evaluation",
    selectionRule: BRAND_EVALUATION_SELECTION_RULE,
    candidates: input.candidates,
    strategy: input.strategy,
    portfolioSize: input.portfolioSize,
    bucketTargets: scaleBucketTargets(BRAND_EVALUATION_BUCKET_TARGETS, input.portfolioSize),
    bucketCaps: scaleBucketTargets(BRAND_EVALUATION_BUCKET_CAPS, input.portfolioSize),
    bucketOrder: BRAND_EVALUATION_BUCKET_ORDER,
  });

  return { discoveryBaseline, brandEvaluation };
}

function buildPortfolioSet(input: {
  id: "discovery_baseline" | "brand_evaluation";
  label: string;
  selectionRule: string;
  candidates: BuyerPromptCandidate[];
  strategy: BuyerPromptStrategyInput;
  portfolioSize: number;
  bucketTargets: Record<PromptPortfolioBucket, number>;
  bucketCaps: Record<PromptPortfolioBucket, number>;
  bucketOrder: PromptPortfolioBucket[];
}) {
  const selected: BuyerPromptCandidate[] = [];
  const selectableCandidates = input.candidates.filter((candidate) =>
    hasSelectableJobFit(candidate, input.strategy)
  );

  for (const bucket of input.bucketOrder) {
    selectByBucket({
      candidates: selectableCandidates,
      selected,
      bucket,
      target: input.bucketTargets[bucket],
      cap: input.bucketCaps[bucket],
    });
  }

  for (const bucket of input.bucketOrder) {
    fillByBucket({
      candidates: selectableCandidates,
      selected,
      bucket,
      portfolioSize: input.portfolioSize,
      cap: input.bucketCaps[bucket],
    });
  }

  const selectedCandidates = selected.sort(sortCandidates);

  return {
    id: input.id,
    label: input.label,
    selectionRule: input.selectionRule,
    selectedPrompts: selectedCandidates.map<PromptInput>((candidate) => ({
      id: candidate.id,
      group: candidate.group,
      prompt: candidate.prompt,
    })),
    selectedCandidates,
  };
}

function selectByBucket(input: {
  candidates: BuyerPromptCandidate[];
  selected: BuyerPromptCandidate[];
  bucket: PromptPortfolioBucket;
  target: number;
  cap: number;
}) {
  for (const group of preferredGroupsForBucket(input.bucket)) {
    if (bucketCount(input.selected, input.bucket) >= input.target) break;
    const candidate = input.candidates.find((item) =>
      item.portfolioBucket === input.bucket &&
      item.group === group &&
      !hasSelected(input.selected, item) &&
      bucketCount(input.selected, input.bucket) < input.cap
    );
    if (candidate) input.selected.push(candidate);
  }

  fillByBucket({
    candidates: input.candidates,
    selected: input.selected,
    bucket: input.bucket,
    portfolioSize: input.selected.length + Math.max(
      0,
      input.target - bucketCount(input.selected, input.bucket),
    ),
    cap: input.cap,
  });
}

function fillByBucket(input: {
  candidates: BuyerPromptCandidate[];
  selected: BuyerPromptCandidate[];
  bucket: PromptPortfolioBucket;
  portfolioSize: number;
  cap: number;
}) {
  for (const candidate of input.candidates) {
    if (input.selected.length >= input.portfolioSize) break;
    if (candidate.portfolioBucket !== input.bucket) continue;
    if (bucketCount(input.selected, input.bucket) >= input.cap) break;
    if (hasSelected(input.selected, candidate)) continue;
    input.selected.push(candidate);
  }
}

function preferredGroupsForBucket(bucket: PromptPortfolioBucket) {
  if (bucket === "neutral_discovery") {
    return ["problem_aware", "category_search"] satisfies PromptGroup[];
  }
  if (bucket === "category_best_tool") {
    return ["category_search", "high_intent_purchase"] satisfies PromptGroup[];
  }
  if (bucket === "use_case_fit") {
    return ["solution_aware", "category_search", "high_intent_purchase"] satisfies PromptGroup[];
  }
  if (bucket === "competitor_alternative") {
    return ["competitor_comparison", "category_search"] satisfies PromptGroup[];
  }
  if (bucket === "implementation") {
    return ["integration_use_case", "solution_aware"] satisfies PromptGroup[];
  }
  if (bucket === "brand_evaluation") {
    return ["high_intent_purchase", "category_search"] satisfies PromptGroup[];
  }
  return ["competitor_comparison", "high_intent_purchase"] satisfies PromptGroup[];
}

function bucketCount(candidates: BuyerPromptCandidate[], bucket: PromptPortfolioBucket) {
  return candidates.filter((candidate) => candidate.portfolioBucket === bucket).length;
}

function hasSelected(candidates: BuyerPromptCandidate[], candidate: BuyerPromptCandidate) {
  return candidates.some((item) => item.id === candidate.id);
}

function scaleBucketTargets(
  targets: Record<PromptPortfolioBucket, number>,
  portfolioSize: number,
) {
  if (portfolioSize === 10) return targets;

  const scale = portfolioSize / 10;
  const scaled = Object.fromEntries(
    PORTFOLIO_BUCKETS.map((bucket) => [
      bucket,
      Math.floor(targets[bucket] * scale),
    ]),
  ) as Record<PromptPortfolioBucket, number>;
  for (const bucket of PORTFOLIO_BUCKETS) {
    if (targets[bucket] > 0 && scaled[bucket] === 0) scaled[bucket] = 1;
  }
  while (Object.values(scaled).reduce((sum, value) => sum + value, 0) > portfolioSize) {
    const bucket = [...PORTFOLIO_BUCKETS]
      .sort((left, right) => scaled[right] - scaled[left])[0];
    scaled[bucket] -= 1;
  }
  while (Object.values(scaled).reduce((sum, value) => sum + value, 0) < portfolioSize) {
    const bucket = [...PORTFOLIO_BUCKETS]
      .filter((item) => targets[item] > 0)
      .sort((left, right) => targets[right] - targets[left])[0];
    if (!bucket) break;
    scaled[bucket] += 1;
  }

  return scaled;
}

function classifyPromptIntent(
  candidate: Pick<BuyerPromptCandidateDraft, "prompt" | "group" | "source">,
  strategy: BuyerPromptStrategyInput,
): PromptPortfolioIntent {
  const prompt = normalizeSearchText(candidate.prompt);
  const brandTerms = [strategy.brand.name, ...strategy.brand.aliases]
    .map(normalizeSearchText)
    .filter(Boolean);
  if (brandTerms.some((term) => prompt.includes(term))) return "brand";

  const competitorTerms = strategy.competitors
    .flatMap((competitor) => [competitor.name, ...competitor.aliases])
    .map(normalizeSearchText)
    .filter(Boolean);
  if (
    candidate.group === "competitor_comparison" ||
    candidate.source === "competitor" ||
    competitorTerms.some((term) => prompt.includes(term))
  ) {
    return "competitor";
  }

  return "neutral";
}

function classifyPortfolioBucket(
  candidate: Pick<BuyerPromptCandidateDraft, "prompt" | "group" | "source">,
  strategy: BuyerPromptStrategyInput,
): PromptPortfolioBucket {
  const prompt = normalizeSearchText(candidate.prompt);
  const brandMentioned = [strategy.brand.name, ...strategy.brand.aliases]
    .map(normalizeSearchText)
    .filter(Boolean)
    .some((brand) => prompt.includes(brand));
  const competitorCount = matchedCompetitors(prompt, strategy).length;

  if (isDirectComparisonPrompt(prompt, brandMentioned, competitorCount)) {
    return "direct_comparison";
  }
  if (brandMentioned) return "brand_evaluation";
  if (competitorCount > 0 || candidate.group === "competitor_comparison") {
    return "competitor_alternative";
  }
  if (candidate.group === "problem_aware") return "neutral_discovery";
  if (candidate.group === "integration_use_case" || /\b(publish|install|setup|prepare|shopify product pages?)\b/.test(prompt)) {
    return "implementation";
  }
  if (candidate.group === "category_search") return "category_best_tool";
  if (candidate.group === "solution_aware" || hasUseCaseLanguage(prompt, strategy)) {
    return "use_case_fit";
  }
  if (
    candidate.group === "high_intent_purchase" ||
    /\b(best|which|app|apps|tool|tools|software|platform)\b/.test(prompt)
  ) {
    return "category_best_tool";
  }

  return "neutral_discovery";
}

function isDirectComparisonPrompt(
  normalizedPrompt: string,
  brandMentioned: boolean,
  competitorCount: number,
) {
  if (competitorCount >= 2) return true;
  if (brandMentioned && competitorCount >= 1) return true;

  return competitorCount >= 1 &&
    /\b(compare|compares|compared|comparison|vs|versus|better than|better for)\b/.test(
      normalizedPrompt,
    );
}

function hasUseCaseLanguage(
  normalizedPrompt: string,
  strategy: BuyerPromptStrategyInput,
) {
  const useCaseTerms = [
    strategy.buyerLanguage?.useCaseNoun,
    ...strategy.primaryUseCases,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => [...tokenSet(value)]);

  return useCaseTerms.some((term) => normalizedPrompt.includes(term));
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

function applyPromptQualityPolicy(
  score: PromptQualityScore,
  candidate: BuyerPromptCandidateDraft,
  strategy: BuyerPromptStrategyInput,
) {
  if (isCompetitorVsCompetitorPrompt(candidate.prompt, strategy)) {
    score.icpFit = Math.max(1, score.icpFit - 1);
    score.productFit = Math.max(1, score.productFit - 2);
    score.assetOpportunity = Math.max(1, score.assetOpportunity - 1);
  }
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
    "group" | "source" | "llmRationale"
  >,
  score: PromptQualityScore,
) {
  return [
    candidate.llmRationale ? `LLM rationale: ${candidate.llmRationale}` : "",
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
  return left.prompt.localeCompare(right.prompt);
}

function hasSelectableJobFit(
  candidate: BuyerPromptCandidate,
  strategy: BuyerPromptStrategyInput,
) {
  if (jobFitScore(candidate.score) < MIN_SELECTABLE_JOB_FIT) return false;
  if (candidate.promptIntent === "brand" || candidate.promptIntent === "competitor") {
    return true;
  }

  return productFitScore(candidate.prompt, strategy) >= 2;
}

function jobFitScore(score: PromptQualityScore) {
  return score.buyerIntent + score.commercialCloseness + score.icpFit + score.productFit;
}

function matchedCompetitors(text: string, strategy: BuyerPromptStrategyInput) {
  return strategy.competitors.flatMap((competitor) => {
    const names = [competitor.name, ...competitor.aliases]
      .map(normalizeSearchText)
      .filter(Boolean);
    return names.some((name) => text.includes(name))
      ? [normalizeSearchText(competitor.name)]
      : [];
  });
}

function isCompetitorVsCompetitorPrompt(prompt: string, strategy: BuyerPromptStrategyInput) {
  const text = normalizeSearchText(prompt);
  const competitorCount = matchedCompetitors(text, strategy).length;
  const brandMentioned = [strategy.brand.name, ...strategy.brand.aliases]
    .map(normalizeSearchText)
    .some((brand) => brand && text.includes(brand));

  return competitorCount >= 2 && !brandMentioned;
}

function tokenSet(value: string) {
  return new Set(
    normalizeSearchText(value)
      .split(" ")
      .map(normalizeToken)
      .filter((term) => term.length >= 4 && !STOP_WORDS.has(term)),
  );
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bphotography\b/g, "photo")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(value: string) {
  return value
    .replace(/ies$/g, "y")
    .replace(
      /(apps|tools|photos|images|models|brands)$/g,
      (match) => match.slice(0, -1),
    )
    .replace(/s$/g, "");
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

const STOP_WORDS = new Set([
  "about",
  "after",
  "best",
  "choose",
  "create",
  "does",
  "from",
  "good",
  "handle",
  "help",
  "into",
  "should",
  "that",
  "their",
  "them",
  "turn",
  "what",
  "when",
  "which",
  "with",
  "without",
]);

const PORTFOLIO_BUCKETS: PromptPortfolioBucket[] = [
  "neutral_discovery",
  "category_best_tool",
  "use_case_fit",
  "competitor_alternative",
  "implementation",
  "brand_evaluation",
  "direct_comparison",
];

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
