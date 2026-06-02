import { z } from "zod";
import type {
  AssetInventoryItem,
  PromptGroup,
  PromptScanRecord,
  PromptScanRun,
  SourceFormat,
} from "@/lib/prompt-scan/schemas";
import { promptScanRunSchema } from "@/lib/prompt-scan/schemas";
import { siteProfileSchema, type SiteProfile } from "@/lib/reddit-teardown/schemas";
import {
  buyerPromptStrategyInputSchema,
  type BuyerPromptStrategyInput,
} from "@/lib/buyer-prompt-strategist/schemas";

const recommendationPrioritySchema = z.enum(["high", "medium", "low"]);

export const visibilityRecommendationSchema = z.object({
  rank: z.number().int().min(1),
  title: z.string().trim().min(1),
  taskType: z.enum([
    "alternative_page",
    "comparison_page",
    "shopify_app_store_listing",
    "guide",
    "community_answer",
    "manual_inspection",
  ]),
  priority: recommendationPrioritySchema,
  confidence: z.enum(["high", "medium", "low"]),
  targetPromptId: z.string().trim().min(1),
  targetPrompt: z.string().trim().min(1),
  why: z.array(z.string().trim().min(1)).min(1),
  evidence: z.object({
    promptGroup: z.string().trim().min(1),
    tinyLemonMentioned: z.boolean(),
    tinyLemonCited: z.boolean(),
    competitorsMentioned: z.array(z.string().trim().min(1)),
    citedDomains: z.array(z.string().trim().min(1)),
    dominantSourceFormat: z.string().trim().min(1),
    missingOrWeakAssetType: z.string().trim().min(1).nullable(),
    targetCompetitor: z.string().trim().min(1).nullable(),
    targetCompetitorAssetStatus: z.enum(["present", "missing", "unknown"]),
    relatedAssets: z.array(
      z.object({
        title: z.string().trim().min(1),
        url: z.string().url(),
        matchedCompetitors: z.array(z.string().trim().min(1)),
      }),
    ),
  }),
  recheck: z.object({
    promptIds: z.array(z.string().trim().min(1)).min(1),
    afterPublish: z.boolean(),
    cadenceDays: z.number().int().min(1),
  }),
});

export type VisibilityRecommendation = z.infer<
  typeof visibilityRecommendationSchema
>;

export const visibilityRecommendationsFileSchema = z.object({
  brand: z.string().trim().min(1),
  provider: z.literal("perplexity"),
  generatedAt: z.string().datetime(),
  basedOnRunDate: z.string().datetime(),
  summary: z.object({
    promptCount: z.number().int().min(0),
    tinyLemonMentionedCount: z.number().int().min(0),
    tinyLemonCitedCount: z.number().int().min(0),
    competitorOnlyCount: z.number().int().min(0),
    averageVisibilityScore: z.number().min(0).max(100),
  }),
  recommendations: z.array(visibilityRecommendationSchema),
});

export type VisibilityRecommendationsFile = z.infer<
  typeof visibilityRecommendationsFileSchema
>;

export function buildVisibilityRecommendations(input: {
  strategy: BuyerPromptStrategyInput;
  run: PromptScanRun;
  siteProfile?: SiteProfile;
  generatedAt?: Date;
}): VisibilityRecommendationsFile {
  const strategy = buyerPromptStrategyInputSchema.parse(input.strategy);
  const run = promptScanRunSchema.parse(input.run);
  const siteProfile = input.siteProfile
    ? siteProfileSchema.parse(input.siteProfile)
    : undefined;
  const candidates = run.records
    .filter((record) => !record.visibilityScore.tinyLemonMentioned)
    .map((record) => scoreRecord(record, strategy, siteProfile))
    .sort((a, b) => b.score - a.score);

  const top = candidates[0];
  const recommendations = top
    ? [buildRecommendation({ record: top.record, strategy, siteProfile, rank: 1 })]
    : [];

  return visibilityRecommendationsFileSchema.parse({
    brand: run.brand,
    provider: run.provider,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    basedOnRunDate: run.runDate,
    summary: run.summary,
    recommendations,
  });
}

function scoreRecord(
  record: PromptScanRecord,
  strategy: BuyerPromptStrategyInput,
  siteProfile?: SiteProfile,
) {
  const dominantSourceFormat = dominant(
    record.citedSources.map((source) => source.sourceFormat),
  );
  const missingAsset = missingOrWeakAssetForRecord(record, strategy.assetInventory);
  const targetCompetitor = targetCompetitorName(record, strategy);
  const targetCoverage = targetCompetitor
    ? competitorAssetStatus(targetCompetitor, siteProfile)
    : "unknown";
  const competitorCount = record.visibilityScore.competitorsMentioned.length;

  let score = groupWeight(record.promptGroup);
  if (dominantSourceFormat === "comparison_page") score += 35;
  if (record.promptGroup === "competitor_comparison") score += 10;
  if (competitorCount > 0) score += 20;
  if (record.citedSources.length >= 5) score += 10;
  if (missingAsset) score += 20;
  if (targetCoverage === "missing") score += 15;
  if (targetCoverage === "present") score -= 30;
  if (record.recommendationConfidence === "high") score += 10;
  if (record.recommendationConfidence === "medium") score += 5;

  return { record, score };
}

function buildRecommendation(input: {
  record: PromptScanRecord;
  strategy: BuyerPromptStrategyInput;
  siteProfile?: SiteProfile;
  rank: number;
}): VisibilityRecommendation {
  const record = input.record;
  const dominantSourceFormat = dominant(
    record.citedSources.map((source) => source.sourceFormat),
  );
  const missingAsset = missingOrWeakAssetForRecord(record, input.strategy.assetInventory);
  const taskType = taskTypeForRecord(record, dominantSourceFormat);
  const competitorName =
    targetCompetitorName(record, input.strategy) ??
    record.visibilityScore.competitorsMentioned[0]?.name;
  const targetAssetStatus = competitorName
    ? competitorAssetStatus(competitorName, input.siteProfile)
    : "unknown";
  const relatedAssets = relatedCompetitorAssets({
    siteProfile: input.siteProfile,
    competitors: input.strategy.competitors.map((competitor) => competitor.name),
    exclude: competitorName,
  });

  const title =
    taskType === "alternative_page" && competitorName
      ? `Build ${competitorName} alternatives page`
      : titleForTaskType(taskType);

  return visibilityRecommendationSchema.parse({
    rank: input.rank,
    title,
    taskType,
    priority: "high",
    confidence: record.recommendationConfidence,
    targetPromptId: record.id,
    targetPrompt: record.prompt,
    why: whyForRecord({
      record,
      dominantSourceFormat,
      missingAsset,
      competitorName,
      targetAssetStatus,
      relatedAssets,
    }),
    evidence: {
      promptGroup: record.promptGroup,
      tinyLemonMentioned: record.visibilityScore.tinyLemonMentioned,
      tinyLemonCited: record.visibilityScore.tinyLemonCited,
      competitorsMentioned: record.visibilityScore.competitorsMentioned.map(
        (competitor) => competitor.name,
      ),
      citedDomains: record.citedDomains,
      dominantSourceFormat,
      missingOrWeakAssetType: missingAsset?.type ?? null,
      targetCompetitor: competitorName ?? null,
      targetCompetitorAssetStatus: targetAssetStatus,
      relatedAssets,
    },
    recheck: {
      promptIds: [record.id],
      afterPublish: true,
      cadenceDays: input.strategy.defaultRecheckDays,
    },
  });
}

function whyForRecord(input: {
  record: PromptScanRecord;
  dominantSourceFormat: SourceFormat;
  missingAsset?: AssetInventoryItem;
  competitorName?: string;
  targetAssetStatus: "present" | "missing" | "unknown";
  relatedAssets: RelatedAsset[];
}) {
  const why = [
    `${input.record.id} cites ${input.dominantSourceFormat.replaceAll("_", " ")} sources.`,
    "Tiny Lemon is absent from answer and citations.",
  ];

  if (input.competitorName) {
    why.push(`${input.competitorName} is active in this buyer answer.`);
  }
  if (input.competitorName && input.targetAssetStatus === "missing") {
    why.push(`No ${input.competitorName}-specific alternatives page found in site-profile evidence.`);
  } else if (input.missingAsset) {
    why.push(`${input.missingAsset.type} is ${input.missingAsset.status} in strategy.json.`);
  }
  if (input.relatedAssets.length > 0) {
    const related = input.relatedAssets
      .slice(0, 2)
      .map((asset) => asset.title)
      .join("; ");
    why.push(`Related competitor asset exists: ${related}. Reuse that pattern.`);
  }

  return why;
}

function taskTypeForRecord(
  record: PromptScanRecord,
  dominantSourceFormat: SourceFormat,
): VisibilityRecommendation["taskType"] {
  if (record.promptGroup === "competitor_comparison") return "alternative_page";
  if (dominantSourceFormat === "marketplace_listing") return "shopify_app_store_listing";
  if (dominantSourceFormat === "comparison_page") return "comparison_page";
  if (dominantSourceFormat === "blog_guide" || dominantSourceFormat === "listicle") {
    return "guide";
  }
  if (dominantSourceFormat === "reddit_thread") return "community_answer";

  return "manual_inspection";
}

function titleForTaskType(taskType: VisibilityRecommendation["taskType"]) {
  if (taskType === "comparison_page") return "Build comparison page";
  if (taskType === "shopify_app_store_listing") return "Improve Shopify App Store listing";
  if (taskType === "guide") return "Build focused buyer guide";
  if (taskType === "community_answer") return "Create helpful community answer";

  return "Inspect cited sources and create matching asset";
}

function targetCompetitorName(
  record: PromptScanRecord,
  strategy: Pick<BuyerPromptStrategyInput, "competitors">,
) {
  const haystack = `${record.id} ${record.prompt}`.toLowerCase();

  return strategy.competitors.find((competitor) =>
    [competitor.name, ...competitor.aliases].some((alias) =>
      haystack.includes(alias.toLowerCase()),
    ),
  )?.name;
}

type RelatedAsset = {
  title: string;
  url: string;
  matchedCompetitors: string[];
};

function competitorAssetStatus(competitorName: string, siteProfile?: SiteProfile) {
  if (!siteProfile) return "unknown";
  const assets = relatedCompetitorAssets({
    siteProfile,
    competitors: [competitorName],
  });

  return assets.length > 0 ? "present" : "missing";
}

function relatedCompetitorAssets(input: {
  siteProfile?: SiteProfile;
  competitors: string[];
  exclude?: string;
}): RelatedAsset[] {
  if (!input.siteProfile) return [];
  const excluded = input.exclude ? normalizeName(input.exclude) : "";
  const assets: RelatedAsset[] = [];

  for (const page of input.siteProfile.existingContent) {
    const text = [page.url, page.title, page.excerpt].join(" ");
    if (!/\b(alternative|alternatives|competitor|competitors|compare|comparison|vs)\b/i.test(text)) {
      continue;
    }

    const matchedCompetitors = input.competitors.filter((competitor) => {
      const normalized = normalizeName(competitor);
      return normalized !== excluded && normalizeName(text).includes(normalized);
    });
    if (matchedCompetitors.length === 0) continue;

    assets.push({
      title: extractAssetTitle(text, matchedCompetitors[0] ?? "competitor"),
      url: page.url,
      matchedCompetitors,
    });
  }

  return dedupeRelatedAssets(assets);
}

function extractAssetTitle(text: string, competitorName: string) {
  const escaped = competitorName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const titledMatch = text.match(
    new RegExp(
      `\\b(?:best|top|compare|comparison|${escaped})\\b[^.\\n]{0,120}\\b${escaped}\\b[^.\\n]{0,120}`,
      "i",
    ),
  );
  const fallbackMatch = text.match(
    new RegExp(`[^.\\n]{0,80}\\b${escaped}\\b[^.\\n]{0,120}`, "i"),
  );
  const raw = titledMatch?.[0] ?? fallbackMatch?.[0];
  if (!raw) return `${competitorName} competitor asset`;

  return raw
    .replace(/\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}.*$/i, "")
    .replace(/\s+\d{4}-\d{2}-\d{2}.*$/i, "")
    .replace(/\s+Compare\b.*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function dedupeRelatedAssets(assets: RelatedAsset[]) {
  const seen = new Set<string>();
  return assets.filter((asset) => {
    const key = `${asset.url}:${asset.matchedCompetitors.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function missingOrWeakAssetForRecord(
  record: PromptScanRecord,
  inventory: AssetInventoryItem[],
) {
  const wantedType =
    record.promptGroup === "competitor_comparison"
      ? "alternative_page"
      : dominant(record.citedSources.map((source) => assetTypeForSourceFormat(source.sourceFormat)));

  return inventory.find(
    (asset) =>
      asset.type === wantedType && (asset.status === "missing" || asset.status === "unknown"),
  );
}

function assetTypeForSourceFormat(
  sourceFormat: SourceFormat,
): AssetInventoryItem["type"] {
  if (sourceFormat === "marketplace_listing") return "shopify_app_store_listing";
  if (sourceFormat === "comparison_page") return "comparison_page";
  if (sourceFormat === "blog_guide" || sourceFormat === "listicle") return "blog_guide";
  if (sourceFormat === "vendor_docs" || sourceFormat === "official_docs") return "docs_help";
  if (sourceFormat === "reddit_thread") return "reddit_community_mention";
  if (sourceFormat === "youtube_video") return "youtube_video";
  if (sourceFormat === "review_site") return "review_profile";

  return "blog_guide";
}

function groupWeight(group: PromptGroup) {
  if (group === "competitor_comparison") return 60;
  if (group === "high_intent_purchase") return 50;
  if (group === "category_search") return 40;
  if (group === "integration_use_case") return 30;
  if (group === "solution_aware") return 25;

  return 20;
}

function dominant<T extends string>(items: T[]) {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}
