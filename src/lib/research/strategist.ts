import { generateText, Output } from "ai";
import { getEnv } from "@/lib/env";
import {
  researchSourcesSchema,
  topicBriefSchema,
  topicBriefsSchema,
  type BrandProfile,
  type ResearchSource,
  type TopicBrief,
} from "@/lib/schemas";
import { aiTopicBriefSchema } from "@/lib/ai-schemas";
import { ParallelResearchProvider } from "@/lib/research/parallel";
import {
  buildArticleRequestResearchObjectives,
  buildResearchObjectives,
  type ResearchObjective,
  type ResearchProvider,
} from "@/lib/research/provider";
import { seedResearchSources } from "@/lib/research/seed";
import {
  formatArticleMemoryForPrompt,
  type ArticleMemoryItem,
} from "@/lib/article-memory";
import {
  formatRecentTopicStrategyMemory,
  type TopicStrategyMemoryItem,
} from "@/lib/topic-memory";

export type ResearchStrategistResult = {
  topics: TopicBrief[];
  sources: ResearchSource[];
};

export class ResearchStrategistError extends Error {
  constructor(
    message: string,
    readonly userMessage: string,
  ) {
    super(message);
    this.name = "ResearchStrategistError";
  }
}

export async function generateTopicBriefs(input: {
  brandProfile: BrandProfile;
  provider?: ResearchProvider;
  articleMemory?: ArticleMemoryItem[];
  topicMemory?: TopicStrategyMemoryItem[];
}): Promise<ResearchStrategistResult> {
  const objectives = buildResearchObjectives(input.brandProfile);
  const seedSources = seedResearchSources(input.brandProfile, objectives);
  const sources = await collectResearchSources({
    brandProfile: input.brandProfile,
    objectives,
    provider: input.provider,
    seedSources,
  });

  const topics = await generateAiTopicBriefs({
    brandProfile: input.brandProfile,
    sources,
    articleMemory: input.articleMemory ?? [],
    topicMemory: input.topicMemory ?? [],
  });

  return {
    topics: rankTopics(topics),
    sources,
  };
}

export async function generateTopicBriefForArticleRequest(input: {
  brandProfile: BrandProfile;
  articleIdea: string;
  provider?: ResearchProvider;
  articleMemory?: ArticleMemoryItem[];
  topicMemory?: TopicStrategyMemoryItem[];
}): Promise<{ topic: TopicBrief; sources: ResearchSource[] }> {
  const objectives = buildArticleRequestResearchObjectives({
    profile: input.brandProfile,
    articleIdea: input.articleIdea,
  });
  const seedSources = seedResearchSources(input.brandProfile, objectives);
  const sources = await collectResearchSources({
    brandProfile: input.brandProfile,
    objectives,
    provider: input.provider,
    seedSources,
  });
  const topic = await generateAiTopicBriefForArticleRequest({
    brandProfile: input.brandProfile,
    articleIdea: input.articleIdea,
    sources,
    articleMemory: input.articleMemory ?? [],
    topicMemory: input.topicMemory ?? [],
  });

  return { topic, sources };
}

async function collectResearchSources(input: {
  brandProfile: BrandProfile;
  objectives: ResearchObjective[];
  provider?: ResearchProvider;
  seedSources: ResearchSource[];
}) {
  const provider = input.provider ?? createDefaultProvider();
  if (!provider) {
    throw new ResearchStrategistError(
      "PARALLEL_API_KEY is not configured",
      "Parallel is not configured. Add PARALLEL_API_KEY to .env.local and restart the Slack app.",
    );
  }

  const searched = await provider.search(input.objectives).catch((error: unknown) => {
    throw new ResearchStrategistError(
      `Parallel Search failed: ${errorMessage(error)}`,
      `Parallel Search failed: ${errorMessage(error)}`,
    );
  });
  const withSeedSources = mergeSources([...searched, ...input.seedSources]);
  const extracted = await provider.extract(withSeedSources, input.objectives).catch((error: unknown) => {
    throw new ResearchStrategistError(
      `Parallel Extract failed: ${errorMessage(error)}`,
      `Parallel Extract failed: ${errorMessage(error)}`,
    );
  });

  return researchSourcesSchema.parse(mergeSources(extracted).slice(0, 16));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createDefaultProvider() {
  const { PARALLEL_API_KEY } = getEnv();
  if (!PARALLEL_API_KEY) return null;

  return new ParallelResearchProvider(PARALLEL_API_KEY);
}

async function generateAiTopicBriefs(input: {
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  articleMemory: ArticleMemoryItem[];
  topicMemory: TopicStrategyMemoryItem[];
}) {
  if (!isAiGatewayConfigured()) {
    throw new ResearchStrategistError(
      "AI SDK gateway credentials are not configured",
      "AI generation is not configured. Add AI_GATEWAY_API_KEY or Vercel OIDC credentials, then restart the Slack app.",
    );
  }

  const { CONTENTDESK_AI_MODEL } = getEnv();
  const model = CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";
  const allowedUrls = input.sources.map((source) => source.url);

  const firstTopics = await requestAiTopicBriefs({
    ...input,
    model,
    allowedUrls,
  });

  const correction = topicGenerationCorrection({
    topics: firstTopics,
    topicMemory: input.topicMemory,
  });
  if (!correction) return firstTopics;

  return requestAiTopicBriefs({
    ...input,
    model,
    allowedUrls,
    generationCorrection: correction,
  });
}

async function generateAiTopicBriefForArticleRequest(input: {
  brandProfile: BrandProfile;
  articleIdea: string;
  sources: ResearchSource[];
  articleMemory: ArticleMemoryItem[];
  topicMemory: TopicStrategyMemoryItem[];
}) {
  if (!isAiGatewayConfigured()) {
    throw new ResearchStrategistError(
      "AI SDK gateway credentials are not configured",
      "AI generation is not configured. Add AI_GATEWAY_API_KEY or Vercel OIDC credentials, then restart the Slack app.",
    );
  }

  const { CONTENTDESK_AI_MODEL } = getEnv();
  const model = CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";
  const allowedUrls = input.sources.map((source) => source.url);
  const { output } = await generateText({
    model,
    output: Output.object({
      schema: aiTopicBriefSchema,
    }),
    prompt: articleRequestStrategistPrompt({
      ...input,
      allowedUrls,
    }),
  }).catch((error: unknown) => {
    throw new ResearchStrategistError(
      `AI direct article strategy failed: ${errorMessage(error)}`,
      `AI direct article strategy failed: ${errorMessage(error)}`,
    );
  });

  return topicBriefSchema.parse(constrainTopicSources(output, allowedUrls));
}

async function requestAiTopicBriefs(input: {
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  articleMemory: ArticleMemoryItem[];
  topicMemory: TopicStrategyMemoryItem[];
  model: string;
  allowedUrls: string[];
  generationCorrection?: string;
}) {
  const { output } = await generateText({
    model: input.model,
    output: Output.array({
      element: aiTopicBriefSchema,
    }),
    prompt: strategistPrompt({
      brandProfile: input.brandProfile,
      sources: input.sources,
      allowedUrls: input.allowedUrls,
      articleMemory: input.articleMemory,
      topicMemory: input.topicMemory,
      generationCorrection: input.generationCorrection,
    }),
  }).catch((error: unknown) => {
    throw new ResearchStrategistError(
      `AI topic generation failed: ${errorMessage(error)}`,
      `AI topic generation failed: ${errorMessage(error)}`,
    );
  });

  const constrained = output.map((topic) => constrainTopicSources(topic, input.allowedUrls));

  return topicBriefsSchema.parse(rankTopics(constrained));
}

export function hasStrategicTopicCoverage(topics: TopicBrief[]) {
  const strategyTypes = new Set(topics.map((topic) => topic.strategyType));

  return (
    strategyTypes.has("education") &&
    strategyTypes.has("workflow") &&
    strategyTypes.has("comparison")
  );
}

export function hasDuplicateStrategicFingerprints(topics: TopicBrief[]) {
  return duplicateStrategicFingerprints(topics).length > 0;
}

export function duplicateStrategicFingerprints(topics: TopicBrief[]) {
  const counts = fingerprintCounts(topics.map((topic) => topic.strategicFingerprint));

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([fingerprint]) => fingerprint);
}

export function hasRecentFingerprintRepetition(input: {
  topics: TopicBrief[];
  topicMemory: TopicStrategyMemoryItem[];
}) {
  return repeatedRecentStrategicFingerprints(input).length >= 2;
}

export function repeatedRecentStrategicFingerprints(input: {
  topics: TopicBrief[];
  topicMemory: TopicStrategyMemoryItem[];
}) {
  const recent = new Set(
    input.topicMemory.map((item) => item.strategicFingerprint).filter(Boolean),
  );

  return input.topics
    .map((topic) => topic.strategicFingerprint)
    .filter((fingerprint) => recent.has(fingerprint));
}

function topicGenerationCorrection(input: {
  topics: TopicBrief[];
  topicMemory: TopicStrategyMemoryItem[];
}) {
  const corrections = [
    strategicCoverageCorrection(input.topics),
    duplicateStrategicFingerprints(input.topics).length
      ? [
          `The previous output repeated strategicFingerprint inside the same batch: ${duplicateStrategicFingerprints(input.topics).join(", ")}.`,
          "Return three topics with distinct strategicFingerprint values and distinct merchant jobs/message angles.",
        ].join(" ")
      : "",
    hasRecentFingerprintRepetition(input)
      ? [
          `The previous output repeated recent strategicFingerprint values: ${repeatedRecentStrategicFingerprints(input).join(", ")}.`,
          "Avoid recent strategic patterns unless the new topic is clearly narrower, more advanced, or meaningfully different; explain that difference in whyThisStrategy if you keep one repeat.",
        ].join(" ")
      : "",
  ].filter(Boolean);

  return corrections.join(" ");
}

function strategicCoverageCorrection(topics: TopicBrief[]) {
  if (hasStrategicTopicCoverage(topics)) return "";

  const present = [...new Set(topics.map((topic) => topic.strategyType))].join(", ");

  return [
    `The previous output did not provide all three strategic lanes. Present lanes: ${present || "none"}.`,
    "Return exactly one education topic, one workflow topic, and one comparison topic.",
    "The comparison topic may be an alternatives, best-tools, how-to-choose, switching, versus, or category evaluation guide.",
  ].join(" ");
}

function fingerprintCounts(fingerprints: string[]) {
  const counts = new Map<string, number>();

  for (const fingerprint of fingerprints) {
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  }

  return counts;
}

function isAiGatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function strategistPrompt(input: {
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  allowedUrls: string[];
  articleMemory: ArticleMemoryItem[];
  topicMemory: TopicStrategyMemoryItem[];
  generationCorrection?: string;
}) {
  const profile = input.brandProfile;

  return [
    "You are ContentDesk's Research Strategist for Shopify app founders.",
    "Generate exactly 3 ranked TopicBrief objects for founder approval.",
    "Do not draft the article. Do not propose generic ecommerce topics.",
    "Each topic must be specific to Shopify apps, the target merchant, and the Brand Profile.",
    "Anchor the topics in the product's actual category, buyer pain, and promised workflow.",
    "Use strategic topic coverage: return one education topic, one workflow topic, and one comparison topic when credible evidence exists.",
    "Set strategyType to education, workflow, or comparison. Set funnelStage to top, middle, or bottom. Explain the strategic reason in whyThisStrategy.",
    "Fill the intent-matched article strategy fields for every topic.",
    "merchantJob: the specific Shopify merchant job this article helps with.",
    "intentType: usually pain_awareness for education, workflow_solution for workflow, and comparison_decision for comparison.",
    "messageAngle: how the article should frame the problem or decision.",
    "proofAngle: what kind of evidence, example, comparison, workflow, or visual support will make the article credible.",
    "strategicFingerprint: a short lowercase hyphenated fingerprint from the merchantJob plus messageAngle. Use it to identify whether this repeats a prior strategic pattern; do not make it founder-facing.",
    "strategyEvidence: 2-4 short bullets explaining why this is a good content bet using only currently available inputs.",
    "Prefix each strategyEvidence item with its input type: Brand Profile, Research source, Article memory, or Competitor list.",
    "Only use evidence from the Brand Profile, Existing Article Memory, allowed research sources, existing blog/docs URLs, or competitor names in the Brand Profile.",
    "Do not imply access to app reviews, competitor reviews, YouTube comments, support tickets, Ahrefs, Semrush, Google Search Console, or other search metrics unless such a source is actually present in the allowed research sources.",
    "Do not write evidence as validated multi-channel market proof. strategyEvidence means available evidence from current inputs.",
    "Education topics should clarify a real merchant pain or category problem. Workflow topics should show a practical Shopify operating process or use case.",
    "Comparison topics may include alternatives, best tools, how to choose, category evaluation guides, versus pages, or switching guides; they do not have to mention a competitor by name.",
    "Make comparison topics honest and useful: include decision criteria and tradeoffs, not thin competitor attacks.",
    "Avoid meta-topics about content calendars, founder-led content, app onboarding, or ContentDesk unless the Brand Profile itself is about those things.",
    "Use Existing Article Memory as a hard duplicate-avoidance constraint.",
    "Do not propose a topic that materially overlaps an existing article or recent handoff, even if the title wording is different.",
    "Treat articles as duplicates when they share the same merchant pain, search intent, Shopify angle, or beginner/how-to job.",
    "Adjacent follow-up topics are allowed only when the content gap is clearly narrower, newer, or more advanced than the remembered article.",
    "Use Recent Topic Strategy Memory as a strategic novelty constraint.",
    "Avoid repeating recent strategicFingerprint, merchantJob, or messageAngle unless the new topic is clearly narrower, more advanced, or meaningfully different.",
    "Each sourceLinks entry must be copied exactly from the allowed source URLs. Never invent URLs.",
    "Prefer topics with a clear merchant pain, a Shopify-specific angle, and a content gap.",
    input.generationCorrection
      ? `Topic generation correction: ${input.generationCorrection}`
      : "",
    "",
    "Brand Profile:",
    JSON.stringify(profile, null, 2),
    "",
    "Allowed source URLs:",
    input.allowedUrls.map((url) => `- ${url}`).join("\n"),
    "",
    "Existing Article Memory:",
    formatArticleMemoryForPrompt(input.articleMemory),
    "",
    "Recent Topic Strategy Memory:",
    formatRecentTopicStrategyMemory(input.topicMemory),
    "",
    "Research sources:",
    input.sources.map(formatSourceForPrompt).join("\n\n"),
  ].join("\n");
}

function articleRequestStrategistPrompt(input: {
  brandProfile: BrandProfile;
  articleIdea: string;
  sources: ResearchSource[];
  allowedUrls: string[];
  articleMemory: ArticleMemoryItem[];
  topicMemory: TopicStrategyMemoryItem[];
}) {
  return [
    "You are ContentDesk's Research Strategist for Shopify app founders.",
    "Convert the founder's requested article idea into exactly one structured TopicBrief.",
    "Do not draft the article.",
    "Honor the requested article idea directly; narrow or clarify it only enough to make it useful, source-backed, and Shopify-specific.",
    "Each field must support the exact requested article, not a generic content idea.",
    "If the request is a comparison, alternatives, best-tools, versus, or category evaluation article, use strategyType comparison and funnelStage middle or bottom.",
    "If the request is a how-to or operating process, use strategyType workflow.",
    "If the request is educational category framing, use strategyType education.",
    "Make the article useful and honest. Include decision criteria, tradeoffs, and practical merchant context where relevant.",
    "Use Existing Article Memory as a duplicate-avoidance constraint. If similar content exists, make the requested article's angle narrower or more advanced rather than duplicating it.",
    "Use Recent Topic Strategy Memory as a strategic novelty constraint. If the request repeats a recent strategicFingerprint, merchantJob, or messageAngle, keep the founder's request but make the angle narrower, more advanced, or meaningfully different.",
    "strategicFingerprint must be a short lowercase hyphenated fingerprint from the merchantJob plus messageAngle. Use it internally to identify whether this repeats a prior strategic pattern.",
    "strategyEvidence must contain 2-4 short bullets using only current inputs, prefixed with Brand Profile, Research source, Article memory, or Competitor list.",
    "Every sourceLinks entry must be copied exactly from the allowed source URLs. Never invent URLs.",
    "Do not imply access to app reviews, competitor reviews, Ahrefs, Semrush, Google Search Console, or other search metrics unless such a source is actually present in the allowed research sources.",
    "",
    "Founder requested article idea:",
    input.articleIdea,
    "",
    "Brand Profile:",
    JSON.stringify(input.brandProfile, null, 2),
    "",
    "Allowed source URLs:",
    input.allowedUrls.map((url) => `- ${url}`).join("\n"),
    "",
    "Existing Article Memory:",
    formatArticleMemoryForPrompt(input.articleMemory),
    "",
    "Recent Topic Strategy Memory:",
    formatRecentTopicStrategyMemory(input.topicMemory),
    "",
    "Research sources:",
    input.sources.map(formatSourceForPrompt).join("\n\n"),
  ].join("\n");
}

function formatSourceForPrompt(source: ResearchSource, index: number) {
  const content = source.extractedMarkdown || source.excerpt;

  return [
    `Source ${index + 1}`,
    `URL: ${source.url}`,
    `Title: ${source.title || "Untitled"}`,
    `Provider: ${source.provider}`,
    `Query: ${source.query}`,
    `Excerpt: ${content.slice(0, 2000)}`,
  ].join("\n");
}

function constrainTopicSources(topic: TopicBrief, allowedUrls: string[]) {
  const allowed = new Set(allowedUrls);
  const sourceLinks = topic.sourceLinks.filter((url) => allowed.has(url));

  return {
    ...topic,
    sourceLinks: sourceLinks.length > 0 ? sourceLinks.slice(0, 4) : allowedUrls.slice(0, 2),
  };
}

function rankTopics(topics: TopicBrief[]) {
  return [...topics].sort((left, right) => right.score - left.score);
}

function mergeSources(sources: ResearchSource[]) {
  const byUrl = new Map<string, ResearchSource>();

  for (const source of sources) {
    const existing = byUrl.get(source.url);
    if (!existing) {
      byUrl.set(source.url, source);
      continue;
    }

    byUrl.set(source.url, {
      ...existing,
      title: existing.title || source.title,
      excerpt: longest(existing.excerpt, source.excerpt),
      extractedMarkdown: longest(existing.extractedMarkdown, source.extractedMarkdown),
    });
  }

  return [...byUrl.values()];
}

function longest(left = "", right = "") {
  return left.length >= right.length ? left : right;
}
