import { z } from "zod";
import { researchSourceSchema } from "@/lib/schemas";

export const discoveredPageSchema = z.object({
  url: z.string().url(),
  title: z.string().default(""),
  kind: z.enum(["homepage", "about", "pricing", "blog", "resources", "docs", "faq", "other"]),
  excerpt: z.string().default(""),
});

export const profileWarningSchema = z.object({
  field: z.string().trim().min(1),
  message: z.string().trim().min(1),
  severity: z.enum(["info", "warning", "manual_review"]),
});

export const siteProfileSchema = z.object({
  websiteUrl: z.string().url(),
  companyName: z.string(),
  title: z.string(),
  metaDescription: z.string(),
  headline: z.string(),
  summary: z.string(),
  audienceGuess: z.string(),
  problemSolved: z.string(),
  featuresUseCases: z.array(z.string()),
  existingContent: z.array(discoveredPageSchema),
  evidenceQuality: z.enum(["strong", "thin", "insufficient"]).default("thin"),
  profileSources: z.array(researchSourceSchema).default([]),
  profileWarnings: z.array(profileWarningSchema).default([]),
});

export const buyerPromptSchema = z.object({
  prompt: z.string(),
  intent: z.enum([
    "best_tools",
    "use_case",
    "alternatives",
    "comparison",
    "fit",
    "pricing",
    "implementation",
    "trust",
  ]),
  runIn: z.array(z.enum(["Google", "ChatGPT", "Perplexity"])),
  lookFor: z.string(),
});

export const discoverySearchSchema = z.object({
  query: z.string(),
  purpose: z.string(),
});

export const likelySourceSchema = z.object({
  name: z.string(),
  url: z.string().url().optional(),
  sourceType: z.enum([
    "competitor",
    "adjacent_tool",
    "directory",
    "listicle",
    "review_site",
    "marketplace",
    "reddit_forum",
    "guide",
    "comparison_page",
    "unknown",
  ]),
  reason: z.string(),
});

export const teardownPacketSchema = z.object({
  websiteUrl: z.string().url(),
  siteProfile: siteProfileSchema,
  categoryGuess: z.string(),
  categoryConfidence: z.enum(["low", "medium", "high"]),
  likelyCompetitorsOrSources: z.array(likelySourceSchema),
  buyerPrompts: z.array(buyerPromptSchema),
  discoverySearches: z.array(discoverySearchSchema),
  firstPassGap: z.string(),
  recommendedAsset: z.object({
    assetType: z.enum(["page", "FAQ", "guide", "comparison", "alternatives", "use-case page"]),
    title: z.string(),
    whyItMatters: z.string(),
    suggestedStructure: z.array(z.string()),
  }),
  caveats: z.array(z.string()),
  usedAi: z.boolean(),
  usedSearchProvider: z.boolean(),
});

export type DiscoveredPage = z.infer<typeof discoveredPageSchema>;
export type ProfileWarning = z.infer<typeof profileWarningSchema>;
export type SiteProfile = z.infer<typeof siteProfileSchema>;
export type BuyerPrompt = z.infer<typeof buyerPromptSchema>;
export type DiscoverySearch = z.infer<typeof discoverySearchSchema>;
export type TeardownPacket = z.infer<typeof teardownPacketSchema>;
