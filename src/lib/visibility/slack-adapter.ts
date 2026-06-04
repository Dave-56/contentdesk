import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { BrandProfile, ResearchSource, TopicBrief } from "@/lib/schemas";
import {
  topicBriefSchema,
  type BrandProfile as ParsedBrandProfile,
} from "@/lib/schemas";
import {
  visibilityRecommendationsFileSchema,
  type VisibilityRecommendation,
  type VisibilityRecommendationsFile,
} from "@/lib/visibility/recommender";

const supportedProductionTaskTypes = [
  "alternative_page",
  "comparison_page",
  "guide",
] as const;

export const slackDefaultModeSchema = z.enum(["topics", "visibility"]);
export type SlackDefaultMode = z.infer<typeof slackDefaultModeSchema>;

export const visibilityRecommendationForSlackSchema = z.object({
  id: z.string().trim().min(1),
  runId: z.string().trim().min(1),
  hash: z.string().trim().min(1),
  brand: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  providers: z.array(z.string().trim().min(1)).default([]),
  generatedAt: z.string().datetime(),
  basedOnRunDate: z.string().datetime(),
  sourcePath: z.string().trim().min(1),
  rank: z.number().int().min(1),
  title: z.string().trim().min(1),
  taskType: z.string().trim().min(1),
  productionSupported: z.boolean(),
  priority: z.enum(["high", "medium", "low"]),
  confidence: z.enum(["high", "medium", "low"]),
  targetPromptId: z.string().trim().min(1),
  targetPrompt: z.string().trim().min(1),
  why: z.array(z.string().trim().min(1)).min(1),
  evidence: z.object({
    promptGroup: z.string().trim().min(1),
    brandMentioned: z.boolean(),
    brandCited: z.boolean(),
    brandRecommendation: z
      .enum([
        "absent",
        "neutral",
        "recommended",
        "top_pick",
        "qualified",
        "not_recommended",
      ])
      .default("absent"),
    brandRank: z.number().int().min(1).nullable().default(null),
    competitorsMentioned: z.array(z.string().trim().min(1)),
    competitorsRecommended: z.array(z.string().trim().min(1)).default([]),
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

export type VisibilityRecommendationForSlack = z.infer<
  typeof visibilityRecommendationForSlackSchema
>;

type RecommendationFileCandidate = {
  path: string;
  parsed: VisibilityRecommendationsFile;
};

export function getSlackDefaultMode(): SlackDefaultMode {
  return slackDefaultModeSchema.catch("topics").parse(
    process.env.CONTENTDESK_SLACK_DEFAULT,
  );
}

export async function getLatestVisibilityRecommendationForSlack(input: {
  brandProfile: BrandProfile;
  dataDir?: string;
}) {
  const candidates = await loadRecommendationCandidates({
    brandProfile: input.brandProfile,
    dataDir: input.dataDir,
  });
  const latest = candidates
    .sort((left, right) => compareRecommendationFiles(right, left))[0];
  const recommendation = latest?.parsed.recommendations
    .slice()
    .sort((left, right) => left.rank - right.rank)[0];

  if (!latest || !recommendation) return null;

  return normalizeRecommendation({
    file: latest.parsed,
    recommendation,
    sourcePath: latest.path,
  });
}

export async function reloadVisibilityRecommendationForSlack(
  recommendation: VisibilityRecommendationForSlack,
) {
  const raw = await readFile(recommendation.sourcePath, "utf8");
  const parsed = visibilityRecommendationsFileSchema.parse(JSON.parse(raw));
  const matched = parsed.recommendations.find(
    (item) =>
      recommendationId(item) === recommendation.id &&
      runIdForFile(parsed) === recommendation.runId,
  );

  if (!matched) return null;

  return normalizeRecommendation({
    file: parsed,
    recommendation: matched,
    sourcePath: recommendation.sourcePath,
  });
}

export function isVisibilityRecommendationStale(input: {
  rendered: VisibilityRecommendationForSlack;
  current: VisibilityRecommendationForSlack | null;
  actionHash: string;
  actionRunId: string;
}) {
  if (!input.current) return true;
  return (
    input.rendered.hash !== input.actionHash ||
    input.rendered.runId !== input.actionRunId ||
    input.current.hash !== input.actionHash ||
    input.current.runId !== input.actionRunId
  );
}

export function buildTopicBriefFromVisibilityRecommendation(input: {
  recommendation: VisibilityRecommendationForSlack;
  brandProfile: ParsedBrandProfile;
}): TopicBrief {
  const rec = input.recommendation;
  const sourceLinks = [
    ...sourceLinksForRecommendation(rec),
    ...input.brandProfile.existingBlogDocsUrls,
  ].slice(0, 8);
  const competitorText = rec.evidence.competitorsMentioned.length
    ? rec.evidence.competitorsMentioned.join(", ")
    : "named competitors";

  return topicBriefSchema.parse({
    topic: rec.targetPrompt,
    workingTitle: rec.title,
    strategicFingerprint: [
      "visibility",
      rec.taskType,
      rec.targetPromptId,
    ].join("-"),
    strategyType: strategyTypeForTask(rec.taskType),
    funnelStage: funnelStageForPromptGroup(rec.evidence.promptGroup),
    merchantJob: `Answer this buyer prompt better than the current citation set: ${rec.targetPrompt}`,
    messageAngle: `Use the visibility gap as the spine: ${rec.why[0]}`,
    proofAngle: [
      `Reference cited domains: ${rec.evidence.citedDomains.slice(0, 8).join(", ") || "none captured"}.`,
      rec.evidence.relatedAssets.length
        ? `Use related owned assets as pattern/context: ${rec.evidence.relatedAssets.map((asset) => asset.title).join("; ")}.`
        : "Use the Brand Profile and captured visibility evidence as proof context.",
    ].join(" "),
    strategyEvidence: [
      `Visibility recommendation: ${rec.title}`,
      `Target prompt: ${rec.targetPrompt}`,
      `Task type: ${rec.taskType}`,
      `Dominant source format: ${rec.evidence.dominantSourceFormat}`,
      `Brand mentioned: ${rec.evidence.brandMentioned ? "yes" : "no"}`,
      `Brand cited: ${rec.evidence.brandCited ? "yes" : "no"}`,
      `Brand recommendation: ${rec.evidence.brandRecommendation.replace(/_/g, " ")}`,
      rec.evidence.brandRank ? `Brand rank: ${rec.evidence.brandRank}` : "Brand rank: none",
      `Competitors mentioned: ${competitorText}`,
      `Competitors recommended: ${
        rec.evidence.competitorsRecommended.length
          ? rec.evidence.competitorsRecommended.join(", ")
          : "none"
      }`,
      ...rec.why,
    ],
    whyThisStrategy:
      "Selected from visibility scan evidence, not generic topic ideation.",
    targetMerchantPain:
      rec.evidence.missingOrWeakAssetType
        ? `Buyer needs a trustworthy ${rec.evidence.missingOrWeakAssetType.replace(/_/g, " ")} for: ${rec.targetPrompt}`
        : `Buyer needs a trustworthy answer for: ${rec.targetPrompt}`,
    shopifySpecificAngle: input.brandProfile.targetMerchant,
    whyNow: [
      `${rec.provider} visibility data generated ${rec.generatedAt} shows this gap.`,
      `Recheck cadence: ${rec.recheck.cadenceDays} day${rec.recheck.cadenceDays === 1 ? "" : "s"}.`,
    ].join(" "),
    searchIntent: rec.targetPrompt,
    contentGap: [
      `Current trusted source format: ${rec.evidence.dominantSourceFormat}.`,
      `Recommended intervention: ${rec.title}.`,
      `Cited domains: ${rec.evidence.citedDomains.slice(0, 8).join(", ") || "none captured"}.`,
    ].join(" "),
    suggestedCtaAngle: input.brandProfile.ctaStyle,
    sourceLinks,
    score: scoreForRecommendation(rec),
  });
}

export function buildResearchSourcesFromVisibilityRecommendation(input: {
  recommendation: VisibilityRecommendationForSlack;
  fetchedAt?: string;
}): ResearchSource[] {
  const rec = input.recommendation;
  const fetchedAt = input.fetchedAt ?? new Date().toISOString();
  const links = sourceLinksForRecommendation(rec);

  return links.map((url) => ({
    provider: "seed" as const,
    query: rec.targetPrompt,
    url,
    title: titleForSourceUrl(url, rec),
    excerpt: [
      `Visibility evidence for ${rec.title}.`,
      `Dominant source format: ${rec.evidence.dominantSourceFormat}.`,
      `Why: ${rec.why.join(" ")}`,
    ].join(" "),
    extractedMarkdown: "",
    fetchedAt,
  }));
}

async function loadRecommendationCandidates(input: {
  brandProfile: BrandProfile;
  dataDir?: string;
}) {
  const dataDir = input.dataDir ?? "data";
  const files = await recommendationFilePaths(dataDir);
  const brandNames = brandNameSet(input.brandProfile);
  const candidates: RecommendationFileCandidate[] = [];

  for (const filePath of files) {
    const raw = await readFile(filePath, "utf8");
    const parsed = visibilityRecommendationsFileSchema.parse(JSON.parse(raw));
    if (!brandNames.has(normalizeName(parsed.brand))) continue;
    candidates.push({ path: filePath, parsed });
  }

  return candidates;
}

async function recommendationFilePaths(dataDir: string) {
  const dirs = await readdir(dataDir, { withFileTypes: true }).catch((error: unknown) => {
    if (isNotFound(error)) return [];
    throw error;
  });
  const files: string[] = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const filePath = path.join(dataDir, dir.name, "visibility", "recommendations.json");
    const raw = await readFile(filePath, "utf8").catch((error: unknown) => {
      if (isNotFound(error)) return null;
      throw error;
    });
    if (raw === null) continue;
    files.push(filePath);
  }

  return files;
}

function normalizeRecommendation(input: {
  file: VisibilityRecommendationsFile;
  recommendation: VisibilityRecommendation;
  sourcePath: string;
}) {
  const id = recommendationId(input.recommendation);
  const runId = runIdForFile(input.file);
  const productionSupported = supportedProductionTaskTypes.includes(
    input.recommendation.taskType as (typeof supportedProductionTaskTypes)[number],
  );
  const normalized = {
    id,
    runId,
    hash: recommendationHash({
      runId,
      recommendation: input.recommendation,
    }),
    brand: input.file.brand,
    provider: input.file.provider,
    providers: input.file.providers ?? [],
    generatedAt: input.file.generatedAt,
    basedOnRunDate: input.file.basedOnRunDate,
    sourcePath: input.sourcePath,
    rank: input.recommendation.rank,
    title: input.recommendation.title,
    taskType: input.recommendation.taskType,
    productionSupported,
    priority: input.recommendation.priority,
    confidence: input.recommendation.confidence,
    targetPromptId: input.recommendation.targetPromptId,
    targetPrompt: input.recommendation.targetPrompt,
    why: input.recommendation.why,
    evidence: input.recommendation.evidence,
    recheck: input.recommendation.recheck,
  };

  return visibilityRecommendationForSlackSchema.parse(normalized);
}

function recommendationId(recommendation: VisibilityRecommendation) {
  return slug(
    [
      recommendation.rank,
      recommendation.taskType,
      recommendation.targetPromptId,
      recommendation.title,
    ].join(" "),
  );
}

function runIdForFile(file: VisibilityRecommendationsFile) {
  return slug([file.provider, file.basedOnRunDate, file.generatedAt].join(" "));
}

function recommendationHash(input: {
  runId: string;
  recommendation: VisibilityRecommendation;
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        runId: input.runId,
        title: input.recommendation.title,
        taskType: input.recommendation.taskType,
        targetPromptId: input.recommendation.targetPromptId,
        targetPrompt: input.recommendation.targetPrompt,
        why: input.recommendation.why,
        evidence: input.recommendation.evidence,
        recheck: input.recommendation.recheck,
      }),
    )
    .digest("hex");
}

function compareRecommendationFiles(
  left: RecommendationFileCandidate,
  right: RecommendationFileCandidate,
) {
  const generatedDelta =
    Date.parse(left.parsed.generatedAt) - Date.parse(right.parsed.generatedAt);
  if (generatedDelta !== 0) return generatedDelta;

  return (
    Date.parse(left.parsed.basedOnRunDate) -
    Date.parse(right.parsed.basedOnRunDate)
  );
}

function brandNameSet(profile: BrandProfile) {
  return new Set([
    normalizeName(profile.appName),
    ...profile.existingBlogDocsUrls.flatMap((rawUrl) => {
      try {
        const hostname = new URL(rawUrl).hostname.replace(/^www\./, "");
        return [normalizeName(hostname), normalizeName(hostname.split(".")[0] ?? "")];
      } catch {
        return [];
      }
    }),
  ]);
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "visibility-recommendation";
}

function sourceLinksForRecommendation(rec: VisibilityRecommendationForSlack) {
  const links = [
    ...rec.evidence.relatedAssets.map((asset) => asset.url),
    ...rec.evidence.citedDomains
      .map((domain) => domain.trim())
      .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))
      .map((domain) => `https://${domain}`),
  ];
  return [...new Set(links)].slice(0, 8);
}

function strategyTypeForTask(taskType: string): TopicBrief["strategyType"] {
  if (taskType === "comparison_page" || taskType === "alternative_page") {
    return "comparison";
  }
  return "education";
}

function funnelStageForPromptGroup(promptGroup: string): TopicBrief["funnelStage"] {
  if (
    promptGroup === "competitor_comparison" ||
    promptGroup === "high_intent_purchase"
  ) {
    return "bottom";
  }
  if (promptGroup === "solution_aware" || promptGroup === "integration_use_case") {
    return "middle";
  }
  return "top";
}

function scoreForRecommendation(rec: VisibilityRecommendationForSlack) {
  const priorityScore = rec.priority === "high" ? 95 : rec.priority === "medium" ? 82 : 68;
  const confidenceBoost = rec.confidence === "high" ? 3 : rec.confidence === "medium" ? 0 : -8;
  return Math.max(0, Math.min(100, priorityScore + confidenceBoost));
}

function titleForSourceUrl(url: string, rec: VisibilityRecommendationForSlack) {
  const related = rec.evidence.relatedAssets.find((asset) => asset.url === url);
  if (related) return related.title;
  try {
    return new URL(url).hostname;
  } catch {
    return rec.title;
  }
}

function isNotFound(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
}
