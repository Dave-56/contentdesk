import { z } from "zod";
import {
  articleDraftSchema,
  assetIntentSchema,
  brandInclusionSchema,
  qaBlockerIssueSchema,
  qaNiceToHaveIssueSchema,
  qaRubricScoresSchema,
  recommendationCardSchema,
  visualAssetReviewSchema,
  visualRenderModeSchema,
  visualStructureSchema,
  visualTextBudgetSchema,
} from "@/lib/schemas";

const aiText = z.string().trim().min(1);
const aiUrlText = z.string().trim().min(1);

const aiStrategyTypeSchema = z.enum(["education", "workflow", "comparison"]);

export const aiTopicBriefSchema = z.object({
  topic: aiText,
  workingTitle: aiText,
  strategicFingerprint: aiText,
  assetIntent: assetIntentSchema.optional(),
  brandInclusion: brandInclusionSchema.optional(),
  strategyType: aiStrategyTypeSchema,
  funnelStage: z.enum(["top", "middle", "bottom"]),
  merchantJob: aiText,
  intentType: z.enum([
    "pain_awareness",
    "workflow_solution",
    "comparison_decision",
  ]),
  messageAngle: aiText,
  proofAngle: aiText,
  strategyEvidence: z.array(aiText).min(2).max(4),
  whyThisStrategy: aiText,
  targetMerchantPain: aiText,
  shopifySpecificAngle: aiText,
  whyNow: aiText,
  searchIntent: aiText,
  contentGap: aiText,
  suggestedCtaAngle: aiText,
  sourceLinks: z.array(aiUrlText).min(1),
  score: z.number().min(0).max(100),
});

export const aiArticleDraftSchema = articleDraftSchema
  .omit({
    topic: true,
    outline: true,
    metadata: true,
    internalLinkSuggestions: true,
    sources: true,
    sourceNotes: true,
  })
  .extend({
    topic: aiTopicBriefSchema,
    outline: z.array(
      z.object({
        heading: aiText,
        purpose: aiText,
        sourceLinks: z.array(aiUrlText),
      }),
    ),
    metadata: z.object({
      title: aiText,
      metaDescription: aiText,
      targetQueries: z.array(aiText).min(1),
    }),
    internalLinkSuggestions: z.array(
      z.object({
        anchorText: aiText,
        targetUrl: aiUrlText,
        reason: aiText,
      }),
    ),
    sources: z.array(aiUrlText).min(1),
    sourceNotes: z.string().trim(),
  });

export type AiArticleDraft = z.infer<typeof aiArticleDraftSchema>;

export const aiLinkedInPostSchema = z.object({
  hook: aiText,
  body: aiText,
  cta: z.string().trim(),
  visualBrief: z.string().trim(),
});

export type AiLinkedInPost = z.infer<typeof aiLinkedInPostSchema>;

export const aiRevisionTaskResultSchema = z.object({
  taskId: aiText,
  status: z.enum(["completed", "partial", "not_completed"]),
  evidence: aiText,
  remainingConcern: z.string().trim(),
});

export const aiRevisedArticleDraftSchema = z.object({
  draft: aiArticleDraftSchema,
  revisionTaskResults: z.array(aiRevisionTaskResultSchema),
});

export type AiRevisedArticleDraft = z.infer<typeof aiRevisedArticleDraftSchema>;

export const aiVisualPlanItemSchema = z.object({
  title: aiText,
  placement: aiText,
  visualType: z.enum([
    "hero",
    "inline",
    "diagram",
    "screenshot",
    "comparison",
    "social",
  ]),
  purpose: aiText,
  altText: aiText,
  instruction: aiText,
  markdownPlaceholder: aiText,
  renderMode: visualRenderModeSchema,
  textBudget: visualTextBudgetSchema,
  visualStructure: visualStructureSchema,
});

export const aiQaReportSchema = z.object({
  status: z.enum(["pass", "needs_revision"]),
  summary: aiText,
  blockers: z.array(qaBlockerIssueSchema),
  niceToHaves: z.array(qaNiceToHaveIssueSchema),
  rubricScores: qaRubricScoresSchema,
  revisionInstructions: z.object({
    writer: z.array(aiText),
    visualProducer: z.array(aiText),
  }),
});

export type AiQaReport = z.infer<typeof aiQaReportSchema>;

export const aiRecommendationCardSchema = recommendationCardSchema
  .omit({
    source: true,
    createdAt: true,
  })
  .extend({
    evidence: z.array(
      recommendationCardSchema.shape.evidence.element.extend({
        url: aiUrlText.optional(),
      }),
    ).min(1),
  });

export type AiRecommendationCard = z.infer<typeof aiRecommendationCardSchema>;

export const aiVisualAssetReviewSchema = z.object({
  status: visualAssetReviewSchema.shape.status,
  summary: aiText,
  blockers: z.array(aiText),
  recommendation: visualAssetReviewSchema.shape.recommendation,
  captionSuggestion: z.string().trim(),
});
