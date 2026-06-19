import { z } from "zod";

export const redditOpportunityFitSchema = z.enum(["strong", "medium", "weak", "skip"]);
export const redditOpportunityStatusSchema = z.enum([
  "new",
  "surfaced",
  "replied",
  "skipped",
]);
export const redditMentionRecommendationSchema = z.enum(["mention", "no_mention"]);
export const redditPromoRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const redditPostSchema = z.object({
  redditPostId: z.string().trim().min(1),
  subreddit: z.string().trim().min(1),
  author: z.string().trim().default(""),
  title: z.string().trim().min(1),
  url: z.string().url(),
  publishedAt: z.string().datetime(),
  content: z.string().trim().default(""),
});

export const redditOpportunityClassificationSchema = z.object({
  fit: redditOpportunityFitSchema,
  score: z.number().int().min(0).max(100),
  matchedTerms: z.array(z.string().trim().min(1)).default([]),
  whySurfaced: z.array(z.string().trim().min(1)).default([]),
  tinyLemonFit: z.string().trim().default(""),
  promoRisk: z.string().trim().default(""),
  promoRiskLevel: redditPromoRiskLevelSchema.default("high"),
  suggestedAngle: z.string().trim().default(""),
  mentionRecommendation: redditMentionRecommendationSchema.default("no_mention"),
  draftReply: z.string().trim().default(""),
});

export const redditOpportunityRecordSchema = z.object({
  id: z.string().trim().min(1),
  redditPostId: z.string().trim().min(1),
  subreddit: z.string().trim().min(1),
  title: z.string().trim().min(1),
  url: z.string().url(),
  content: z.string().trim().default(""),
  publishedAt: z.string().datetime(),
  matchedTerms: z.array(z.string().trim().min(1)).default([]),
  fit: redditOpportunityFitSchema,
  score: z.number().int().min(0).max(100),
  whySurfaced: z.array(z.string().trim().min(1)).default([]),
  tinyLemonFit: z.string().trim().default(""),
  promoRisk: z.string().trim().default(""),
  promoRiskLevel: redditPromoRiskLevelSchema.default("high"),
  suggestedAngle: z.string().trim().default(""),
  mentionRecommendation: redditMentionRecommendationSchema,
  draftReply: z.string().trim().default(""),
  status: redditOpportunityStatusSchema,
  slackChannelId: z.string().nullable().default(null),
  slackMessageTs: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const redditOpportunityMuteSchema = z.object({
  id: z.string().trim().min(1),
  scope: z.enum(["keyword", "subreddit"]),
  value: z.string().trim().min(1),
  reason: z.string().trim().default(""),
});

export type RedditOpportunityFit = z.infer<typeof redditOpportunityFitSchema>;
export type RedditPromoRiskLevel = z.infer<typeof redditPromoRiskLevelSchema>;
export type RedditOpportunityStatus = z.infer<typeof redditOpportunityStatusSchema>;
export type RedditPost = z.infer<typeof redditPostSchema>;
export type RedditOpportunityClassification = z.infer<
  typeof redditOpportunityClassificationSchema
>;
export type RedditOpportunityRecord = z.infer<typeof redditOpportunityRecordSchema>;
export type RedditOpportunityMute = z.infer<typeof redditOpportunityMuteSchema>;
