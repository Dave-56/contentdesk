import { z } from "zod";
import type {
  AssetInventoryItem,
  PromptGroup,
  PromptScanRecord,
  PromptScanRun,
  SourceFormat,
  AnswerSignal,
} from "@/lib/prompt-scan/schemas";
import {
  answerRecommendationSchema,
  promptScanRunSchema,
  providerSchema,
} from "@/lib/prompt-scan/schemas";
import { siteProfileSchema, type SiteProfile } from "@/lib/reddit-teardown/schemas";
import {
  buyerPromptStrategyInputSchema,
  type BuyerPromptStrategyInput,
} from "@/lib/buyer-prompt-strategist/schemas";
import {
  ownedContentInventorySchema,
  type OwnedContentInventory,
  type OwnedSiteAsset,
} from "@/lib/visibility/site-inventory";
import {
  crossProviderSynthesisSchema,
  type CrossProviderSynthesis,
  type PromptSynthesis,
} from "@/lib/visibility/synthesis";

const recommendationPrioritySchema = z.enum(["high", "medium", "low"]);
const brandInclusionFitSchema = z.enum(["strong", "medium", "weak", "none"]);

const promptGapBrandStatusSchema = z.enum([
  "absent",
  "mentioned",
  "cited",
  "recommended",
  "top_pick",
  "qualified",
  "not_recommended",
]);

export const visibilityPromptGapSchema = z.object({
  promptId: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  promptGroup: z.string().trim().min(1),
  providers: z.array(providerSchema).default([]),
  brandStatus: promptGapBrandStatusSchema,
  brandRecommendation: answerRecommendationSchema.default("absent"),
  brandMentioned: z.boolean(),
  brandCited: z.boolean(),
  competitorStatus: z.object({
    mentioned: z.array(z.string().trim().min(1)).default([]),
    cited: z.array(z.string().trim().min(1)).default([]),
    recommended: z.array(z.string().trim().min(1)).default([]),
  }),
  sourcesUsed: z.array(
    z.object({
      domain: z.string().trim().min(1),
      format: z.string().trim().min(1),
    }),
  ),
  gapType: z.string().trim().min(1),
  nextAction: z.string().trim().min(1),
  why: z.string().trim().min(1),
  providerSignals: z.array(
    z.object({
      provider: providerSchema,
      brandStatus: promptGapBrandStatusSchema,
      brandRecommendation: answerRecommendationSchema.default("absent"),
      brandMentioned: z.boolean(),
      brandCited: z.boolean(),
      competitorsRecommended: z.array(z.string().trim().min(1)).default([]),
      citedDomains: z.array(z.string().trim().min(1)).default([]),
    }),
  ).default([]),
});

export type VisibilityPromptGap = z.infer<typeof visibilityPromptGapSchema>;

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
    brandMentioned: z.boolean(),
    brandCited: z.boolean(),
    brandRecommendation: answerRecommendationSchema.default("absent"),
    brandRank: z.number().int().min(1).nullable().default(null),
    competitorsMentioned: z.array(z.string().trim().min(1)),
    competitorsRecommended: z.array(z.string().trim().min(1)).default([]),
    citedDomains: z.array(z.string().trim().min(1)),
    dominantSourceFormat: z.string().trim().min(1),
    missingOrWeakAssetType: z.string().trim().min(1).nullable(),
    targetCompetitor: z.string().trim().min(1).nullable(),
    targetCompetitorAssetStatus: z.enum(["present", "missing", "unknown"]),
    brandFit: brandInclusionFitSchema.default("none"),
    brandFitAngle: z.string().trim().default(""),
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
  provider: z.union([providerSchema, z.literal("synthesis")]),
  providers: z.array(providerSchema).optional(),
  generatedAt: z.string().datetime(),
  basedOnRunDate: z.string().datetime(),
  summary: z.object({
    promptCount: z.number().int().min(0),
    brandMentionedCount: z.number().int().min(0),
    brandCitedCount: z.number().int().min(0),
    brandRecommendedCount: z.number().int().min(0).default(0),
    brandTopPickCount: z.number().int().min(0).default(0),
    competitorOnlyCount: z.number().int().min(0),
    competitorRecommendedOnlyCount: z.number().int().min(0).default(0),
    citedButNotRecommendedCount: z.number().int().min(0).default(0),
    recommendedButNotCitedCount: z.number().int().min(0).default(0),
    averageVisibilityScore: z.number().min(0).max(100),
  }),
  promptGaps: z.array(visibilityPromptGapSchema).default([]),
  recommendations: z.array(visibilityRecommendationSchema),
});

export type VisibilityRecommendationsFile = z.infer<
  typeof visibilityRecommendationsFileSchema
>;

export function buildVisibilityRecommendations(input: {
  strategy: BuyerPromptStrategyInput;
  run?: PromptScanRun;
  synthesis?: CrossProviderSynthesis;
  ownedInventory: OwnedContentInventory;
  siteProfile?: SiteProfile;
  generatedAt?: Date;
}): VisibilityRecommendationsFile {
  const strategy = buyerPromptStrategyInputSchema.parse(input.strategy);
  const ownedInventory = ownedContentInventorySchema.parse(input.ownedInventory);
  const siteProfile = input.siteProfile
    ? siteProfileSchema.parse(input.siteProfile)
    : undefined;

  if (input.synthesis) {
    return buildSynthesisRecommendations({
      strategy,
      synthesis: crossProviderSynthesisSchema.parse(input.synthesis),
      ownedInventory,
      siteProfile,
      generatedAt: input.generatedAt,
    });
  }

  if (!input.run) {
    throw new Error("Either a prompt scan run or cross-provider synthesis is required.");
  }

  const run = promptScanRunSchema.parse(input.run);
  const candidates = run.records
    .filter((record) => !record.visibilityScore.brandMentioned)
    .map((record) => scoreRecord(record, strategy, ownedInventory))
    .sort((a, b) => b.score - a.score);

  const top = candidates[0];
  const recommendations = top
    ? [
        buildRecommendation({
          record: top.record,
          strategy,
          ownedInventory,
          siteProfile,
          rank: 1,
        }),
      ]
    : [];

  return visibilityRecommendationsFileSchema.parse({
    brand: run.brand,
    provider: run.provider,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    basedOnRunDate: run.runDate,
    summary: run.summary,
    promptGaps: run.records.map((record) => buildRunPromptGap(record, run.brand)),
    recommendations,
  });
}

function buildSynthesisRecommendations(input: {
  strategy: BuyerPromptStrategyInput;
  synthesis: CrossProviderSynthesis;
  ownedInventory: OwnedContentInventory;
  siteProfile?: SiteProfile;
  generatedAt?: Date;
}): VisibilityRecommendationsFile {
  if (input.ownedInventory.assets.length === 0) {
    return visibilityRecommendationsFileSchema.parse({
      brand: input.synthesis.brand,
      provider: "synthesis",
      providers: input.synthesis.providers,
      generatedAt: (input.generatedAt ?? new Date()).toISOString(),
      basedOnRunDate: input.synthesis.runDate,
      summary: summaryFromSynthesis(input.synthesis),
      promptGaps: input.synthesis.prompts.map((prompt) =>
        buildSynthesisPromptGap(prompt, input.strategy),
      ),
      recommendations: [],
    });
  }

  const candidates = input.synthesis.prompts
    .filter((prompt) => prompt.recommendedGapType !== "no_gap")
    .map((prompt) => scoreSynthesisPrompt(prompt, input.strategy, input.ownedInventory))
    .filter((candidate) => candidate.confidence !== "low")
    .sort((a, b) => b.score - a.score);

  const top = candidates[0];
  const recommendations = top
    ? [
        buildSynthesisRecommendation({
          prompt: top.prompt,
          confidence: top.confidence,
          strategy: input.strategy,
          ownedInventory: input.ownedInventory,
          rank: 1,
        }),
      ]
    : [];

  return visibilityRecommendationsFileSchema.parse({
    brand: input.synthesis.brand,
    provider: "synthesis",
    providers: input.synthesis.providers,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    basedOnRunDate: input.synthesis.runDate,
    summary: summaryFromSynthesis(input.synthesis),
    promptGaps: input.synthesis.prompts.map((prompt) =>
      buildSynthesisPromptGap(prompt, input.strategy),
    ),
    recommendations,
  });
}

function summaryFromSynthesis(synthesis: CrossProviderSynthesis) {
  return {
    promptCount: synthesis.prompts.length,
    brandMentionedCount: synthesis.prompts.filter(
      (prompt) => prompt.brandMentionedProviders.length > 0,
    ).length,
    brandCitedCount: synthesis.prompts.filter(
      (prompt) => prompt.brandCitedProviders.length > 0,
    ).length,
    brandRecommendedCount: synthesis.prompts.filter(
      (prompt) => prompt.brandRecommendedProviders.length > 0,
    ).length,
    brandTopPickCount: synthesis.prompts.filter(
      (prompt) => prompt.brandTopPickProviders.length > 0,
    ).length,
    competitorOnlyCount: synthesis.prompts.filter(
      (prompt) => prompt.competitorOnlyProviders.length > 0,
    ).length,
    competitorRecommendedOnlyCount: synthesis.prompts.filter(
      (prompt) => prompt.competitorRecommendedOnlyProviders.length > 0,
    ).length,
    citedButNotRecommendedCount: synthesis.prompts.filter(
      (prompt) =>
        prompt.brandCitedProviders.length > 0 &&
        prompt.brandRecommendedProviders.length === 0,
    ).length,
    recommendedButNotCitedCount: synthesis.prompts.filter(
      (prompt) =>
        prompt.brandRecommendedProviders.length > 0 &&
        prompt.brandCitedProviders.length === 0,
    ).length,
    averageVisibilityScore: 0,
  };
}

function buildRunPromptGap(record: PromptScanRecord, brandName: string): VisibilityPromptGap {
  const recommendation = record.answerSignal?.brandRecommendation ?? "absent";
  const brandStatus = brandStatusForSignal({
    brandMentioned: record.visibilityScore.brandMentioned,
    brandCited: record.visibilityScore.brandCited,
    brandRecommendation: recommendation,
  });
  const competitorsRecommended =
    record.answerSignal?.competitorSignals
      .filter((competitor) => isRecommended(competitor.recommendation))
      .map((competitor) => competitor.name) ?? [];
  const gapType = runGapType(record, competitorsRecommended);
  const sourcesUsed = sourcesUsedForRecord(record);

  return visibilityPromptGapSchema.parse({
    promptId: record.id,
    prompt: record.prompt,
    promptGroup: record.promptGroup,
    providers: [record.provider],
    brandStatus,
    brandRecommendation: recommendation,
    brandMentioned: record.visibilityScore.brandMentioned,
    brandCited: record.visibilityScore.brandCited,
    competitorStatus: {
      mentioned: record.visibilityScore.competitorsMentioned.map(
        (competitor) => competitor.name,
      ),
      cited: record.visibilityScore.competitorsCited.map((competitor) => competitor.name),
      recommended: competitorsRecommended,
    },
    sourcesUsed,
    gapType,
    nextAction: record.contentdeskNextAction ?? record.recommendedNextAction,
    why: promptGapWhy({
      brandStatus,
      competitorsRecommended,
      sourcesUsed,
      gapType,
      brandName,
    }),
    providerSignals: [
      {
        provider: record.provider,
        brandStatus,
        brandRecommendation: recommendation,
        brandMentioned: record.visibilityScore.brandMentioned,
        brandCited: record.visibilityScore.brandCited,
        competitorsRecommended,
        citedDomains: record.citedDomains,
      },
    ],
  });
}

function buildSynthesisPromptGap(
  prompt: PromptSynthesis,
  strategy: BuyerPromptStrategyInput,
): VisibilityPromptGap {
  const brandRecommendation = dominantBrandRecommendation(prompt.providerResults);
  const brandStatus = brandStatusForSignal({
    brandMentioned: prompt.brandMentionedProviders.length > 0,
    brandCited: prompt.brandCitedProviders.length > 0,
    brandRecommendation,
  });
  const competitorsRecommended = [
    ...new Set(
      prompt.providerResults.flatMap((result) => result.competitorsRecommended),
    ),
  ];
  const sourcesUsed = sourcesUsedForSynthesis(prompt);
  const nextAction = titleForTaskType(
    taskTypeForGap({
      gapType: prompt.recommendedGapType,
      dominantSourceFormat: prompt.dominantSourceFormats[0] ?? "unknown",
      promptGroup: prompt.promptGroup,
    }),
  );

  return visibilityPromptGapSchema.parse({
    promptId: prompt.promptId,
    prompt: prompt.prompt,
    promptGroup: prompt.promptGroup,
    providers: prompt.providerResults.map((result) => result.provider),
    brandStatus,
    brandRecommendation,
    brandMentioned: prompt.brandMentionedProviders.length > 0,
    brandCited: prompt.brandCitedProviders.length > 0,
    competitorStatus: {
      mentioned: prompt.dominantCompetitors,
      cited: [
        ...new Set(
          prompt.providerResults.flatMap((result) => result.competitorsCited),
        ),
      ],
      recommended: competitorsRecommended,
    },
    sourcesUsed,
    gapType: prompt.recommendedGapType,
    nextAction,
    why: promptGapWhy({
      brandStatus,
      competitorsRecommended,
      sourcesUsed,
      gapType: prompt.recommendedGapType,
      brandName: strategy.brand.name,
    }),
    providerSignals: prompt.providerResults.map((result) => ({
      provider: result.provider,
      brandStatus: brandStatusForSignal({
        brandMentioned: result.brandMentioned,
        brandCited: result.brandCited,
        brandRecommendation: result.brandRecommendation,
      }),
      brandRecommendation: result.brandRecommendation,
      brandMentioned: result.brandMentioned,
      brandCited: result.brandCited,
      competitorsRecommended: result.competitorsRecommended,
      citedDomains: result.citedDomains,
    })),
  });
}

function brandStatusForSignal(input: {
  brandMentioned: boolean;
  brandCited: boolean;
  brandRecommendation: AnswerSignal["brandRecommendation"];
}): VisibilityPromptGap["brandStatus"] {
  if (input.brandRecommendation === "top_pick") return "top_pick";
  if (input.brandRecommendation === "recommended") return "recommended";
  if (input.brandRecommendation === "qualified") return "qualified";
  if (input.brandRecommendation === "not_recommended") return "not_recommended";
  if (input.brandCited) return "cited";
  if (input.brandMentioned) return "mentioned";
  return "absent";
}

function runGapType(record: PromptScanRecord, competitorsRecommended: string[]) {
  const brandRecommendation = record.answerSignal?.brandRecommendation ?? "absent";
  if (brandRecommendation === "top_pick") return "no_gap";
  if (competitorsRecommended.length > 0 && !isRecommended(brandRecommendation)) {
    return "competitor_recommended_gap";
  }
  if (isRecommended(brandRecommendation) && !record.visibilityScore.brandCited) {
    return "proof_gap";
  }
  if (!record.visibilityScore.brandMentioned) {
    return record.visibilityScore.competitorsMentioned.length > 0 ? "mention_gap" : "absent_gap";
  }
  if (!record.visibilityScore.brandCited) return "citation_gap";
  if (!isRecommended(brandRecommendation)) return "recommendation_gap";
  return "top_pick_gap";
}

function sourcesUsedForRecord(record: PromptScanRecord) {
  return dedupeSources(
    record.citedSources.map((source) => ({
      domain: source.domain,
      format: source.sourceFormat,
    })),
  );
}

function sourcesUsedForSynthesis(prompt: PromptSynthesis) {
  return dedupeSources(
    prompt.providerResults.flatMap((result) =>
      result.citedDomains.map((domain) => ({
        domain,
        format: result.dominantSourceFormat,
      })),
    ),
  );
}

function dedupeSources(sources: Array<{ domain: string; format: string }>) {
  const seen = new Set<string>();
  return sources
    .filter((source) => {
      const key = `${source.domain}:${source.format}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function promptGapWhy(input: {
  brandStatus: VisibilityPromptGap["brandStatus"];
  competitorsRecommended: string[];
  sourcesUsed: Array<{ domain: string; format: string }>;
  gapType: string;
  brandName: string;
}) {
  if (input.brandStatus === "absent") {
    const sourceDomains = input.sourcesUsed.slice(0, 4).map((source) => source.domain);
    return `${input.brandName} is not entering this answer; AI is using ${sourceDomains.join(", ") || "other sources"} instead.`;
  }
  if (input.competitorsRecommended.length > 0) {
    return `${input.competitorsRecommended.join(", ")} recommended while ${input.brandName} is not chosen.`;
  }
  if (input.gapType === "recommendation_gap") {
    return `${input.brandName} is visible enough to be cited, but the answer does not choose it.`;
  }
  if (input.gapType === "citation_gap") {
    return `${input.brandName} is mentioned, but not supported by citations.`;
  }
  if (input.gapType === "proof_gap") {
    return `${input.brandName} is recommended, but the answer lacks citation proof.`;
  }
  if (input.gapType === "top_pick_gap") {
    return `${input.brandName} is chosen, but not yet the top pick.`;
  }
  if (input.brandStatus === "qualified") {
    return `${input.brandName} is recommended with caveats; improve proof and positioning.`;
  }
  return `${input.brandName} status is ${input.brandStatus.replaceAll("_", " ")} for this prompt.`;
}

function scoreSynthesisPrompt(
  prompt: PromptSynthesis,
  strategy: BuyerPromptStrategyInput,
  ownedInventory: OwnedContentInventory,
) {
  const dominantSourceFormat = prompt.dominantSourceFormats[0] ?? "unknown";
  const confidence = synthesisConfidence(prompt);
  const targetCompetitor = targetCompetitorNameFromText(
    `${prompt.promptId} ${prompt.prompt}`,
    strategy,
  ) ?? prompt.dominantCompetitors[0];
  const targetCoverage = targetCompetitor
    ? competitorAssetStatus(targetCompetitor, ownedInventory)
    : "unknown";

  let score = groupWeight(prompt.promptGroup as PromptGroup);
  if (prompt.recommendedGapType === "mention_gap") score += 25;
  if (prompt.recommendedGapType === "absent_gap") score += 10;
  if (prompt.recommendedGapType === "competitor_recommended_gap") score += 45;
  if (prompt.recommendedGapType === "recommendation_gap") score += 30;
  if (prompt.recommendedGapType === "citation_gap") score += 20;
  if (prompt.recommendedGapType === "proof_gap") score += 20;
  if (prompt.recommendedGapType === "top_pick_gap") score += 15;
  if (dominantSourceFormat === "comparison_page") score += 25;
  if (prompt.competitorOnlyProviders.length >= 2) score += 30;
  if (prompt.competitorRecommendedOnlyProviders.length >= 1) score += 35;
  if (prompt.dominantCompetitors.length > 0) score += 15;
  if (prompt.brandRecommendedProviders.length > 0) score -= 50;
  if (targetCoverage === "missing") score += 15;
  if (targetCoverage === "present") score -= 30;
  if (confidence === "high") score += 20;
  if (confidence === "medium") score += 10;

  return {
    prompt,
    confidence,
    score,
  };
}

function buildSynthesisRecommendation(input: {
  prompt: PromptSynthesis;
  confidence: "high" | "medium" | "low";
  strategy: BuyerPromptStrategyInput;
  ownedInventory: OwnedContentInventory;
  rank: number;
}): VisibilityRecommendation {
  const dominantSourceFormat = input.prompt.dominantSourceFormats[0] ?? "unknown";
  const taskType = taskTypeForGap({
    gapType: input.prompt.recommendedGapType,
    dominantSourceFormat,
    promptGroup: input.prompt.promptGroup,
  });
  const brandFit = brandFitForRecommendation({
    taskType,
    promptGroup: input.prompt.promptGroup,
    strategy: input.strategy,
  });
  const competitorName =
    targetCompetitorNameFromText(`${input.prompt.promptId} ${input.prompt.prompt}`, input.strategy) ??
    input.prompt.dominantCompetitors[0];
  const targetAssetStatus = competitorName
    ? competitorAssetStatus(competitorName, input.ownedInventory)
    : "unknown";
  const relatedAssets = relatedCompetitorAssets({
    ownedInventory: input.ownedInventory,
    competitors: input.strategy.competitors.map((competitor) => competitor.name),
    exclude: competitorName,
    includeInventorySubjects: true,
  });
  const missingAsset = missingOrWeakAssetForGap({
    gapType: input.prompt.recommendedGapType,
    dominantSourceFormat,
    promptGroup: input.prompt.promptGroup,
    inventory: input.strategy.assetInventory,
  });
  const citedDomains = [
    ...new Set(input.prompt.providerResults.flatMap((result) => result.citedDomains)),
  ];

  return visibilityRecommendationSchema.parse({
    rank: input.rank,
    title:
      taskType === "alternative_page" && competitorName
        ? `Build ${competitorName} alternatives page`
        : titleForTaskType(taskType),
    taskType,
    priority: input.confidence === "high" ? "high" : "medium",
    confidence: input.confidence,
    targetPromptId: input.prompt.promptId,
    targetPrompt: input.prompt.prompt,
    why: whyForSynthesisPrompt({
      prompt: input.prompt,
      dominantSourceFormat,
      competitorName,
      targetAssetStatus,
      relatedAssets,
      brandName: input.strategy.brand.name,
    }),
    evidence: {
      promptGroup: input.prompt.promptGroup,
      brandMentioned: input.prompt.brandMentionedProviders.length > 0,
      brandCited: input.prompt.brandCitedProviders.length > 0,
      brandRecommendation: dominantBrandRecommendation(input.prompt.providerResults),
      brandRank: bestBrandRank(input.prompt.providerResults),
      competitorsMentioned: input.prompt.dominantCompetitors,
      competitorsRecommended: [
        ...new Set(
          input.prompt.providerResults.flatMap(
            (result) => result.competitorsRecommended,
          ),
        ),
      ],
      citedDomains,
      dominantSourceFormat,
      missingOrWeakAssetType: missingAsset?.type ?? null,
      targetCompetitor: competitorName ?? null,
      targetCompetitorAssetStatus: targetAssetStatus,
      brandFit: brandFit.fit,
      brandFitAngle: brandFit.angle,
      relatedAssets,
    },
    recheck: {
      promptIds: [input.prompt.promptId],
      afterPublish: true,
      cadenceDays: input.strategy.defaultRecheckDays,
    },
  });
}

function brandFitForRecommendation(input: {
  taskType: VisibilityRecommendation["taskType"];
  promptGroup: string;
  strategy: BuyerPromptStrategyInput;
}) {
  if (input.taskType !== "alternative_page" && input.taskType !== "comparison_page") {
    return { fit: "none" as const, angle: "" };
  }

  const matchingJobs = input.strategy.buyerJobs.filter(
    (job) => job.group === input.promptGroup,
  );
  const bestFit = Math.max(0, ...matchingJobs.map((job) => job.productFit));
  const fit =
    bestFit >= 4 ? "strong" :
      bestFit === 3 ? "medium" :
        bestFit === 2 ? "weak" :
          "none";
  const useCases = input.strategy.primaryUseCases.slice(0, 3).join(", ");
  const angle = fit === "none"
    ? ""
    : `${input.strategy.brand.name} fits ${input.strategy.audience} evaluating ${input.strategy.category} when they need ${useCases || input.strategy.positioning}.`;

  return { fit, angle };
}

function scoreRecord(
  record: PromptScanRecord,
  strategy: BuyerPromptStrategyInput,
  ownedInventory: OwnedContentInventory,
) {
  const dominantSourceFormat = dominant(
    record.citedSources.map((source) => source.sourceFormat),
  );
  const missingAsset = missingOrWeakAssetForRecord(record, strategy.assetInventory);
  const targetCompetitor = targetCompetitorName(record, strategy);
  const targetCoverage = targetCompetitor
    ? competitorAssetStatus(targetCompetitor, ownedInventory)
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
  if (
    record.answerSignal?.competitorSignals.some((competitor) =>
      isRecommended(competitor.recommendation),
    )
  ) {
    score += 35;
  }
  if (isRecommended(record.answerSignal?.brandRecommendation)) score -= 50;

  return { record, score };
}

function buildRecommendation(input: {
  record: PromptScanRecord;
  strategy: BuyerPromptStrategyInput;
  ownedInventory: OwnedContentInventory;
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
    ? competitorAssetStatus(competitorName, input.ownedInventory)
    : "unknown";
  const relatedAssets = relatedCompetitorAssets({
    ownedInventory: input.ownedInventory,
    competitors: input.strategy.competitors.map((competitor) => competitor.name),
    exclude: competitorName,
    includeInventorySubjects: true,
  });
  const brandFit = brandFitForRecommendation({
    taskType,
    promptGroup: record.promptGroup,
    strategy: input.strategy,
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
      brandName: input.strategy.brand.name,
    }),
    evidence: {
      promptGroup: record.promptGroup,
      brandMentioned: record.visibilityScore.brandMentioned,
      brandCited: record.visibilityScore.brandCited,
      brandRecommendation: record.answerSignal?.brandRecommendation ?? "absent",
      brandRank: record.answerSignal?.brandRank ?? null,
      competitorsMentioned: record.visibilityScore.competitorsMentioned.map(
        (competitor) => competitor.name,
      ),
      competitorsRecommended:
        record.answerSignal?.competitorSignals
          .filter((competitor) => isRecommended(competitor.recommendation))
          .map((competitor) => competitor.name) ?? [],
      citedDomains: record.citedDomains,
      dominantSourceFormat,
      missingOrWeakAssetType: missingAsset?.type ?? null,
      targetCompetitor: competitorName ?? null,
      targetCompetitorAssetStatus: targetAssetStatus,
      brandFit: brandFit.fit,
      brandFitAngle: brandFit.angle,
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
  brandName: string;
}) {
  const why = [
    `${input.record.id} cites ${input.dominantSourceFormat.replaceAll("_", " ")} sources.`,
    `${input.brandName} is absent from answer and citations.`,
  ];

  if (input.competitorName) {
    why.push(`${input.competitorName} is active in this buyer answer.`);
  }
  if (input.competitorName && input.targetAssetStatus === "missing") {
    why.push(`No ${input.competitorName}-specific alternatives page found in owned inventory.`);
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

function taskTypeForGap(input: {
  gapType: string;
  dominantSourceFormat: string;
  promptGroup: string;
}): VisibilityRecommendation["taskType"] {
  if (input.promptGroup === "competitor_comparison") return "alternative_page";
  if (input.dominantSourceFormat === "marketplace_listing") {
    return "shopify_app_store_listing";
  }
  if (input.dominantSourceFormat === "reddit_thread") return "community_answer";
  if (
    input.gapType === "proof_gap" ||
    input.dominantSourceFormat === "review_site" ||
    input.dominantSourceFormat === "youtube_video"
  ) {
    return "guide";
  }
  if (input.dominantSourceFormat === "comparison_page") return "comparison_page";
  if (
    input.dominantSourceFormat === "blog_guide" ||
    input.dominantSourceFormat === "listicle"
  ) {
    return "guide";
  }

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
  return targetCompetitorNameFromText(`${record.id} ${record.prompt}`, strategy);
}

function targetCompetitorNameFromText(
  text: string,
  strategy: Pick<BuyerPromptStrategyInput, "competitors">,
) {
  const haystack = text.toLowerCase();

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

function competitorAssetStatus(
  competitorName: string,
  ownedInventory: OwnedContentInventory,
) {
  const assets = relatedCompetitorAssets({
    ownedInventory,
    competitors: [competitorName],
  });

  return assets.length > 0 ? "present" : "missing";
}

function relatedCompetitorAssets(input: {
  ownedInventory: OwnedContentInventory;
  competitors: string[];
  exclude?: string;
  includeInventorySubjects?: boolean;
}): RelatedAsset[] {
  const excluded = input.exclude ? normalizeName(input.exclude) : "";
  const assets: RelatedAsset[] = [];

  for (const asset of input.ownedInventory.assets) {
    const text = assetSearchText(asset);
    if (!/\b(alternative|alternatives|competitor|competitors|compare|comparison|vs)\b/i.test(text)) {
      continue;
    }

    const matchedCompetitors = [
      ...input.competitors,
      ...(input.includeInventorySubjects ? extractAssetSubjects(asset) : []),
    ].filter((competitor, index, all) => {
      const normalized = normalizeName(competitor);
      if (!normalized || normalized === excluded) return false;
      if (all.findIndex((item) => normalizeName(item) === normalized) !== index) {
        return false;
      }
      return normalizeName(text).includes(normalized);
    });
    if (matchedCompetitors.length === 0) continue;

    assets.push({
      title: asset.title || extractAssetTitle(text, matchedCompetitors[0] ?? "competitor"),
      url: asset.url,
      matchedCompetitors,
    });
  }

  return dedupeRelatedAssets(assets);
}

function extractAssetSubjects(asset: OwnedSiteAsset) {
  const text = [asset.title, asset.slug, ...asset.headings].join(" ");
  const subjects = new Set<string>();
  const patterns = [
    /\b([A-Z][A-Za-z0-9 .&-]{1,40})\s+Alternatives?\b/g,
    /\bAlternatives?\s+to\s+([A-Z][A-Za-z0-9 .&-]{1,40})\b/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const subject = cleanSubject(match[1] ?? "");
      if (subject) subjects.add(subject);
    }
  }

  return [...subjects];
}

function cleanSubject(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+(for|and|or|with)\s+.*$/i, "")
    .trim();
}

function assetSearchText(asset: OwnedSiteAsset) {
  return [
    asset.url,
    asset.slug,
    asset.title,
    asset.excerpt,
    ...asset.headings,
  ].join(" ");
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

function whyForSynthesisPrompt(input: {
  prompt: PromptSynthesis;
  dominantSourceFormat: string;
  competitorName?: string;
  targetAssetStatus: "present" | "missing" | "unknown";
  relatedAssets: RelatedAsset[];
  brandName: string;
}) {
  const why = [
    `${input.prompt.promptId} shows ${input.prompt.recommendedGapType.replaceAll("_", " ")} across providers.`,
    `${input.brandName} is mentioned by ${input.prompt.brandMentionedProviders.length}/${input.prompt.providerResults.length} providers, cited by ${input.prompt.brandCitedProviders.length}/${input.prompt.providerResults.length}, and recommended by ${input.prompt.brandRecommendedProviders.length}/${input.prompt.providerResults.length}.`,
  ];

  if (input.prompt.competitorRecommendedOnlyProviders.length > 0) {
    why.push(
      `${input.prompt.competitorRecommendedOnlyProviders.length} providers recommend competitors without recommending ${input.brandName}.`,
    );
  }
  if (input.prompt.competitorOnlyProviders.length >= 2) {
    why.push(
      `${input.prompt.competitorOnlyProviders.length} providers show competitor-only answers.`,
    );
  }
  if (input.dominantSourceFormat !== "unknown") {
    why.push(`Dominant source format is ${input.dominantSourceFormat.replaceAll("_", " ")}.`);
  }
  if (input.competitorName && input.targetAssetStatus === "missing") {
    why.push(`No ${input.competitorName}-specific alternatives page found in owned inventory.`);
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

function dominantBrandRecommendation(
  providerResults: PromptSynthesis["providerResults"],
): AnswerSignal["brandRecommendation"] {
  const order: AnswerSignal["brandRecommendation"][] = [
    "top_pick",
    "recommended",
    "qualified",
    "not_recommended",
    "neutral",
    "absent",
  ];

  return (
    order.find((recommendation) =>
      providerResults.some((result) => result.brandRecommendation === recommendation),
    ) ?? "absent"
  );
}

function bestBrandRank(providerResults: PromptSynthesis["providerResults"]) {
  const ranks = providerResults
    .map((result) => result.brandRank)
    .filter((rank): rank is number => typeof rank === "number");

  return ranks.sort((left, right) => left - right)[0] ?? null;
}

function isRecommended(recommendation?: AnswerSignal["brandRecommendation"]) {
  return (
    recommendation === "recommended" ||
    recommendation === "top_pick" ||
    recommendation === "qualified"
  );
}

function synthesisConfidence(prompt: PromptSynthesis): "high" | "medium" | "low" {
  if (prompt.competitorOnlyProviders.length >= 2) return "high";

  const sourceFormatCounts = new Map<string, number>();
  for (const result of prompt.providerResults) {
    if (result.dominantSourceFormat === "unknown") continue;
    sourceFormatCounts.set(
      result.dominantSourceFormat,
      (sourceFormatCounts.get(result.dominantSourceFormat) ?? 0) + 1,
    );
  }
  if ([...sourceFormatCounts.values()].some((count) => count >= 2)) return "high";

  const hasStrongCitationPattern = prompt.providerResults.some(
    (result) =>
      result.recommendationConfidence === "high" ||
      result.citedDomains.length >= 3 ||
      (result.dominantSourceFormat !== "unknown" && result.citedDomains.length >= 2),
  );

  return hasStrongCitationPattern ? "medium" : "low";
}

function missingOrWeakAssetForGap(input: {
  gapType: string;
  dominantSourceFormat: string;
  promptGroup: string;
  inventory: AssetInventoryItem[];
}) {
  const wantedType =
    input.promptGroup === "competitor_comparison"
      ? "alternative_page"
      : input.gapType === "proof_gap"
        ? "case_study"
        : assetTypeForSourceFormat(input.dominantSourceFormat as SourceFormat);

  return input.inventory.find(
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
