import { z } from "zod";
import {
  promptScanRunSchema,
  providerSchema,
  type PromptScanRecord,
  type PromptScanRun,
  type PromptScanConfig,
  type AnswerSignal,
  type SourceFormat,
} from "@/lib/prompt-scan/schemas";

export type ProviderRunError = {
  provider: PromptScanConfig["provider"];
  error: string;
};

export const providerSynthesisResultSchema = z.object({
  provider: providerSchema,
  answerText: z.string(),
  citedUrls: z.array(z.string().url()),
  citedDomains: z.array(z.string().trim().min(1)),
  brandMentioned: z.boolean(),
  brandCited: z.boolean(),
  brandRecommendation: z.enum([
    "absent",
    "neutral",
    "recommended",
    "top_pick",
    "qualified",
    "not_recommended",
  ]).default("absent"),
  brandRank: z.number().int().min(1).nullable().default(null),
  competitorOnly: z.boolean(),
  competitorRecommendedOnly: z.boolean().default(false),
  competitorsMentioned: z.array(z.string().trim().min(1)),
  competitorsCited: z.array(z.string().trim().min(1)),
  competitorsRecommended: z.array(z.string().trim().min(1)).default([]),
  sourceFormats: z.array(z.string().trim().min(1)),
  dominantSourceFormat: z.string().trim().min(1),
  recommendationConfidence: z.enum(["low", "medium", "high"]),
});

export const promptSynthesisSchema = z.object({
  promptId: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  promptGroup: z.string().trim().min(1),
  providerResults: z.array(providerSynthesisResultSchema).min(1),
  brandMentionedProviders: z.array(providerSchema),
  brandCitedProviders: z.array(providerSchema),
  brandRecommendedProviders: z.array(providerSchema).default([]),
  brandTopPickProviders: z.array(providerSchema).default([]),
  competitorOnlyProviders: z.array(providerSchema),
  competitorRecommendedOnlyProviders: z.array(providerSchema).default([]),
  dominantCompetitors: z.array(z.string().trim().min(1)),
  dominantSourceFormats: z.array(z.string().trim().min(1)),
  recommendedGapType: z.string().trim().min(1),
});

export const crossProviderSynthesisSchema = z.object({
  brand: z.string().trim().min(1),
  generatedAt: z.string().datetime(),
  runDate: z.string().datetime(),
  providers: z.array(providerSchema).min(1),
  providerErrors: z.array(
    z.object({
      provider: providerSchema,
      error: z.string().trim().min(1),
    }),
  ).default([]),
  summary: z.object({
    promptCount: z.number().int().min(0),
    providerCount: z.number().int().min(1),
      failedProviderCount: z.number().int().min(0),
      repeatedGapCount: z.number().int().min(0),
      brandRecommendedCount: z.number().int().min(0).default(0),
      brandTopPickCount: z.number().int().min(0).default(0),
      competitorRecommendedOnlyCount: z.number().int().min(0).default(0),
      citedButNotRecommendedCount: z.number().int().min(0).default(0),
      recommendedButNotCitedCount: z.number().int().min(0).default(0),
    }),
  prompts: z.array(promptSynthesisSchema),
});

export type CrossProviderSynthesis = z.infer<typeof crossProviderSynthesisSchema>;
export type PromptSynthesis = z.infer<typeof promptSynthesisSchema>;

export function buildCrossProviderSynthesis(input: {
  runs: PromptScanRun[];
  providerErrors?: ProviderRunError[];
  generatedAt?: Date;
}): CrossProviderSynthesis {
  const runs = input.runs.map((run) => promptScanRunSchema.parse(run));
  if (runs.length === 0) {
    throw new Error("At least one provider run is required for synthesis.");
  }

  assertCompatibleRuns(runs);

  const firstRun = runs[0];
  const prompts = firstRun.records.map((record) => {
    const records = runs.map((run) => {
      const matching = run.records.find((candidate) => candidate.id === record.id);
      if (!matching) {
        throw new Error(`Provider run ${run.provider} is missing prompt ${record.id}.`);
      }
      return matching;
    });
    const providerResults = records.map(synthesizeProviderResult);
    const brandMentionedProviders = providerResults
      .filter((result) => result.brandMentioned)
      .map((result) => result.provider);
    const brandCitedProviders = providerResults
      .filter((result) => result.brandCited)
      .map((result) => result.provider);
    const brandRecommendedProviders = providerResults
      .filter((result) => isRecommended(result.brandRecommendation))
      .map((result) => result.provider);
    const brandTopPickProviders = providerResults
      .filter((result) => result.brandRecommendation === "top_pick")
      .map((result) => result.provider);
    const competitorOnlyProviders = providerResults
      .filter((result) => result.competitorOnly)
      .map((result) => result.provider);
    const competitorRecommendedOnlyProviders = providerResults
      .filter((result) => result.competitorRecommendedOnly)
      .map((result) => result.provider);
    const dominantCompetitors = topValues(
      providerResults.flatMap((result) => [
        ...result.competitorsMentioned,
        ...result.competitorsCited,
        ...result.competitorsRecommended,
      ]),
    );
    const dominantSourceFormats = topValues(
      providerResults.flatMap((result) => result.sourceFormats),
    );

    return promptSynthesisSchema.parse({
      promptId: record.id,
      prompt: record.prompt,
      promptGroup: record.promptGroup,
      providerResults,
      brandMentionedProviders,
      brandCitedProviders,
      brandRecommendedProviders,
      brandTopPickProviders,
      competitorOnlyProviders,
      competitorRecommendedOnlyProviders,
      dominantCompetitors,
      dominantSourceFormats,
      recommendedGapType: recommendedGapType({
        record,
        competitorOnlyProviders,
        competitorRecommendedOnlyProviders,
        brandMentionedProviders,
        brandCitedProviders,
        brandRecommendedProviders,
        dominantSourceFormats,
      }),
    });
  });

  return crossProviderSynthesisSchema.parse({
    brand: firstRun.brand,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    runDate: firstRun.runDate,
    providers: runs.map((run) => run.provider),
    providerErrors: input.providerErrors ?? [],
    summary: {
      promptCount: prompts.length,
      providerCount: runs.length,
      failedProviderCount: input.providerErrors?.length ?? 0,
      repeatedGapCount: prompts.filter((prompt) => prompt.competitorOnlyProviders.length >= 2)
        .length,
      brandRecommendedCount: prompts.filter(
        (prompt) => prompt.brandRecommendedProviders.length > 0,
      ).length,
      brandTopPickCount: prompts.filter(
        (prompt) => prompt.brandTopPickProviders.length > 0,
      ).length,
      competitorRecommendedOnlyCount: prompts.filter(
        (prompt) => prompt.competitorRecommendedOnlyProviders.length > 0,
      ).length,
      citedButNotRecommendedCount: prompts.filter(
        (prompt) =>
          prompt.brandCitedProviders.length > 0 &&
          prompt.brandRecommendedProviders.length === 0,
      ).length,
      recommendedButNotCitedCount: prompts.filter(
        (prompt) =>
          prompt.brandRecommendedProviders.length > 0 &&
          prompt.brandCitedProviders.length === 0,
      ).length,
    },
    prompts,
  });
}

function assertCompatibleRuns(runs: PromptScanRun[]) {
  const [firstRun] = runs;
  const firstPromptIds = firstRun.records.map((record) => record.id).sort();
  const firstRunDate = firstRun.runDate.slice(0, 10);

  for (const run of runs.slice(1)) {
    if (run.brand !== firstRun.brand) {
      throw new Error("Provider runs must use the same brand.");
    }
    if (run.runDate.slice(0, 10) !== firstRunDate) {
      throw new Error("Provider runs must use the same run date.");
    }

    const promptIds = run.records.map((record) => record.id).sort();
    if (promptIds.join("\n") !== firstPromptIds.join("\n")) {
      throw new Error("Provider runs must contain the same prompt ids.");
    }
  }
}

function synthesizeProviderResult(record: PromptScanRecord) {
  const sourceFormats = record.citedSources.map((source) => source.sourceFormat);
  const competitorsMentioned = record.visibilityScore.competitorsMentioned.map(
    (competitor) => competitor.name,
  );
  const competitorsCited = record.visibilityScore.competitorsCited.map(
    (competitor) => competitor.name,
  );
  const answerSignal = record.answerSignal ?? legacyAnswerSignal(record);
  const competitorsRecommended = answerSignal.competitorSignals
    .filter((competitor) => isRecommended(competitor.recommendation))
    .map((competitor) => competitor.name);

  return providerSynthesisResultSchema.parse({
    provider: record.provider,
    answerText: record.answerText,
    citedUrls: record.citedUrls,
    citedDomains: record.citedDomains,
    brandMentioned: record.visibilityScore.brandMentioned,
    brandCited: record.visibilityScore.brandCited,
    brandRecommendation: answerSignal.brandRecommendation,
    brandRank: answerSignal.brandRank,
    competitorOnly:
      !record.visibilityScore.brandMentioned && competitorsMentioned.length > 0,
    competitorRecommendedOnly:
      !isRecommended(answerSignal.brandRecommendation) && competitorsRecommended.length > 0,
    competitorsMentioned,
    competitorsCited,
    competitorsRecommended,
    sourceFormats,
    dominantSourceFormat: dominant(sourceFormats),
    recommendationConfidence: record.recommendationConfidence,
  });
}

function recommendedGapType(input: {
  record: PromptScanRecord;
  competitorOnlyProviders: string[];
  competitorRecommendedOnlyProviders: string[];
  brandMentionedProviders: string[];
  brandCitedProviders: string[];
  brandRecommendedProviders: string[];
  dominantSourceFormats: string[];
}) {
  if (
    input.brandRecommendedProviders.length > 0 &&
    input.competitorRecommendedOnlyProviders.length === 0
  ) {
    return "no_gap";
  }
  if (input.competitorRecommendedOnlyProviders.length > 0) {
    return "competitor_recommended_gap";
  }
  if (input.record.promptGroup === "competitor_comparison") {
    return "competitor_comparison_gap";
  }
  if (
    input.brandCitedProviders.length > 0 &&
    input.brandRecommendedProviders.length === 0
  ) {
    return "recommendation_gap";
  }
  if (
    input.brandMentionedProviders.length > 0 &&
    input.brandCitedProviders.length === 0
  ) {
    return "citation_gap";
  }
  const dominantSourceFormat = input.dominantSourceFormats[0] as SourceFormat | undefined;
  if (dominantSourceFormat === "marketplace_listing") return "marketplace_gap";
  if (dominantSourceFormat === "reddit_thread") return "community_gap";
  if (dominantSourceFormat === "comparison_page") return "comparison_gap";
  if (dominantSourceFormat === "blog_guide" || dominantSourceFormat === "listicle") {
    return "guide_gap";
  }

  return "manual_inspection_gap";
}

function legacyAnswerSignal(record: PromptScanRecord): AnswerSignal {
  return {
    brandPresence: record.visibilityScore.brandMentioned ? "mentioned" : "absent",
    brandCitations: record.visibilityScore.brandCited ? ["owned"] : [],
    brandRecommendation: record.visibilityScore.brandMentioned ? "neutral" : "absent",
    brandRank: null,
    recommendationPosition: null,
    sentiment: "neutral",
    quote: null,
    confidence: "low",
    competitorSignals: [
      ...record.visibilityScore.competitorsMentioned,
      ...record.visibilityScore.competitorsCited,
    ].map((competitor) => ({
      name: competitor.name,
      mentioned: competitor.mentioned,
      cited: competitor.cited,
      recommendation: "neutral",
      rank: null,
      sentiment: "neutral",
      quote: null,
      confidence: "low",
    })),
  };
}

function isRecommended(recommendation: AnswerSignal["brandRecommendation"]) {
  return (
    recommendation === "recommended" ||
    recommendation === "top_pick" ||
    recommendation === "qualified"
  );
}

function topValues<T extends string>(items: T[]) {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([item]) => item);
}

function dominant<T extends string>(items: T[]) {
  return topValues(items)[0] ?? "unknown";
}
