import { generateText, Output } from "ai";
import { formatBrandVoiceForPrompt } from "@/lib/brand-voice";
import { getEnv } from "@/lib/env";
import {
  aiArticleDraftSchema,
  aiRevisedArticleDraftSchema,
  type AiArticleDraft,
} from "@/lib/ai-schemas";
import {
  articleDraftSchema,
  revisionTaskResultsSchema,
  type ArticleDraft,
  type BrandProfile,
  type QAReport,
  type ResearchSource,
  type RevisionTask,
  type RevisionTaskResult,
  type TopicBrief,
} from "@/lib/schemas";

export type SeoWriterResult = {
  draft: ArticleDraft;
  usedFallback: boolean;
  revisionTaskResults: RevisionTaskResult[];
  fallbackError?: SeoWriterFallbackError;
};

export type SeoWriterFallbackError = {
  phase: "draft" | "revision";
  errorName: string;
  errorMessage: string;
  errorStack: string;
  validationIssues: string[];
  rawOutputPreview: string;
};

export async function generateArticleDraft(input: {
  topic: TopicBrief;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  revisionInstructions?: string[];
  revisionTasks?: RevisionTask[];
  previousDraft?: ArticleDraft;
  qaReport?: QAReport;
}): Promise<SeoWriterResult> {
  if (!isAiGatewayConfigured()) {
    const fallbackError = fallbackErrorDetails({
      input,
      error: new Error(
        "AI generation is not configured. Add AI_GATEWAY_API_KEY or Vercel OIDC credentials, then restart the Slack app.",
      ),
    });

    return {
      draft: fallbackArticleDraft(input),
      usedFallback: true,
      revisionTaskResults: fallbackRevisionTaskResults(input.revisionTasks),
      fallbackError,
    };
  }

  try {
    const result = await generateAiArticleDraft(input);

    return {
      draft: result.draft,
      usedFallback: false,
      revisionTaskResults: result.revisionTaskResults,
    };
  } catch (error) {
    console.warn("[seo writer fallback]", errorMessage(error));
    const fallbackError = fallbackErrorDetails({ input, error });

    return {
      draft: fallbackArticleDraft(input),
      usedFallback: true,
      revisionTaskResults: fallbackRevisionTaskResults(input.revisionTasks),
      fallbackError,
    };
  }
}

async function generateAiArticleDraft(input: {
  topic: TopicBrief;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  revisionInstructions?: string[];
  revisionTasks?: RevisionTask[];
  previousDraft?: ArticleDraft;
  qaReport?: QAReport;
}) {
  const { CONTENTDESK_AI_MODEL } = getEnv();
  const model = CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4";
  const isRevision = Boolean(input.previousDraft);

  if (isRevision) {
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: aiRevisedArticleDraftSchema,
      }),
      prompt: writerPrompt(input),
    });
    const revisedOutput = aiRevisedArticleDraftSchema.parse(output);

    return {
      draft: articleDraftSchema.parse(constrainArticleDraft(revisedOutput.draft, input)),
      revisionTaskResults: revisionTaskResultsSchema.parse(
        revisedOutput.revisionTaskResults,
      ),
    };
  }

  const { output } = await generateText({
    model,
    output: Output.object({
      schema: aiArticleDraftSchema,
    }),
    prompt: writerPrompt(input),
  });

  return {
    draft: articleDraftSchema.parse(constrainArticleDraft(output, input)),
    revisionTaskResults: [],
  };
}

function writerPrompt(input: {
  topic: TopicBrief;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  revisionInstructions?: string[];
  revisionTasks?: RevisionTask[];
  previousDraft?: ArticleDraft;
  qaReport?: QAReport;
}) {
  const allowedUrls = input.sources.map((source) => source.url);
  const isRevision = Boolean(input.previousDraft);

  return [
    "You are ContentDesk's SEO Writer for Shopify app founders.",
    isRevision
      ? "Revise the previous ArticleDraft using the QA checklist. Return one object with a complete replacement draft and revisionTaskResults."
      : "Generate one complete ArticleDraft object for the approved TopicBrief.",
    "Write useful, specific, publishable Markdown for a Shopify app audience.",
    "Use the Brand Profile naturally. Do not make the article sound like an advertisement.",
    "Follow the brand voice contract for phrasing, examples, CTA language, FAQ wording, and socialDrafts.",
    "Respect forbidden claims exactly. Avoid unsupported claims, fake statistics, and generic SEO filler.",
    "Do not mention ContentDesk unless the approved topic is explicitly about ContentDesk.",
    "Do not put editor notes, QA notes, title-option scaffolding, social-draft labels, implementation notes, image-generation notes, or visual placeholders in the article Markdown.",
    "Use merchantJob, messageAngle, proofAngle, and strategyEvidence from the approved TopicBrief as the article's strategic spine.",
    "Open with the answer: after the H1, the first body paragraph must directly answer the topic in 2-4 useful sentences before adding background context.",
    "Metadata must include targetQueries: 3-5 concise search queries that match the approved topic, search intent, and Shopify merchant pain. Use phrases a Shopify merchant might type, not subtitles, internal positioning, or full sentences.",
    "Every source URL must be copied exactly from the allowed source URLs. Never invent source URLs.",
    "Internal link suggestions may only use URLs from the Brand Profile existingBlogDocsUrls list.",
    "The Markdown should include a single H1, practical H2 sections, and source-backed advice.",
    formatBrandInclusionContract(input.topic),
    "",
    "Brand voice contract:",
    formatBrandVoiceForPrompt(input.brandProfile),
    isRevision
      ? [
          "Revision mode requirements:",
          "- Treat every RevisionTask as a required checklist item.",
          "- Fix the Markdown, outline, metadata, FAQ, CTA, source list, and sourceNotes anywhere the QA report requires it.",
          "- Do not leave stale sourceNotes that still claim unsupported evidence.",
          "- Make the outline match the final Markdown H2 structure exactly.",
          "- Prefer narrowing or removing a claim over defending a claim with vague attribution.",
          "- Return one revisionTaskResult for every RevisionTask id.",
          "- Mark a task completed only when the replacement ArticleDraft satisfies every acceptance criterion.",
          "- Use partial or not_completed when something remains unresolved, and explain the remaining concern.",
        ].join("\n")
      : "",
    "",
    "Brand Profile:",
    JSON.stringify(input.brandProfile, null, 2),
    "",
    "Approved TopicBrief:",
    JSON.stringify(input.topic, null, 2),
    "",
    input.previousDraft
        ? [
          "Revision checklist:",
          formatRevisionTasks(input.revisionTasks ?? []),
          "",
          "Additional revision instructions:",
          (input.revisionInstructions ?? []).map((item) => `- ${item}`).join("\n") || "- None",
          "",
          "Previous QA report:",
          JSON.stringify(input.qaReport ?? null, null, 2),
          "",
          "Previous ArticleDraft:",
          formatPreviousDraftForRevision(input.previousDraft),
          "",
        ].join("\n")
      : "",
    "",
    "Allowed source URLs:",
    allowedUrls.map((url) => `- ${url}`).join("\n"),
    "",
    "Research sources:",
    input.sources.map(formatSourceForPrompt).join("\n\n"),
  ].join("\n");
}

function formatBrandInclusionContract(topic: TopicBrief) {
  const inclusion = topic.brandInclusion;
  if (!inclusion?.required) {
    return "Brand inclusion contract: No required customer-comparison placement is attached to this TopicBrief.";
  }

  return [
    "Brand inclusion contract:",
    `- Asset intent: ${topic.assetIntent ?? "customer_winning_comparison"}.`,
    `- Required brand aliases: ${inclusion.aliases.join(", ")}.`,
    `- Brand fit: ${inclusion.fit}.`,
    inclusion.targetCompetitor
      ? `- Target competitor: ${inclusion.targetCompetitor}.`
      : "",
    inclusion.comparisonSet.length
      ? `- Comparison set: ${inclusion.comparisonSet.join(", ")}.`
      : "",
    inclusion.fitAngle
      ? `- Fit angle to cover honestly: ${inclusion.fitAngle}.`
      : "",
    "- For comparison, alternatives, versus, and best-tools articles, include the brand as an evaluated option unless this contract says fit is weak or none.",
    "- Add a clear section such as `Where <brand> fits` or an equivalent tradeoff section that names the brand and explains who should consider it.",
    inclusion.ctaRequired
      ? "- The CTA must name the brand and stay practical, low-pressure, and evidence-safe."
      : "",
    "- Do not force fake superiority. Compare honestly using fit, workflow, tradeoffs, and source-backed claims.",
  ].filter(Boolean).join("\n");
}

function formatRevisionTasks(tasks: RevisionTask[]) {
  if (tasks.length === 0) return "- None";

  return tasks
    .map((task) =>
      [
        `- ${task.id} (${task.area})`,
        `  Finding: ${task.blockerFinding}`,
        `  Required fix: ${task.instruction}`,
        "  Acceptance criteria:",
        ...task.acceptanceCriteria.map((criterion) => `  - ${criterion}`),
      ].join("\n"),
    )
    .join("\n\n");
}

export function formatPreviousDraftForRevision(draft: ArticleDraft) {
  return [
    "Metadata:",
    JSON.stringify(draft.metadata, null, 2),
    "",
    "CTA:",
    draft.cta,
    "",
    "Source notes:",
    draft.sourceNotes || "- None",
    "",
    "FAQ:",
    draft.faq
      .map((item) => `- Q: ${item.question}\n  A: ${item.answer}`)
      .join("\n") || "- None",
    "",
    "Internal link suggestions:",
    draft.internalLinkSuggestions
      .map((link) => `- ${link.anchorText}: ${link.targetUrl} (${link.reason})`)
      .join("\n") || "- None",
    "",
    "Outline:",
    JSON.stringify(draft.outline, null, 2),
    "",
    "Markdown:",
    draft.markdown,
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
    `Excerpt: ${content.slice(0, 3200)}`,
  ].join("\n");
}

function constrainArticleDraft(
  draft: AiArticleDraft,
  input: {
    topic: TopicBrief;
    brandProfile: BrandProfile;
    sources: ResearchSource[];
  },
) {
  const allowedUrls = input.sources.map((source) => source.url);
  const allowedSourceUrls = new Set(allowedUrls);
  const allowedInternalUrls = new Set(input.brandProfile.existingBlogDocsUrls);
  const sourceFallback = input.topic.sourceLinks.filter((url) =>
    allowedSourceUrls.has(url),
  );
  const sources = constrainUrls(draft.sources, allowedSourceUrls);

  return {
    ...draft,
    topic: input.topic,
    outline: draft.outline.map((item) => ({
      ...item,
      sourceLinks: constrainUrls(item.sourceLinks, allowedSourceUrls),
    })),
    internalLinkSuggestions: draft.internalLinkSuggestions.filter((link) =>
      allowedInternalUrls.has(link.targetUrl),
    ),
    sources:
      sources.length > 0
        ? sources
        : sourceFallback.length > 0
          ? sourceFallback
          : allowedUrls.slice(0, 2),
  };
}

function constrainUrls(urls: string[], allowedUrls: Set<string>) {
  return urls.filter((url) => allowedUrls.has(url));
}

function fallbackArticleDraft(input: {
  topic: TopicBrief;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  revisionInstructions?: string[];
  revisionTasks?: RevisionTask[];
  previousDraft?: ArticleDraft;
  qaReport?: QAReport;
}): ArticleDraft {
  if (input.previousDraft) {
    return articleDraftSchema.parse({
      ...input.previousDraft,
      sourceNotes: [
        input.previousDraft.sourceNotes,
        "Fallback revision pass could not rewrite the draft automatically.",
        input.revisionInstructions?.length
          ? `Outstanding QA instructions: ${input.revisionInstructions.join(" ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  const profile = input.brandProfile;
  const topic = input.topic;
  const sources = topic.sourceLinks.filter((url) =>
    input.sources.some((source) => source.url === url),
  );
  const selectedSources = sources.length > 0 ? sources : input.sources.slice(0, 2).map((source) => source.url);
  const title = topic.workingTitle;
  const markdown = `# ${title}

Shopify app content works best when it starts with a real merchant workflow, not a generic ecommerce angle. For ${profile.targetMerchant}, this topic matters because ${topic.targetMerchantPain}

## The merchant problem

${topic.targetMerchantPain}

This draft should stay grounded in the approved research sources and in ${profile.appName}'s positioning: ${profile.positioning}

## Shopify-specific angle

${topic.shopifySpecificAngle}

For Shopify merchants, the useful version of this article should connect the advice to store operations, app setup, merchant staff workflows, and the actual job the app helps with.

## Practical workflow

1. Start with the merchant pain from support, onboarding, or product usage.
2. Map that pain to a Shopify-specific workflow.
3. Explain what the merchant should check or change.
4. Position ${profile.appName} only where it naturally helps.
5. End with a CTA that matches this brand style: ${profile.ctaStyle}

## Content gap

${topic.contentGap}

## Next step

${topic.suggestedCtaAngle}`;

  return articleDraftSchema.parse({
    topic,
    outline: [
      {
        heading: "The merchant problem",
        purpose: "Anchor the article in the approved merchant pain.",
        sourceLinks: selectedSources.slice(0, 2),
      },
      {
        heading: "Shopify-specific angle",
        purpose: "Tie the advice to Shopify app and merchant workflows.",
        sourceLinks: selectedSources.slice(0, 2),
      },
      {
        heading: "Practical workflow",
        purpose: "Give the reader actionable steps they can use.",
        sourceLinks: selectedSources.slice(0, 2),
      },
    ],
    markdown,
    titleOptions: [
      title,
      `${profile.appName}: ${topic.topic}`,
      `A Shopify-specific guide to ${topic.topic}`,
    ],
    metadata: {
      title,
      metaDescription: truncateMeta(
        `${topic.targetMerchantPain} A practical Shopify-specific guide for ${profile.targetMerchant}.`,
      ),
      targetQueries: fallbackTargetQueries(topic),
    },
    faq: [
      {
        question: `Who is this guide for?`,
        answer: `It is for ${profile.targetMerchant} evaluating how to handle ${topic.topic} in a Shopify-specific workflow.`,
      },
      {
        question: `How should ${profile.appName} be positioned?`,
        answer: `Position ${profile.appName} through the approved CTA angle and only where it naturally helps the reader act on the advice.`,
      },
    ],
    cta: topic.suggestedCtaAngle,
    internalLinkSuggestions: profile.existingBlogDocsUrls.slice(0, 3).map((url) => ({
      anchorText: `${profile.appName} resource`,
      targetUrl: url,
      reason: "Existing Brand Profile URL that may support this article.",
    })),
    socialDrafts: [
      `Shopify app content lands better when it starts with a real merchant pain. This topic focuses on ${topic.topic}.`,
      `${profile.targetMerchant} do not need generic ecommerce advice. They need Shopify-specific guidance for ${topic.topic}.`,
    ],
    sources: selectedSources,
    sourceNotes:
      "Fallback draft generated because AI writer output was unavailable. Review before publishing.",
  });
}

function fallbackTargetQueries(topic: TopicBrief) {
  return uniqueStrings([
    queryText(topic.topic),
    shopifyQuery(topic.topic),
    queryText(topic.shopifySpecificAngle),
    shopifyQuery(topic.targetMerchantPain),
    shopifyQuery(topic.contentGap),
  ])
    .filter(isSearchQueryLike)
    .slice(0, 5);
}

function queryText(value: string) {
  return value
    .replace(/[?:!]+/g, "")
    .replace(/\b(how to|how|guide to|a guide to|the guide to)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function shopifyQuery(value: string) {
  const query = queryText(value);
  if (!query) return "";
  if (/\bshopify\b/i.test(query)) return query;

  return `shopify ${query}`;
}

function isSearchQueryLike(value: string) {
  if (!value) return false;
  if (value.length < 6) return false;
  if (value.split(/\s+/).length > 9) return false;

  return !/(commercial investigation|informational|transactional|navigational|internal framing|content gap|merchant pain|why now|practical guide)$/i.test(value);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }

  return output;
}

function fallbackRevisionTaskResults(
  revisionTasks: RevisionTask[] | undefined,
): RevisionTaskResult[] {
  return revisionTaskResultsSchema.parse(
    (revisionTasks ?? []).map((task) => ({
      taskId: task.id,
      status: "not_completed",
      evidence: "Fallback writer could not complete structured revision tasks.",
      remainingConcern: task.instruction,
    })),
  );
}

function fallbackErrorDetails(input: {
  input: {
    previousDraft?: ArticleDraft;
  };
  error: unknown;
}): SeoWriterFallbackError {
  const errorRecord = objectRecord(input.error);

  return {
    phase: input.input.previousDraft ? "revision" : "draft",
    errorName:
      input.error instanceof Error
        ? input.error.name
        : typeof errorRecord?.name === "string"
          ? errorRecord.name
          : "UnknownError",
    errorMessage: errorMessage(input.error),
    errorStack: input.error instanceof Error ? input.error.stack ?? "" : "",
    validationIssues: validationIssues(input.error),
    rawOutputPreview: rawOutputPreview(input.error),
  };
}

function validationIssues(error: unknown) {
  const record = objectRecord(error);
  const issues = record?.issues ?? record?.errors;

  if (!Array.isArray(issues)) return [];

  return issues.slice(0, 10).map((issue) => {
    if (typeof issue === "string") return issue;

    return JSON.stringify(issue).slice(0, 600);
  });
}

function rawOutputPreview(error: unknown) {
  const record = objectRecord(error);
  const candidate =
    record?.value ??
    record?.text ??
    record?.responseBody ??
    record?.body ??
    record?.output;

  if (candidate === undefined) return "";
  if (typeof candidate === "string") return candidate.slice(0, 4000);

  try {
    return JSON.stringify(candidate).slice(0, 4000);
  } catch {
    return String(candidate).slice(0, 4000);
  }
}

function objectRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function truncateMeta(value: string) {
  return value.length <= 155 ? value : `${value.slice(0, 152).trimEnd()}...`;
}

function isAiGatewayConfigured() {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
