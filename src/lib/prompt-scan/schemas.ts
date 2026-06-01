import { z } from "zod";

const text = z.string().trim().min(1);

export const promptGroupSchema = z.enum([
  "category_search",
  "competitor_comparison",
  "problem_aware",
  "solution_aware",
  "integration_use_case",
  "high_intent_purchase",
]);

export const providerSchema = z.literal("perplexity");

export const sourceFormatSchema = z.enum([
  "marketplace_listing",
  "reddit_thread",
  "comparison_page",
  "vendor_docs",
  "review_site",
  "youtube_video",
  "listicle",
  "product_page",
  "blog_guide",
  "official_docs",
  "unknown",
]);

export type SourceFormat = z.infer<typeof sourceFormatSchema>;

export const citationQualitySchema = z.enum([
  "owned_source",
  "earned_source",
  "platform_marketplace",
  "community",
  "affiliate_seo",
  "review_site",
  "unknown",
]);

export type CitationQuality = z.infer<typeof citationQualitySchema>;

export const mentionPositionSchema = z.enum([
  "top",
  "middle",
  "bottom",
  "absent",
]);

export const sourceStrengthSchema = z.enum(["weak", "medium", "strong"]);

export const recommendationConfidenceSchema = z.enum(["low", "medium", "high"]);

export const competitorSchema = z.object({
  name: text,
  aliases: z.array(text).default([]),
  domains: z.array(text).default([]),
});

export type Competitor = z.infer<typeof competitorSchema>;

export const assetInventoryItemSchema = z.object({
  type: z.enum([
    "shopify_app_store_listing",
    "homepage",
    "comparison_page",
    "alternative_page",
    "blog_guide",
    "docs_help",
    "reddit_community_mention",
    "youtube_video",
    "review_profile",
    "case_study",
  ]),
  status: z.enum(["present", "missing", "unknown"]),
  url: z.string().url().optional(),
  notes: z.string().trim().default(""),
});

export type AssetInventoryItem = z.infer<typeof assetInventoryItemSchema>;

export const tinyLemonPromptInputSchema = z.object({
  id: text,
  group: promptGroupSchema,
  prompt: text,
});

export type TinyLemonPromptInput = z.infer<typeof tinyLemonPromptInputSchema>;

export const promptScanConfigSchema = z.object({
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
  competitors: z.array(competitorSchema),
  assetInventory: z.array(assetInventoryItemSchema),
  prompts: z.array(tinyLemonPromptInputSchema).min(1),
});

export type PromptScanConfig = z.infer<typeof promptScanConfigSchema>;

export const citedSourceSchema = z.object({
  url: z.string().url(),
  domain: text,
  sourceFormat: sourceFormatSchema,
  citationQuality: citationQualitySchema,
});

export type CitedSource = z.infer<typeof citedSourceSchema>;

export const competitorVisibilitySchema = z.object({
  name: text,
  mentioned: z.boolean(),
  mentionCount: z.number().int().min(0),
  cited: z.boolean(),
  citationCount: z.number().int().min(0),
});

export type CompetitorVisibility = z.infer<typeof competitorVisibilitySchema>;

export const visibilityScoreSchema = z.object({
  tinyLemonMentioned: z.boolean(),
  tinyLemonCited: z.boolean(),
  mentionPosition: mentionPositionSchema,
  competitorsMentioned: z.array(competitorVisibilitySchema),
  competitorsCited: z.array(competitorVisibilitySchema),
  citationCount: z.number().int().min(0),
  sourceStrength: sourceStrengthSchema,
  score: z.number().min(0).max(100),
});

export type VisibilityScore = z.infer<typeof visibilityScoreSchema>;

export const promptScanRecordSchema = z.object({
  id: text,
  prompt: text,
  promptGroup: promptGroupSchema,
  provider: providerSchema,
  answerText: z.string(),
  citedUrls: z.array(z.string().url()),
  citedDomains: z.array(text),
  citedSources: z.array(citedSourceSchema),
  runDate: z.string().datetime(),
  visibilityScore: visibilityScoreSchema,
  recommendedNextAction: text,
  recommendationConfidence: recommendationConfidenceSchema,
  recheckDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type PromptScanRecord = z.infer<typeof promptScanRecordSchema>;

export const promptScanRunSchema = z.object({
  brand: text,
  provider: providerSchema,
  runDate: z.string().datetime(),
  recheckCadenceDays: z.number().int().min(1),
  experimentWindowDays: z.object({
    min: z.number().int().min(1),
    max: z.number().int().min(1),
  }),
  records: z.array(promptScanRecordSchema),
  summary: z.object({
    promptCount: z.number().int().min(0),
    tinyLemonMentionedCount: z.number().int().min(0),
    tinyLemonCitedCount: z.number().int().min(0),
    competitorOnlyCount: z.number().int().min(0),
    averageVisibilityScore: z.number().min(0).max(100),
  }),
});

export type PromptScanRun = z.infer<typeof promptScanRunSchema>;
