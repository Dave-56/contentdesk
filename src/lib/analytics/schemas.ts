import { z } from "zod";

export const analyticsSourceSchema = z.enum([
  "ga4",
  "gsc",
  "shopify_partner",
  "posthog",
]);
export type AnalyticsSource = z.infer<typeof analyticsSourceSchema>;

export const analyticsSourceStatusSchema = z.enum([
  "ok",
  "missing_config",
  "failed_auth",
  "failed",
]);
export type AnalyticsSourceStatus = z.infer<typeof analyticsSourceStatusSchema>;

export const analyticsDailyMetricSchema = z.object({
  id: z.string().trim().min(1),
  brandSlug: z.string().trim().min(1),
  metricDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: analyticsSourceSchema,
  status: analyticsSourceStatusSchema,
  provisional: z.boolean(),
  metrics: z.record(z.unknown()),
  error: z.string().nullable(),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  pulledAt: z.string().datetime(),
});
export type AnalyticsDailyMetric = z.infer<typeof analyticsDailyMetricSchema>;

export const attributionActionTypeSchema = z.enum([
  "article_published",
  "reddit_replied",
  "listing_updated",
  "prompt_citation_seen",
]);
export type AttributionActionType = z.infer<typeof attributionActionTypeSchema>;

export const attributionActionSchema = z.object({
  id: z.string().trim().min(1),
  brandSlug: z.string().trim().min(1),
  actionType: attributionActionTypeSchema,
  occurredAt: z.string().datetime(),
  sourceRef: z.record(z.unknown()),
});
export type AttributionAction = z.infer<typeof attributionActionSchema>;

export type SourceFetchResult = {
  status: AnalyticsSourceStatus;
  metrics: Record<string, unknown>;
  error?: string;
};

// Referrer hosts that count a GA4 session as AI-search traffic. Substring
// match against sessionSource, lowercase.
export const aiReferrerHosts = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "claude.ai",
  "copilot.microsoft.com",
] as const;

export function isAiReferrerSource(sessionSource: string) {
  const lower = sessionSource.toLowerCase();
  return aiReferrerHosts.some((host) => lower.includes(host));
}
