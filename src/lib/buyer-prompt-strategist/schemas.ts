import { z } from "zod";
import {
  assetInventoryItemSchema,
  competitorSchema,
  promptInputSchema,
  sourceFormatSchema,
  promptGroupSchema,
  providerSchema,
} from "@/lib/prompt-scan/schemas";

const text = z.string().trim().min(1);
const score = z.number().int().min(1).max(5);

export const buyerPromptMarketSchema = z.enum(["shopify_app", "saas"]);

export const buyerJourneyPhaseSchema = z.enum([
  "awareness",
  "consideration",
  "evaluation",
  "decision",
]);

export type BuyerJourneyPhase = z.infer<typeof buyerJourneyPhaseSchema>;

export const buyerPromptLanguageSchema = z.object({
  buyerNoun: text,
  categoryNoun: text,
  productNoun: text,
  useCaseNoun: text,
  painNoun: text,
  conversionNoun: text,
  comparisonNoun: text,
});

export const buyerPromptClassificationWarningSchema = z.object({
  field: text,
  message: text,
  severity: z.enum(["info", "warning", "manual_review"]),
});

export const buyerPromptMarketClassificationSchema = z.object({
  brandName: text,
  market: buyerPromptMarketSchema,
  category: text,
  audience: text,
  positioning: text,
  conversionGoal: text,
  primaryUseCases: z.array(text).min(1),
  buyerLanguage: buyerPromptLanguageSchema,
  confidence: z.object({
    brand: score,
    category: score,
    audience: score,
    buyerLanguage: score,
  }),
  warnings: z.array(buyerPromptClassificationWarningSchema),
});

export type BuyerPromptMarketClassification = z.infer<
  typeof buyerPromptMarketClassificationSchema
>;

export type BuyerPromptLanguage = z.infer<typeof buyerPromptLanguageSchema>;

export const promptEvidenceSourceTypeSchema = z.enum([
  "autocomplete",
  "serp",
  "reddit_forum",
  "gsc",
  "manual",
]);

export const promptEvidenceQualitySchema = z.enum([
  "unproven",
  "low",
  "medium",
  "high",
]);

export const serpIntentSchema = z.enum([
  "choose_tool",
  "compare_tools",
  "solve_problem",
  "learn_definition",
  "get_inspiration",
  "troubleshoot",
  "mixed",
  "unrelated",
]);

export const intentMatchSchema = z.enum(["weak", "medium", "strong"]);

export const buyerPromptDemandEvidenceSchema = z.object({
  sourceType: promptEvidenceSourceTypeSchema,
  query: text,
  evidenceText: text,
  url: z.string().url().optional(),
  title: text.optional(),
  snippet: text.optional(),
  rank: z.number().int().min(1).optional(),
  observedAt: z.string().datetime(),
});

export type BuyerPromptDemandEvidence = z.infer<
  typeof buyerPromptDemandEvidenceSchema
>;

export const perplexityBusinessReadSchema = z.object({
  targetUrl: z.string().url(),
  targetDomain: text,
  targetIdentityConfirmed: z.boolean(),
  targetIdentityReason: text,
  brandName: text,
  market: buyerPromptMarketSchema,
  product: text,
  category: text,
  audience: text,
  positioning: text,
  problemSolved: text,
  solution: text,
  conversionGoal: text,
  primaryUseCases: z.array(text).min(1),
  buyerLanguage: buyerPromptLanguageSchema,
  competitors: z.array(
    competitorSchema.extend({
      clearAlternative: z.boolean(),
      confidence: score,
      reason: text,
    }),
  ).default([]),
  confidence: z.object({
    targetIdentity: score,
    product: score,
    category: score,
    audience: score,
    buyerLanguage: score,
  }),
  warnings: z.array(buyerPromptClassificationWarningSchema).default([]),
  citations: z.array(z.string().url()).default([]),
  evidenceSummary: text,
});

export type PerplexityBusinessRead = z.infer<typeof perplexityBusinessReadSchema>;

export const buyerPromptStrategyInputSchema = z.object({
  brand: z.object({
    name: text,
    aliases: z.array(text).default([]),
    domains: z.array(text).default([]),
  }),
  provider: providerSchema,
  defaultRecheckDays: z.number().int().min(1).default(1),
  experimentWindowDays: z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1),
  }),
  audience: text,
  category: text,
  positioning: text,
  conversionGoal: text,
  primaryUseCases: z.array(text).min(1),
  market: buyerPromptMarketSchema.default("saas"),
  buyerLanguage: buyerPromptLanguageSchema.optional(),
  classificationWarnings: z.array(buyerPromptClassificationWarningSchema).default([]),
  buyerJobs: z.array(
    z.object({
      id: text,
      group: promptGroupSchema,
      job: text,
      pain: text,
      commercialCloseness: score,
      productFit: score,
      assetOpportunity: score,
    }),
  ).min(1),
  competitors: z.array(competitorSchema),
  assetInventory: z.array(assetInventoryItemSchema),
  portfolioSize: z.number().int().min(5).max(20).default(10),
});

export type BuyerPromptStrategyInput = z.infer<
  typeof buyerPromptStrategyInputSchema
>;

export const promptQualityScoreSchema = z.object({
  buyerIntent: score,
  commercialCloseness: score,
  icpFit: score,
  productFit: score,
  competitiveLikelihood: score,
  assetOpportunity: score,
});

export type PromptQualityScore = z.infer<typeof promptQualityScoreSchema>;

export const promptPortfolioIntentSchema = z.enum([
  "neutral",
  "competitor",
  "brand",
]);

export type PromptPortfolioIntent = z.infer<typeof promptPortfolioIntentSchema>;

export const promptPortfolioBucketSchema = z.enum([
  "neutral_discovery",
  "category_best_tool",
  "use_case_fit",
  "competitor_alternative",
  "implementation",
  "brand_evaluation",
  "direct_comparison",
]);

export type PromptPortfolioBucket = z.infer<typeof promptPortfolioBucketSchema>;

export const buyerPromptCandidateSchema = z.object({
  id: text,
  group: promptGroupSchema,
  journeyPhase: buyerJourneyPhaseSchema.default("consideration"),
  prompt: text,
  buyerJob: text,
  source: z.enum(["buyer_job", "competitor", "purchase", "category"]),
  promptIntent: promptPortfolioIntentSchema.optional(),
  portfolioBucket: promptPortfolioBucketSchema.optional(),
  rawQuery: text.optional(),
  evidenceQuality: promptEvidenceQualitySchema.optional(),
  serpIntent: serpIntentSchema.optional(),
  intentMatch: intentMatchSchema.optional(),
  demandEvidence: z.array(buyerPromptDemandEvidenceSchema).optional(),
  score: promptQualityScoreSchema,
  totalScore: z.number().int().min(6).max(30),
  rationale: text,
});

export type BuyerPromptCandidate = z.infer<typeof buyerPromptCandidateSchema>;

export const llmBuyerPromptCandidateSchema = z.object({
  group: promptGroupSchema,
  journeyPhase: buyerJourneyPhaseSchema,
  prompt: text,
  buyerJob: text,
  source: z.enum(["buyer_job", "competitor", "purchase", "category"]),
  buyerIntent: text,
  rationale: text,
  expectedSourceFormats: z.array(sourceFormatSchema),
});

export type LlmBuyerPromptCandidate = z.infer<typeof llmBuyerPromptCandidateSchema>;

export const discoveredBuyerPromptCandidateSchema = z.object({
  id: text,
  group: promptGroupSchema,
  journeyPhase: buyerJourneyPhaseSchema.default("consideration"),
  rawQuery: text,
  prompt: text,
  buyerJob: text,
  source: z.enum(["buyer_job", "competitor", "purchase", "category"]),
  evidenceQuality: promptEvidenceQualitySchema,
  serpIntent: serpIntentSchema.default("mixed"),
  intentMatch: intentMatchSchema.default("medium"),
  demandEvidence: z.array(buyerPromptDemandEvidenceSchema).min(1),
});

export type DiscoveredBuyerPromptCandidate = z.infer<
  typeof discoveredBuyerPromptCandidateSchema
>;

export const buyerPromptDiscoveryFileSchema = z.object({
  brand: text,
  generatedAt: z.string().datetime(),
  strategySource: text.optional(),
  seedProbes: z.array(
    z.object({
      query: text,
      group: promptGroupSchema,
      sourceField: text,
    }),
  ),
  candidates: z.array(discoveredBuyerPromptCandidateSchema),
});

export type BuyerPromptDiscoveryFile = z.infer<
  typeof buyerPromptDiscoveryFileSchema
>;

export const buyerPromptPortfolioSetSchema = z.object({
  id: z.enum(["discovery_baseline", "brand_evaluation"]),
  label: text,
  selectionRule: text,
  selectedPrompts: z.array(promptInputSchema),
  selectedCandidates: z.array(buyerPromptCandidateSchema),
});

export const buyerPromptPortfolioSchema = z.object({
  brand: text,
  generatedAt: z.string().datetime(),
  portfolioSize: z.number().int().min(5).max(20),
  selectionRule: text,
  selectedPrompts: z.array(promptInputSchema),
  selectedCandidates: z.array(buyerPromptCandidateSchema),
  promptSets: z.object({
    discoveryBaseline: buyerPromptPortfolioSetSchema,
    brandEvaluation: buyerPromptPortfolioSetSchema,
  }),
  candidates: z.array(buyerPromptCandidateSchema),
});

export type BuyerPromptPortfolio = z.infer<typeof buyerPromptPortfolioSchema>;
