import {
  promptScanRecordSchema,
  promptScanRunSchema,
  type AssetInventoryItem,
  type CitationQuality,
  type CitedSource,
  type Competitor,
  type CompetitorVisibility,
  type PromptScanConfig,
  type PromptScanRecord,
  type PromptScanRun,
  type SourceFormat,
  type PromptInput,
} from "@/lib/prompt-scan/schemas";

export type ProviderPromptResult = {
  answerText: string;
  citedUrls: string[];
};

export function buildPromptScanRun(input: {
  config: PromptScanConfig;
  results: Array<{
    prompt: PromptInput;
    result: ProviderPromptResult;
  }>;
  runDate?: Date;
}): PromptScanRun {
  const runDate = input.runDate ?? new Date();
  const records = input.results.map(({ prompt, result }) =>
    analyzePromptResult({
      prompt,
      result,
      config: input.config,
      runDate,
    }),
  );

  return promptScanRunSchema.parse({
    brand: input.config.brand.name,
    provider: input.config.provider,
    runDate: runDate.toISOString(),
    recheckCadenceDays: input.config.defaultRecheckDays,
    experimentWindowDays: input.config.experimentWindowDays,
    records,
    summary: summarizeRecords(records),
  });
}

export function analyzePromptResult(input: {
  prompt: PromptInput;
  result: ProviderPromptResult;
  config: PromptScanConfig;
  runDate?: Date;
}): PromptScanRecord {
  const runDate = input.runDate ?? new Date();
  const citedUrls = uniqueUrls(input.result.citedUrls);
  const citedSources = citedUrls.map((url) => classifyCitedSource(url, input.config));
  const citedDomains = [...new Set(citedSources.map((source) => source.domain))];
  const brandMentioned = hasAnyAlias(
    input.result.answerText,
    [input.config.brand.name, ...input.config.brand.aliases],
  );
  const brandCited = citedSources.some((source) =>
    input.config.brand.domains.some((domain) => source.domain.endsWith(domain)),
  );
  const competitorVisibility = input.config.competitors.map((competitor) =>
    analyzeCompetitorVisibility({
      competitor,
      answerText: input.result.answerText,
      citedSources,
    }),
  );
  const competitorsMentioned = competitorVisibility.filter((item) => item.mentioned);
  const competitorsCited = competitorVisibility.filter((item) => item.cited);
  const visibilityScore = {
    brandMentioned,
    brandCited,
    mentionPosition: mentionPosition(input.result.answerText, [
      input.config.brand.name,
      ...input.config.brand.aliases,
    ]),
    competitorsMentioned,
    competitorsCited,
    citationCount: citedUrls.length,
    sourceStrength: sourceStrength(citedSources),
    score: numericVisibilityScore({
      brandMentioned,
      brandCited,
      competitorsMentionedCount: competitorsMentioned.length,
      competitorsCitedCount: competitorsCited.length,
      citedSources,
    }),
  };

  return promptScanRecordSchema.parse({
    id: input.prompt.id,
    prompt: input.prompt.prompt,
    promptGroup: input.prompt.group,
    provider: input.config.provider,
    answerText: input.result.answerText,
    citedUrls,
    citedDomains,
    citedSources,
    runDate: runDate.toISOString(),
    visibilityScore,
    recommendedNextAction: recommendedNextAction({
      brandName: input.config.brand.name,
      citedSources,
      visibilityScore,
      assetInventory: input.config.assetInventory,
    }),
    recommendationConfidence: recommendationConfidence({
      citedSources,
      competitorsMentionedCount: competitorsMentioned.length,
      competitorsCitedCount: competitorsCited.length,
      brandMentioned,
      brandCited,
    }),
    recheckDate: dateAfter(runDate, input.config.defaultRecheckDays),
  });
}

export function classifyCitedSource(
  url: string,
  config: Pick<PromptScanConfig, "brand">,
): CitedSource {
  const domain = domainFromUrl(url);

  return {
    url,
    domain,
    sourceFormat: classifySourceFormat(url),
    citationQuality: classifyCitationQuality(url, config),
  };
}

export function classifySourceFormat(url: string): SourceFormat {
  const lower = url.toLowerCase();
  const domain = domainFromUrl(url);

  if (domain === "apps.shopify.com") return "marketplace_listing";
  if (domain.includes("reddit.com")) return "reddit_thread";
  if (domain.includes("youtube.com") || domain.includes("youtu.be")) {
    return "youtube_video";
  }
  if (domain.includes("g2.com") || domain.includes("capterra.com")) {
    return "review_site";
  }
  if (domain.includes("docs.") || lower.includes("/docs") || lower.includes("/help")) {
    return "vendor_docs";
  }
  if (lower.includes("alternatives") || lower.includes("-vs-") || lower.includes("/vs/")) {
    return "comparison_page";
  }
  if (lower.includes("/blog") || lower.includes("/guides")) return "blog_guide";
  if (lower.includes("best-") || lower.includes("/best/")) return "listicle";
  if (lower === `https://${domain}/` || lower === `http://${domain}/`) {
    return "product_page";
  }

  return "unknown";
}

export function classifyCitationQuality(
  url: string,
  config: Pick<PromptScanConfig, "brand">,
): CitationQuality {
  const lower = url.toLowerCase();
  const domain = domainFromUrl(url);

  if (config.brand.domains.some((brandDomain) => domain.endsWith(brandDomain))) {
    return "owned_source";
  }
  if (domain === "apps.shopify.com") return "platform_marketplace";
  if (domain.includes("reddit.com") || domain.includes("forum")) return "community";
  if (domain.includes("g2.com") || domain.includes("capterra.com")) return "review_site";
  if (
    lower.includes("best-") ||
    lower.includes("/best/") ||
    lower.includes("alternatives") ||
    lower.includes("-vs-") ||
    lower.includes("/vs/")
  ) {
    return "affiliate_seo";
  }
  if (domain.includes("shopify.com")) return "earned_source";

  return "unknown";
}

function analyzeCompetitorVisibility(input: {
  competitor: Competitor;
  answerText: string;
  citedSources: CitedSource[];
}): CompetitorVisibility {
  const aliases = [input.competitor.name, ...input.competitor.aliases];
  const mentionCount = countAliases(input.answerText, aliases);
  const citationCount = input.citedSources.filter((source) =>
    input.competitor.domains.some((domain) => source.domain.endsWith(domain)),
  ).length;

  return {
    name: input.competitor.name,
    mentioned: mentionCount > 0,
    mentionCount,
    cited: citationCount > 0,
    citationCount,
  };
}

function recommendedNextAction(input: {
  brandName: string;
  citedSources: CitedSource[];
  visibilityScore: {
    brandMentioned: boolean;
    brandCited: boolean;
    competitorsMentioned: CompetitorVisibility[];
    competitorsCited: CompetitorVisibility[];
  };
  assetInventory: AssetInventoryItem[];
}) {
  if (input.visibilityScore.brandCited) {
    return `${input.brandName} is already cited. Recheck tomorrow and compare whether citation position, source mix, or competitor mix changes.`;
  }

  const dominantQuality = dominant(
    input.citedSources.map((source) => source.citationQuality),
  );
  const dominantFormat = dominant(input.citedSources.map((source) => source.sourceFormat));

  if (dominantQuality === "platform_marketplace") {
    return inventoryAction(
      input.assetInventory,
      "shopify_app_store_listing",
      "Improve the Shopify App Store listing because marketplace listings are the trusted citation surface for this prompt.",
    );
  }
  if (dominantQuality === "community") {
    return inventoryAction(
      input.assetInventory,
      "reddit_community_mention",
      "Create or earn a helpful community answer because community sources are the trusted citation surface for this prompt.",
    );
  }
  if (dominantFormat === "comparison_page") {
    return inventoryAction(
      input.assetInventory,
      "comparison_page",
      "Create or improve a comparison page because comparison assets are the trusted citation surface for this prompt.",
    );
  }
  if (dominantFormat === "blog_guide" || dominantFormat === "listicle") {
    return inventoryAction(
      input.assetInventory,
      "blog_guide",
      "Create a focused guide that directly answers the prompt and includes clear criteria, proof, and FAQs.",
    );
  }

  return "Manually inspect the cited sources, classify the winning source pattern, then create the matching asset or fix.";
}

function inventoryAction(
  inventory: AssetInventoryItem[],
  type: AssetInventoryItem["type"],
  action: string,
) {
  const item = inventory.find((asset) => asset.type === type);
  if (!item || item.status === "missing") return action;
  if (item.status === "present" && item.url) {
    return `${action} Existing asset: ${item.url}`;
  }

  return `${action} Current asset status is ${item.status}.`;
}

function recommendationConfidence(input: {
  citedSources: CitedSource[];
  competitorsMentionedCount: number;
  competitorsCitedCount: number;
  brandMentioned: boolean;
  brandCited: boolean;
}) {
  const repeatedPattern = dominant(input.citedSources.map((source) => source.citationQuality));
  const sourceCount = input.citedSources.length;
  const competitorSignal =
    input.competitorsMentionedCount + input.competitorsCitedCount;

  if (input.brandCited) return "medium";
  if (sourceCount >= 3 && repeatedPattern !== "unknown" && competitorSignal >= 2) {
    return "high";
  }
  if (sourceCount >= 2 || competitorSignal >= 1 || input.brandMentioned) {
    return "medium";
  }

  return "low";
}

function numericVisibilityScore(input: {
  brandMentioned: boolean;
  brandCited: boolean;
  competitorsMentionedCount: number;
  competitorsCitedCount: number;
  citedSources: CitedSource[];
}) {
  let score = 0;
  if (input.brandMentioned) score += 35;
  if (input.brandCited) score += 45;
  score -= Math.min(25, input.competitorsMentionedCount * 5);
  score -= Math.min(20, input.competitorsCitedCount * 8);
  if (input.citedSources.some((source) => source.citationQuality === "owned_source")) {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

function sourceStrength(citedSources: CitedSource[]) {
  if (
    citedSources.some((source) =>
      ["platform_marketplace", "review_site", "earned_source"].includes(
        source.citationQuality,
      ),
    )
  ) {
    return "strong" as const;
  }
  if (citedSources.some((source) => source.citationQuality !== "unknown")) {
    return "medium" as const;
  }

  return "weak" as const;
}

function summarizeRecords(records: PromptScanRecord[]) {
  const promptCount = records.length;
  const brandMentionedCount = records.filter(
    (record) => record.visibilityScore.brandMentioned,
  ).length;
  const brandCitedCount = records.filter(
    (record) => record.visibilityScore.brandCited,
  ).length;
  const competitorOnlyCount = records.filter(
    (record) =>
      !record.visibilityScore.brandMentioned &&
      record.visibilityScore.competitorsMentioned.length > 0,
  ).length;
  const averageVisibilityScore = promptCount
    ? Math.round(
        records.reduce((sum, record) => sum + record.visibilityScore.score, 0) /
          promptCount,
      )
    : 0;

  return {
    promptCount,
    brandMentionedCount,
    brandCitedCount,
    competitorOnlyCount,
    averageVisibilityScore,
  };
}

function mentionPosition(answerText: string, aliases: string[]) {
  const lower = answerText.toLowerCase();
  const firstIndex = aliases
    .map((alias) => lower.indexOf(alias.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  if (firstIndex === undefined) return "absent" as const;
  if (firstIndex <= lower.length / 3) return "top" as const;
  if (firstIndex <= (lower.length / 3) * 2) return "middle" as const;

  return "bottom" as const;
}

function hasAnyAlias(text: string, aliases: string[]) {
  return aliases.some((alias) => countAlias(text, alias) > 0);
}

function countAliases(text: string, aliases: string[]) {
  return aliases.reduce((count, alias) => count + countAlias(text, alias), 0);
}

function countAlias(text: string, alias: string) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = text.match(new RegExp(`\\b${escaped}\\b`, "gi"));

  return matches?.length ?? 0;
}

function uniqueUrls(urls: string[]) {
  return [...new Set(urls)].filter((url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  });
}

function domainFromUrl(url: string) {
  return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
}

function dominant<T extends string>(values: T[]) {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "unknown";
}

function dateAfter(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);

  return next.toISOString().slice(0, 10);
}
