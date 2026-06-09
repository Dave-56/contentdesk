import { z } from "zod";

const requiredText = z.string().trim().min(1);
const optionalText = z.string().trim().default("");
const textList = z.array(requiredText).default([]);
const textListFromLegacyText = z.preprocess(
  (value) => (typeof value === "string" ? value.split(/[\n,]/) : value),
  textList,
);

export const voiceProfileSchema = z.object({
  name: optionalText,
  description: optionalText,
  toneTraits: textListFromLegacyText,
  writingRules: textListFromLegacyText,
  phrasesToUse: textListFromLegacyText,
  phrasesToAvoid: textListFromLegacyText,
  sampleLines: textListFromLegacyText,
});

export type VoiceProfile = z.infer<typeof voiceProfileSchema>;

export const brandProfileSchema = z.object({
  appName: requiredText,
  targetMerchant: requiredText,
  positioning: requiredText,
  featuresUseCases: z.array(requiredText).min(1),
  competitors: textList,
  brandAliases: textList.optional(),
  categoryCompetitors: textList.optional(),
  substitutes: textList.optional(),
  antiCompetitors: textList.optional(),
  preferredVoice: optionalText,
  voiceProfile: voiceProfileSchema.optional(),
  preferredVisuals: textListFromLegacyText,
  visualsToAvoid: textList,
  forbiddenClaims: textList,
  ctaStyle: requiredText,
  existingBlogDocsUrls: z.array(z.string().url()).default([]),
});

export type BrandProfile = z.infer<typeof brandProfileSchema>;

export const userArticleRequestSchema = z.object({
  idea: requiredText,
  requestedBySlackUserId: optionalText,
  requestedAt: z.string().datetime(),
});

export type UserArticleRequest = z.infer<typeof userArticleRequestSchema>;

export const requiredBrandProfileFields = [
  "appName",
  "targetMerchant",
  "positioning",
  "featuresUseCases",
  "ctaStyle",
] as const satisfies readonly (keyof BrandProfile)[];

export const optionalBrandProfileFields = [
  "competitors",
  "preferredVoice",
  "preferredVisuals",
  "visualsToAvoid",
  "forbiddenClaims",
  "existingBlogDocsUrls",
] as const satisfies readonly (keyof BrandProfile)[];

export type BrandProfileField = keyof BrandProfile;

export function getBrandProfileCompleteness(
  profile: Partial<BrandProfile> | null | undefined,
) {
  const requiredMissing = requiredBrandProfileFields.filter((field) =>
    isMissingProfileValue(profile?.[field]),
  );
  const optionalMissing = optionalBrandProfileFields.filter((field) =>
    isMissingProfileValue(profile?.[field]),
  );

  return {
    isComplete: requiredMissing.length === 0,
    requiredMissing,
    optionalMissing,
  };
}

function isMissingProfileValue(value: unknown) {
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim().length === 0;

  return value === undefined || value === null;
}

export const assetIntentSchema = z.enum([
  "neutral_education",
  "workflow_guide",
  "customer_winning_comparison",
]);

export const brandInclusionFitSchema = z.enum([
  "strong",
  "medium",
  "weak",
  "none",
]);

export const brandInclusionSchema = z.object({
  required: z.boolean().default(false),
  fit: brandInclusionFitSchema.default("none"),
  aliases: textList,
  targetCompetitor: requiredText.optional(),
  comparisonSet: textList,
  fitAngle: optionalText,
  ctaRequired: z.boolean().default(false),
});

export type BrandInclusion = z.infer<typeof brandInclusionSchema>;

export const topicBriefSchema = z.object({
  topic: requiredText,
  workingTitle: requiredText,
  strategicFingerprint: optionalText,
  assetIntent: assetIntentSchema.optional(),
  brandInclusion: brandInclusionSchema.optional(),
  strategyType: z.enum(["education", "workflow", "comparison"]).default("education"),
  funnelStage: z.enum(["top", "middle", "bottom"]).default("top"),
  merchantJob: requiredText.default(
    "Understand the Shopify merchant job this article should help with.",
  ),
  intentType: z.enum([
    "pain_awareness",
    "workflow_solution",
    "comparison_decision",
  ]).optional(),
  messageAngle: requiredText.default(
    "Frame the topic around a practical Shopify merchant problem.",
  ),
  proofAngle: requiredText.default(
    "Use available Brand Profile and research-source context to make the article credible.",
  ),
  strategyEvidence: textList,
  whyThisStrategy: requiredText.default(
    "Selected as a useful topic opportunity for founder approval.",
  ),
  targetMerchantPain: requiredText,
  shopifySpecificAngle: requiredText,
  whyNow: requiredText,
  searchIntent: requiredText,
  contentGap: requiredText,
  suggestedCtaAngle: requiredText,
  sourceLinks: z.array(z.string().url()).min(1),
  score: z.number().min(0).max(100),
}).transform((topic) => ({
  ...topic,
  strategicFingerprint:
    normalizeStrategicFingerprint(topic.strategicFingerprint) ||
    strategicFingerprintFromTopicFields(topic),
  intentType: topic.intentType ?? intentTypeForStrategyType(topic.strategyType),
}));

export type TopicBrief = z.infer<typeof topicBriefSchema>;

export const topicBriefsSchema = z.array(topicBriefSchema).length(3);

export function intentTypeForStrategyType(
  strategyType: "education" | "workflow" | "comparison",
) {
  if (strategyType === "workflow") return "workflow_solution" as const;
  if (strategyType === "comparison") return "comparison_decision" as const;

  return "pain_awareness" as const;
}

export function strategicFingerprintFromTopicFields(input: {
  strategyType: "education" | "workflow" | "comparison";
  merchantJob: string;
  messageAngle: string;
  workingTitle: string;
}) {
  return normalizeStrategicFingerprint(
    [
      input.strategyType,
      input.merchantJob,
      input.messageAngle,
      input.workingTitle,
    ].join(" "),
  ) || "unknown-topic-pattern";
}

export function normalizeStrategicFingerprint(value: string) {
  return value
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export const researchSourceSchema = z.object({
  provider: z.enum(["parallel", "perplexity", "seed"]),
  query: requiredText,
  url: z.string().url(),
  title: optionalText,
  publishedAt: z.string().optional(),
  excerpt: requiredText,
  extractedMarkdown: optionalText,
  fetchedAt: z.string().datetime(),
});

export type ResearchSource = z.infer<typeof researchSourceSchema>;

export const researchSourcesSchema = z.array(researchSourceSchema);

export const articleDraftSchema = z.object({
  topic: topicBriefSchema,
  outline: z.array(
    z.object({
      heading: requiredText,
      purpose: requiredText,
      sourceLinks: z.array(z.string().url()).default([]),
    }),
  ),
  markdown: requiredText,
  titleOptions: z.array(requiredText).min(3),
  metadata: z.object({
    title: requiredText,
    metaDescription: requiredText,
    targetQueries: textListFromLegacyText,
  }),
  faq: z.array(
    z.object({
      question: requiredText,
      answer: requiredText,
    }),
  ),
  cta: requiredText,
  internalLinkSuggestions: z.array(
    z.object({
      anchorText: requiredText,
      targetUrl: z.string().url(),
      reason: requiredText,
    }),
  ),
  socialDrafts: z.array(requiredText).min(1),
  sources: z.array(z.string().url()).min(1),
  sourceNotes: optionalText,
});

export type ArticleDraft = z.infer<typeof articleDraftSchema>;

export const visualRenderModeSchema = z.enum([
  "generated_image",
  "markdown_block",
  "screenshot",
  "none",
]);

export const visualTextBudgetSchema = z.enum([
  "none",
  "short_labels",
  "text_heavy",
]);

export const visualStructureSchema = z.enum([
  "editorial_scene",
  "workflow_diagram",
  "table",
  "checklist",
  "ui_capture",
  "comparison_matrix",
]);

export const visualPlanItemSchema = z.object({
  title: requiredText,
  placement: requiredText,
  visualType: z.enum([
    "hero",
    "inline",
    "diagram",
    "screenshot",
    "comparison",
    "social",
  ]),
  purpose: requiredText,
  altText: requiredText,
  instruction: requiredText,
  markdownPlaceholder: requiredText,
  renderMode: visualRenderModeSchema.default("generated_image"),
  textBudget: visualTextBudgetSchema.default("short_labels"),
  visualStructure: visualStructureSchema.default("workflow_diagram"),
});

export type VisualPlanItem = z.infer<typeof visualPlanItemSchema>;

export const visualPlanSchema = z.array(visualPlanItemSchema).min(1).max(3);

export type VisualPlan = z.infer<typeof visualPlanSchema>;

export const visualAssetSchema = z.object({
  sourcePlaceholder: requiredText,
  title: requiredText,
  visualType: visualPlanItemSchema.shape.visualType,
  status: z.enum(["generated", "skipped", "failed"]),
  assetType: z.enum(["generated_image", "screenshot", "manual"]),
  altText: requiredText,
  caption: optionalText,
  prompt: optionalText,
  provider: optionalText,
  model: optionalText,
  mimeType: optionalText,
  localPath: optionalText,
  publicUrl: optionalText,
  error: optionalText,
  createdAt: z.string().datetime(),
});

export type VisualAsset = z.infer<typeof visualAssetSchema>;

export const visualAssetsSchema = z.array(visualAssetSchema).default([]);

export type VisualAssets = z.infer<typeof visualAssetsSchema>;

export const visualAssetReviewSchema = z.object({
  sourcePlaceholder: requiredText,
  title: requiredText,
  status: z.enum(["passed", "failed", "skipped"]),
  summary: requiredText,
  blockers: textList,
  recommendation: z.enum([
    "use",
    "regenerate",
    "replace_with_markdown",
    "manual_review",
    "not_reviewed",
  ]),
  captionSuggestion: optionalText,
  createdAt: z.string().datetime(),
});

export type VisualAssetReview = z.infer<typeof visualAssetReviewSchema>;

export const visualAssetReviewsSchema = z.array(visualAssetReviewSchema).default([]);

export const qaIssueAreaSchema = z.enum([
  "article",
  "visual_plan",
  "sources",
  "metadata",
  "brand_positioning",
]);

const qaIssueBaseSchema = z.object({
  area: qaIssueAreaSchema,
  finding: requiredText,
  evidence: requiredText,
  instruction: requiredText,
});

export const qaBlockerIssueSchema = qaIssueBaseSchema.extend({
  severity: z.literal("blocker"),
});

export const qaNiceToHaveIssueSchema = qaIssueBaseSchema.extend({
  severity: z.literal("nice_to_have"),
});

export const qaIssueSchema = z.discriminatedUnion("severity", [
  qaBlockerIssueSchema,
  qaNiceToHaveIssueSchema,
]);

export type QaIssue = z.infer<typeof qaIssueSchema>;
export type QaBlockerIssue = z.infer<typeof qaBlockerIssueSchema>;
export type QaNiceToHaveIssue = z.infer<typeof qaNiceToHaveIssueSchema>;

export const qaRubricScoresSchema = z.object({
  shopifySpecificity: z.number().min(0).max(5),
  merchantPain: z.number().min(0).max(5),
  actionability: z.number().min(0).max(5),
  claimSupport: z.number().min(0).max(5),
  genericFillerAvoidance: z.number().min(0).max(5),
  thinkingGapResolution: z.number().min(0).max(5),
  appPositioning: z.number().min(0).max(5),
  founderPublishConfidence: z.number().min(0).max(5),
  visualUsefulness: z.number().min(0).max(5),
});

export type QaRubricScores = z.infer<typeof qaRubricScoresSchema>;

export const qaReportSchema = z.object({
  status: z.enum(["pass", "needs_revision"]),
  usedFallback: z.boolean().default(false),
  summary: requiredText,
  blockers: z.array(qaBlockerIssueSchema).default([]),
  niceToHaves: z.array(qaNiceToHaveIssueSchema).default([]),
  rubricScores: qaRubricScoresSchema,
  revisionInstructions: z.object({
    writer: textList,
    visualProducer: textList,
  }),
}).superRefine((report, context) => {
  if (report.status === "pass" && report.blockers.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "QAReport cannot pass while blockers are present.",
    });
  }

  if (report.status === "needs_revision" && report.blockers.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["blockers"],
      message: "QAReport needs at least one blocker when status is needs_revision.",
    });
  }
});

export type QAReport = z.infer<typeof qaReportSchema>;

export const revisionTaskSchema = z.object({
  id: requiredText,
  area: qaIssueAreaSchema,
  blockerFinding: requiredText,
  instruction: requiredText,
  acceptanceCriteria: z.array(requiredText).min(1),
});

export type RevisionTask = z.infer<typeof revisionTaskSchema>;

export const revisionTasksSchema = z.array(revisionTaskSchema).default([]);

export const revisionTaskResultSchema = z.object({
  taskId: requiredText,
  status: z.enum(["completed", "partial", "not_completed"]),
  evidence: requiredText,
  remainingConcern: optionalText,
});

export type RevisionTaskResult = z.infer<typeof revisionTaskResultSchema>;

export const revisionTaskResultsSchema = z.array(revisionTaskResultSchema).default([]);

const dateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Expected YYYY-MM-DD date.",
});

export const recommendationEvidenceSchema = z.object({
  label: requiredText,
  summary: requiredText,
  url: z.string().url().optional(),
});

export type RecommendationEvidence = z.infer<typeof recommendationEvidenceSchema>;

export const recommendationTargetPromptSchema = z.object({
  prompt: requiredText,
  intent: optionalText,
});

export type RecommendationTargetPrompt = z.infer<
  typeof recommendationTargetPromptSchema
>;

export const recommendationAssetSchema = z.object({
  assetType: z.enum([
    "page",
    "FAQ",
    "guide",
    "comparison",
    "alternatives",
    "use-case page",
    "content refresh",
    "technical fix",
    "reddit reply",
  ]),
  title: requiredText,
  reason: requiredText,
  whyThisAssetOverOthers: requiredText,
  suggestedStructure: z.array(requiredText).min(3),
});

export type RecommendationAsset = z.infer<typeof recommendationAssetSchema>;

export const recommendationRecheckPlanSchema = z.object({
  recheckOn: dateOnlyString,
  prompts: z.array(requiredText).min(1),
  expectedSignal: requiredText,
  ifNoMovement: requiredText,
});

export type RecommendationRecheckPlan = z.infer<
  typeof recommendationRecheckPlanSchema
>;

export const recommendationCardSchema = z.object({
  source: z.enum(["topic_brief", "reddit_teardown", "manual"]).default("manual"),
  audience: requiredText,
  finding: requiredText,
  whyItMatters: requiredText,
  evidence: z.array(recommendationEvidenceSchema).min(1),
  recommendedAsset: recommendationAssetSchema,
  targetPrompts: z.array(recommendationTargetPromptSchema).min(1),
  crawlabilityNotes: textList,
  risks: textList,
  recheckPlan: recommendationRecheckPlanSchema,
  createdAt: z.string().datetime(),
});

export type RecommendationCard = z.infer<typeof recommendationCardSchema>;

export const linkedInPostStatusSchema = z.enum([
  "draft",
  "approved",
  "posted",
  "skipped",
]);

export const linkedInPostFormatSchema = z.enum(["text"]);

export const linkedInPostSchema = z.object({
  createdAt: z.string().datetime(),
  channel: z.literal("company_page").default("company_page"),
  format: linkedInPostFormatSchema.default("text"),
  status: linkedInPostStatusSchema.default("draft"),
  hook: requiredText,
  body: requiredText,
  cta: optionalText,
  visualBrief: optionalText,
  sourceArticleTitle: requiredText,
  sourceArtifactId: requiredText,
  sourceUrl: z.string().url().optional(),
  targetPrompts: z.array(recommendationTargetPromptSchema).default([]),
  publishUrl: optionalText,
  publishedAt: z.string().datetime().nullable().default(null),
  outcomeNotes: optionalText,
});

export type LinkedInPost = z.infer<typeof linkedInPostSchema>;

export const publishKitSchema = z.object({
  topic: topicBriefSchema,
  markdown: z.string(),
  titleOptions: z.array(z.string()).default([]),
  metadata: z.object({
    title: z.string(),
    metaDescription: z.string(),
    targetQueries: z.array(z.string()).default([]),
  }),
  faq: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),
  cta: z.string(),
  internalLinkSuggestions: z.array(
    z.object({
      anchorText: z.string(),
      targetUrl: z.string().url(),
      reason: z.string(),
    }),
  ).default([]),
  visualPlan: z.array(visualPlanItemSchema).max(3),
  leadVisual: visualPlanItemSchema,
  leadVisualAsset: visualAssetSchema.nullable().default(null),
  leadVisualReadiness: z.enum(["approved", "missing", "failed"]).default("missing"),
  visualAssets: visualAssetsSchema,
  qaSummary: z.string().default("No Editor QA summary is available for this publish kit."),
  blockers: z.array(qaBlockerIssueSchema).default([]),
  nonBlockingNotes: z.array(qaNiceToHaveIssueSchema).default([]),
  socialDrafts: z.array(z.string()),
  linkedInPosts: z.array(linkedInPostSchema).default([]),
  sources: z.array(z.string().url()),
  codexHandoffPrompt: z.string(),
});

export type PublishKit = z.infer<typeof publishKitSchema>;

export const slackActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve_topic"),
    cycleId: z.string(),
    artifactId: z.string(),
    topicIndex: z.number().int().min(0),
  }),
  z.object({
    action: z.literal("preview_topic"),
    cycleId: z.string(),
    artifactId: z.string(),
    topicIndex: z.number().int().min(0),
  }),
  z.object({
    action: z.literal("approve_publish_kit"),
    cycleId: z.string(),
    artifactId: z.string(),
  }),
  z.object({
    action: z.literal("view_publish_kit"),
    cycleId: z.string(),
    artifactId: z.string(),
  }),
  z.object({
    action: z.literal("edit_brand_profile"),
  }),
  z.object({
    action: z.literal("approve_visibility_recommendation"),
    cycleId: z.string(),
    artifactId: z.string(),
    runId: z.string(),
    recommendationId: z.string(),
    hash: z.string(),
    taskType: z.string(),
  }),
  z.object({
    action: z.literal("mark_reddit_replied"),
    opportunityId: z.string(),
  }),
  z.object({
    action: z.literal("skip_reddit_opportunity"),
    opportunityId: z.string(),
  }),
]);

export type SlackAction = z.infer<typeof slackActionSchema>;
