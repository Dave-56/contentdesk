import { z } from "zod";
import {
  promptScanRunSchema,
  providerSchema,
  type PromptScanRecord,
  type PromptScanRun,
  type PromptScanConfig,
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
  competitorOnly: z.boolean(),
  competitorsMentioned: z.array(z.string().trim().min(1)),
  competitorsCited: z.array(z.string().trim().min(1)),
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
  competitorOnlyProviders: z.array(providerSchema),
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
    const competitorOnlyProviders = providerResults
      .filter((result) => result.competitorOnly)
      .map((result) => result.provider);
    const dominantCompetitors = topValues(
      providerResults.flatMap((result) => [
        ...result.competitorsMentioned,
        ...result.competitorsCited,
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
      competitorOnlyProviders,
      dominantCompetitors,
      dominantSourceFormats,
      recommendedGapType: recommendedGapType({
        record,
        competitorOnlyProviders,
        brandMentionedProviders,
        brandCitedProviders,
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

  return providerSynthesisResultSchema.parse({
    provider: record.provider,
    answerText: record.answerText,
    citedUrls: record.citedUrls,
    citedDomains: record.citedDomains,
    brandMentioned: record.visibilityScore.brandMentioned,
    brandCited: record.visibilityScore.brandCited,
    competitorOnly:
      !record.visibilityScore.brandMentioned && competitorsMentioned.length > 0,
    competitorsMentioned,
    competitorsCited,
    sourceFormats,
    dominantSourceFormat: dominant(sourceFormats),
    recommendationConfidence: record.recommendationConfidence,
  });
}

function recommendedGapType(input: {
  record: PromptScanRecord;
  competitorOnlyProviders: string[];
  brandMentionedProviders: string[];
  brandCitedProviders: string[];
  dominantSourceFormats: string[];
}) {
  if (
    input.brandMentionedProviders.length > 0 &&
    input.brandCitedProviders.length > 0 &&
    input.competitorOnlyProviders.length === 0
  ) {
    return "no_gap";
  }
  if (input.record.promptGroup === "competitor_comparison") {
    return "competitor_comparison_gap";
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
