import { z } from "zod";
import {
  assetInventoryItemSchema,
  competitorSchema,
  promptInputSchema,
  promptGroupSchema,
  providerSchema,
} from "@/lib/prompt-scan/schemas";

const text = z.string().trim().min(1);
const score = z.number().int().min(1).max(5);

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

export const buyerPromptCandidateSchema = z.object({
  id: text,
  group: promptGroupSchema,
  prompt: text,
  buyerJob: text,
  source: z.enum(["buyer_job", "competitor", "purchase", "category"]),
  score: promptQualityScoreSchema,
  totalScore: z.number().int().min(6).max(30),
  rationale: text,
});

export type BuyerPromptCandidate = z.infer<typeof buyerPromptCandidateSchema>;

export const buyerPromptPortfolioSchema = z.object({
  brand: text,
  generatedAt: z.string().datetime(),
  portfolioSize: z.number().int().min(5).max(20),
  selectionRule: text,
  selectedPrompts: z.array(promptInputSchema),
  selectedCandidates: z.array(buyerPromptCandidateSchema),
  candidates: z.array(buyerPromptCandidateSchema),
});

export type BuyerPromptPortfolio = z.infer<typeof buyerPromptPortfolioSchema>;
