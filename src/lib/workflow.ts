import {
  createApproval,
  createAgentRun,
  createArtifact,
  createContentCycle,
  getArtifact,
  getLatestArtifactForCycle,
  getOrCreateOrganization,
  getPrimaryBrandForOrganization,
  markCycleTopicApproved,
  resetCycleToTopicApproval,
  setApprovedTopicIfAwaiting,
  updateCycleStatus,
  updateCycleThread,
} from "@/lib/repository";
import {
  getBrandProfileCompleteness,
  publishKitSchema,
  userArticleRequestSchema,
  type ArticleDraft,
  type BrandProfile,
  type PublishKit,
  type QAReport,
  type ResearchSource,
  type RevisionTask,
  type TopicBrief,
  type UserArticleRequest,
  type VisualAsset,
  type VisualAssetReview,
  type VisualPlan,
  type VisualPlanItem,
} from "@/lib/schemas";
import {
  generateTopicBriefForArticleRequest,
  generateTopicBriefs,
  ResearchStrategistError,
} from "@/lib/research/strategist";
import { buildPublishKitFromArticleDraft } from "@/lib/publish-kit";
import {
  codexHandoffBlocks,
  postManagerMessage,
  publishKitBlocks,
  topicPickerBlocks,
  visibilityRecommendationBlocks,
} from "@/lib/slack";
import {
  getArticleMemoryForResearch,
  recordPublishKitHandoff,
  refreshArticleMemoryFromBlog,
} from "@/lib/article-memory";
import { getRecentTopicStrategyMemory } from "@/lib/topic-memory";
import { generateLinkedInPost } from "@/lib/linkedin/post-generator";
import { generateArticleDraft } from "@/lib/writer/seo-writer";
import type { SeoWriterResult } from "@/lib/writer/seo-writer";
import { generateVisualPlan } from "@/lib/visual/producer";
import { reviewVisualAssets } from "@/lib/visual/asset-qa";
import { generateVisualAssets } from "@/lib/visual/image-generator";
import {
  generateQaReport,
  qaPassed,
  qaRevisionInstructions,
  visualRevisionInstructions,
  withCitationBlockers,
} from "@/lib/editor/seo-qa";
import { deslopArticleDraft } from "@/lib/editor/deslop";
import { checkCitations } from "@/lib/editor/citation-check";
import {
  buildResearchSourcesFromVisibilityRecommendation,
  buildTopicBriefFromVisibilityRecommendation,
  getLatestVisibilityRecommendationForSlack,
  isVisibilityRecommendationStale,
  reloadVisibilityRecommendationForSlack,
  visibilityRecommendationForSlackSchema,
  type VisibilityRecommendationForSlack,
} from "@/lib/visibility/slack-adapter";

const MAX_QA_REVISION_PASSES = 2;

export type ContentCyclePayload = {
  teamId: string;
  teamName?: string;
  channelId: string;
  userId: string;
  commandText?: string;
};

export async function runVisibilityRecommendationKickoff(payload: ContentCyclePayload) {
  const organization = await getOrCreateOrganization({
    slackTeamId: payload.teamId,
    name: payload.teamName,
  });
  const brand = await getPrimaryBrandForOrganization(organization.id);
  const completeness = getBrandProfileCompleteness(brand?.profile);

  if (!brand || !completeness.isComplete) {
    await postManagerMessage({
      channelId: payload.channelId,
      text: `Before I can show visibility recommendations, I need the Brand Profile. Missing: ${completeness.requiredMissing.join(", ")}.`,
    });

    return {
      cycleId: null,
      recommendationArtifactId: null,
      missingProfileFields: completeness.requiredMissing,
    };
  }

  const recommendation = await getLatestVisibilityRecommendationForSlack({
    brandProfile: brand.profile,
  });

  if (!recommendation) {
    await postManagerMessage({
      channelId: payload.channelId,
      text: [
        "No visibility recommendation is ready yet.",
        "Run the visibility workflow, then try `/contentdesk` again:",
        "`npm run visibility:profile -- --url <website> --out data/<brand>/visibility`",
        "`npm run visibility:run -- --recommend`",
      ].join("\n"),
    });

    return {
      cycleId: null,
      recommendationArtifactId: null,
      noRecommendation: true,
    };
  }

  const cycle = await createContentCycle({
    organizationId: organization.id,
    brandId: brand.id,
    slackChannelId: payload.channelId,
  });

  await createArtifact({
    organizationId: organization.id,
    brandId: brand.id,
    cycleId: cycle.id,
    type: "BrandProfile",
    status: "active",
    payload: brand.profile,
    createdByAgent: "Manager Agent",
  });

  const recommendationArtifact = await createArtifact({
    organizationId: organization.id,
    brandId: brand.id,
    cycleId: cycle.id,
    type: "VisibilityRecommendation",
    status: recommendation.productionSupported
      ? "awaiting_approval"
      : "unsupported_task_type",
    payload: recommendation,
    createdByAgent: "Visibility Layer",
  });

  const message = await postManagerMessage({
    channelId: payload.channelId,
    text: `ContentDesk found a visibility-backed recommendation: ${recommendation.title}`,
    blocks: visibilityRecommendationBlocks({
      cycleId: cycle.id,
      artifactId: recommendationArtifact.id,
      recommendation,
    }),
  });
  if (message.ts) await updateCycleThread(cycle.id, message.ts);

  return {
    cycleId: cycle.id,
    recommendationArtifactId: recommendationArtifact.id,
    recommendation,
  };
}

export async function runContentCycleKickoff(payload: ContentCyclePayload) {
  const organization = await getOrCreateOrganization({
    slackTeamId: payload.teamId,
    name: payload.teamName,
  });
  const brand = await getPrimaryBrandForOrganization(organization.id);
  const completeness = getBrandProfileCompleteness(brand?.profile);

  if (!brand || !completeness.isComplete) {
    await postManagerMessage({
      channelId: payload.channelId,
      text: `Before I can suggest topics, I need the Brand Profile. Missing: ${completeness.requiredMissing.join(", ")}.`,
    });

    return {
      cycleId: null,
      topicArtifactId: null,
      missingProfileFields: completeness.requiredMissing,
    };
  }

  const cycle = await createContentCycle({
    organizationId: organization.id,
    brandId: brand.id,
    slackChannelId: payload.channelId,
  });

  await createArtifact({
    organizationId: organization.id,
    brandId: brand.id,
    cycleId: cycle.id,
    type: "BrandProfile",
    status: "active",
    payload: brand.profile,
    createdByAgent: "Manager Agent",
  });

  const kickoffMessage = await postManagerMessage({
    channelId: payload.channelId,
    text: "ContentDesk content cycle started. Research Strategist is preparing topic options.",
    blocks: contentCycleStartedBlocks(brand.profile.appName),
  });
  const threadTs = kickoffMessage.ts;
  if (threadTs) await updateCycleThread(cycle.id, threadTs);

  await postManagerMessage({
    channelId: payload.channelId,
    threadTs,
    text: "Research Strategist is using your Brand Profile to anchor the topic search.",
  });

  const articleMemoryRefresh = await refreshArticleMemoryFromBlog({
    organizationId: organization.id,
    brandId: brand.id,
    blogUrls: brand.profile.existingBlogDocsUrls,
  }).catch((error: unknown) => {
    console.warn("Article memory refresh failed", error);
    return null;
  });
  const articleMemory = await getArticleMemoryForResearch(brand.id);
  const topicMemory = await getRecentTopicStrategyMemory({ brandId: brand.id });

  if (articleMemoryRefresh || articleMemory.length > 0 || topicMemory.length > 0) {
    await postManagerMessage({
      channelId: payload.channelId,
      threadTs,
      text: `ContentDesk refreshed memory before research: ${articleMemory.length} remembered article${articleMemory.length === 1 ? "" : "s"} and ${topicMemory.length} recent topic pattern${topicMemory.length === 1 ? "" : "s"} will be used to avoid duplicate strategy.`,
    });
  }

  await postManagerMessage({
    channelId: payload.channelId,
    threadTs,
    text: "Research Strategist is checking external sources for Shopify context, merchant pain, and topic opportunities.",
  });

  const researchResult = await generateTopicBriefs({
    brandProfile: brand.profile,
    articleMemory,
    topicMemory,
  }).catch(async (error: unknown) => {
    const message = researchFailureMessage(error);

    await updateCycleStatus(cycle.id, "research_failed");
    await postManagerMessage({
      channelId: payload.channelId,
      threadTs,
      text: message,
    });

    return null;
  });

  if (!researchResult) {
    return {
      cycleId: cycle.id,
      topicArtifactId: null,
      missingProfileFields: [],
      researchError: true,
    };
  }

  await postManagerMessage({
    channelId: payload.channelId,
    threadTs,
    text: `Research Strategist found ${researchResult.sources.length} relevant external source${researchResult.sources.length === 1 ? "" : "s"} and is turning the research into 3 topic options.`,
  });

  await createArtifact({
    organizationId: organization.id,
    brandId: brand.id,
    cycleId: cycle.id,
    type: "ResearchSource[]",
    status: "active",
    payload: researchResult.sources,
    createdByAgent: "Research Strategist",
  });

  const topics = researchResult.topics;
  const topicArtifact = await createArtifact({
    organizationId: organization.id,
    brandId: brand.id,
    cycleId: cycle.id,
    type: "TopicBrief[]",
    status: "awaiting_approval",
    payload: topics,
    createdByAgent: "Research Strategist",
  });

  await deliverTopicPicker({
    cycleId: cycle.id,
    topicArtifactId: topicArtifact.id,
    channelId: payload.channelId,
    threadTs,
    topics,
  });

  return {
    cycleId: cycle.id,
    topicArtifactId: topicArtifact.id,
    missingProfileFields: [],
  };
}

export async function runDirectArticleRequest(
  payload: ContentCyclePayload,
  input: { idea: string },
) {
  const articleIdea = input.idea.trim();
  if (!articleIdea) {
    await postManagerMessage({
      channelId: payload.channelId,
      text: "Please include an article idea, like `/contentdesk article Modelia alternatives for Shopify fashion product photos`.",
    });

    return {
      cycleId: null,
      publishKitArtifactId: null,
      missingArticleIdea: true,
    };
  }

  const organization = await getOrCreateOrganization({
    slackTeamId: payload.teamId,
    name: payload.teamName,
  });
  const brand = await getPrimaryBrandForOrganization(organization.id);
  const completeness = getBrandProfileCompleteness(brand?.profile);

  if (!brand || !completeness.isComplete) {
    await postManagerMessage({
      channelId: payload.channelId,
      text: `Before I can draft that article, I need the Brand Profile. Missing: ${completeness.requiredMissing.join(", ")}.`,
    });

    return {
      cycleId: null,
      publishKitArtifactId: null,
      missingProfileFields: completeness.requiredMissing,
    };
  }

  const cycle = await createContentCycle({
    organizationId: organization.id,
    brandId: brand.id,
    slackChannelId: payload.channelId,
  });

  await createArtifact({
    organizationId: organization.id,
    brandId: brand.id,
    cycleId: cycle.id,
    type: "BrandProfile",
    status: "active",
    payload: brand.profile,
    createdByAgent: "Manager Agent",
  });

  const articleRequest = userArticleRequestSchema.parse({
    idea: articleIdea,
    requestedBySlackUserId: payload.userId,
    requestedAt: new Date().toISOString(),
  });
  await createArtifact({
    organizationId: organization.id,
    brandId: brand.id,
    cycleId: cycle.id,
    type: "UserArticleRequest",
    status: "active",
    payload: articleRequest,
    createdByAgent: "Manager Agent",
  });

  const kickoffMessage = await postManagerMessage({
    channelId: payload.channelId,
    text: `ContentDesk article request started: ${articleIdea}`,
    blocks: directArticleStartedBlocks(brand.profile.appName, articleIdea),
  });
  const threadTs = kickoffMessage.ts;
  if (threadTs) await updateCycleThread(cycle.id, threadTs);

  const articleMemoryRefresh = await refreshArticleMemoryFromBlog({
    organizationId: organization.id,
    brandId: brand.id,
    blogUrls: brand.profile.existingBlogDocsUrls,
  }).catch((error: unknown) => {
    console.warn("Article memory refresh failed", error);
    return null;
  });
  const articleMemory = await getArticleMemoryForResearch(brand.id);
  const topicMemory = await getRecentTopicStrategyMemory({ brandId: brand.id });

  if (articleMemoryRefresh || articleMemory.length > 0 || topicMemory.length > 0) {
    await postManagerMessage({
      channelId: payload.channelId,
      threadTs,
      text: `ContentDesk refreshed memory before drafting: ${articleMemory.length} remembered article${articleMemory.length === 1 ? "" : "s"} and ${topicMemory.length} recent topic pattern${topicMemory.length === 1 ? "" : "s"} will be used to avoid duplicate angles.`,
    });
  }

  await postManagerMessage({
    channelId: payload.channelId,
    threadTs,
    text: "Research Strategist is checking request-specific sources before drafting.",
  });

  const researchResult = await generateTopicBriefForArticleRequest({
    brandProfile: brand.profile,
    articleIdea,
    articleMemory,
    topicMemory,
  }).catch(async (error: unknown) => {
    const message = researchFailureMessage(error);

    await updateCycleStatus(cycle.id, "research_failed");
    await postManagerMessage({
      channelId: payload.channelId,
      threadTs,
      text: message,
    });

    return null;
  });

  if (!researchResult) {
    return {
      cycleId: cycle.id,
      publishKitArtifactId: null,
      researchError: true,
    };
  }

  await postManagerMessage({
    channelId: payload.channelId,
    threadTs,
    text: `Research Strategist found ${researchResult.sources.length} relevant external source${researchResult.sources.length === 1 ? "" : "s"} and converted your request into a focused article brief.`,
  });

  await createArtifact({
    organizationId: organization.id,
    brandId: brand.id,
    cycleId: cycle.id,
    type: "ResearchSource[]",
    status: "active",
    payload: researchResult.sources,
    createdByAgent: "Research Strategist",
  });

  const approvedTopicArtifact = await createArtifact({
    organizationId: organization.id,
    brandId: brand.id,
    cycleId: cycle.id,
    type: "ApprovedTopic",
    status: "active",
    payload: researchResult.topic,
    createdByAgent: "Manager Agent",
  });
  await markCycleTopicApproved({
    cycleId: cycle.id,
    artifactId: approvedTopicArtifact.id,
  });
  await createApproval({
    cycleId: cycle.id,
    artifactId: approvedTopicArtifact.id,
    gate: "topic",
    status: "auto_approved",
    slackUserId: payload.userId,
  });

  return runPublishKitPipelineFromApprovedTopic({
    cycleId: cycle.id,
    channelId: payload.channelId,
    threadTs,
    organizationId: organization.id,
    brandId: brand.id,
    topic: researchResult.topic,
    brandProfile: brand.profile,
    researchSources: researchResult.sources,
    sourceMode: "direct_article",
  });
}

async function deliverTopicPicker(input: {
  cycleId: string;
  topicArtifactId: string;
  channelId: string;
  threadTs?: string;
  topics: TopicBrief[];
}) {
  const text = "ContentDesk has 3 topic ideas ready for approval.";

  const message = await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text,
    blocks: topicPickerBlocks({
      cycleId: input.cycleId,
      artifactId: input.topicArtifactId,
      topics: input.topics,
    }),
  });

  if (!input.threadTs && message.ts) await updateCycleThread(input.cycleId, message.ts);
}

function contentCycleStartedBlocks(appName: string) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*ContentDesk content cycle started*",
          `Research Strategist is preparing topic options for *${appName}*.`,
          "Progress updates will appear in this thread.",
        ].join("\n"),
      },
    },
  ];
}

function directArticleStartedBlocks(appName: string, articleIdea: string) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*ContentDesk article request started*",
          `App: *${appName}*`,
          `Article idea: *${articleIdea}*`,
          "I’ll research this specific request, draft the article, run QA, plan visuals, and bring back a publish kit for approval.",
        ].join("\n"),
      },
    },
  ];
}

function researchFailureMessage(error: unknown) {
  const reason =
    error instanceof ResearchStrategistError
      ? error.userMessage
      : error instanceof Error
        ? error.message
        : String(error);

  return [
    "Research Strategist could not generate topic ideas.",
    `Reason: ${reason}`,
    "No fallback topics were created. Fix the issue, restart the Slack app if env values changed, then run `/contentdesk` again.",
  ].join("\n");
}

export async function handleTopicApproval(input: {
  cycleId: string;
  artifactId: string;
  topicIndex: number;
  channelId: string;
  threadTs?: string;
  slackUserId: string;
  onApprovalCommitted?: (input: { topics: TopicBrief[] }) => Promise<void>;
}) {
  const topicArtifact = await getArtifact<TopicBrief[]>(input.artifactId);
  if (!topicArtifact) throw new Error("Topic artifact not found");

  const topic = topicArtifact.json_payload[input.topicIndex];
  if (!topic) throw new Error("Approved topic index not found");

  const didApprove = await setApprovedTopicIfAwaiting({
    cycleId: input.cycleId,
    artifactId: input.artifactId,
  });

  if (!didApprove) {
    const approvedTopicArtifact = await getLatestArtifactForCycle<TopicBrief>(
      input.cycleId,
      "ApprovedTopic",
    );

    return {
      publishKitArtifactId: null,
      alreadyApproved: true,
      writerFailed: false,
      approvedTopicIndex: approvedTopicArtifact
        ? findTopicIndex(topicArtifact.json_payload, approvedTopicArtifact.json_payload)
        : null,
    };
  }

  await createApproval({
    cycleId: input.cycleId,
    artifactId: input.artifactId,
    gate: "topic",
    status: "approved",
    slackUserId: input.slackUserId,
  });

  await createArtifact({
    organizationId: topicArtifact.organization_id,
    brandId: topicArtifact.brand_id,
    cycleId: input.cycleId,
    type: "ApprovedTopic",
    status: "active",
    payload: topic,
    createdByAgent: "Manager Agent",
  });

  await input.onApprovalCommitted?.({ topics: topicArtifact.json_payload });

  const brandProfileArtifact = await getLatestArtifactForCycle<BrandProfile>(
    input.cycleId,
    "BrandProfile",
  );
  const researchSourceArtifact = await getLatestArtifactForCycle<ResearchSource[]>(
    input.cycleId,
    "ResearchSource[]",
  );

  if (!brandProfileArtifact || !researchSourceArtifact) {
    await updateCycleStatus(input.cycleId, "writer_failed");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text:
        "Topic approved, but SEO Writer could not start because this cycle is missing its Brand Profile or research source artifact. Run a new content cycle after fixing the missing artifact.",
    });

    return {
      publishKitArtifactId: null,
      alreadyApproved: false,
      writerFailed: true,
    };
  }

  if (researchSourceArtifact.json_payload.length === 0) {
    await updateCycleStatus(input.cycleId, "writer_failed");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text:
        "Topic approved, but SEO Writer could not start because this cycle has no research sources. No weak draft was generated.",
    });

    return {
      publishKitArtifactId: null,
      alreadyApproved: false,
      writerFailed: true,
    };
  }

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: "SEO Writer is drafting the article, metadata, FAQ, CTA, internal links, and social snippets.",
  });

  let writerResult = await generateArticleDraft({
    topic,
    brandProfile: brandProfileArtifact.json_payload,
    sources: researchSourceArtifact.json_payload,
  });
  await recordSeoWriterRun({
    cycleId: input.cycleId,
    phase: "draft",
    topic,
    result: writerResult,
  });

  let finalArticleDraftArtifact = await createArtifact({
    organizationId: topicArtifact.organization_id,
    brandId: topicArtifact.brand_id,
    cycleId: input.cycleId,
    type: "ArticleDraft",
    status: writerResult.usedFallback ? "fallback" : "drafted",
    payload: writerResult.draft,
    createdByAgent: "SEO Writer",
  });

  const deslopResult = await deslopArticleDraft({
    draft: writerResult.draft,
    brandProfile: brandProfileArtifact.json_payload,
  });

  if (deslopResult.changes.length > 0) {
    writerResult = { ...writerResult, draft: deslopResult.draft };
    finalArticleDraftArtifact = await createArtifact({
      organizationId: topicArtifact.organization_id,
      brandId: topicArtifact.brand_id,
      cycleId: input.cycleId,
      type: "ArticleDraft",
      status: "polished",
      payload: writerResult.draft,
      createdByAgent: "Copy Editor",
    });
  }

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: writerResult.usedFallback
      ? "SEO Writer created a fallback article draft. Visual Producer is now planning useful visuals and Markdown placeholders."
      : deslopResult.changes.length > 0
        ? `SEO Writer drafted the article and Copy Editor cleaned up ${deslopResult.changes.length} AI-ism${deslopResult.changes.length === 1 ? "" : "s"}. Visual Producer is now planning useful visuals, placements, alt text, and Markdown placeholders.`
        : "SEO Writer drafted the article. Visual Producer is now planning useful visuals, placements, alt text, and Markdown placeholders.",
  });

  let visualResult = await generateVisualPlan({
    draft: writerResult.draft,
    brandProfile: brandProfileArtifact.json_payload,
    sources: researchSourceArtifact.json_payload,
  });

  await createArtifact({
    organizationId: topicArtifact.organization_id,
    brandId: topicArtifact.brand_id,
    cycleId: input.cycleId,
    type: "LeadVisual",
    status: visualResult.usedFallback ? "fallback" : "planned",
    payload: visualResult.leadVisual,
    createdByAgent: "Visual Producer",
  });

  await createArtifact({
    organizationId: topicArtifact.organization_id,
    brandId: topicArtifact.brand_id,
    cycleId: input.cycleId,
    type: "VisualPlan",
    status: visualResult.usedFallback ? "fallback" : "planned",
    payload: visualResult.visualPlan,
    createdByAgent: "Visual Producer",
  });

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: visualResult.usedFallback
      ? `Visual Producer created a fallback visual plan with ${visualResult.visualPlan.length} visuals. Editor / SEO QA is reviewing the draft and visual plan.`
      : `Visual Producer planned ${visualResult.visualPlan.length} visuals. Editor / SEO QA is reviewing the draft and visual plan.`,
  });

  await updateCycleStatus(input.cycleId, "qa_reviewing");
  let citationResult = await checkCitations({
    draft: writerResult.draft,
    sources: researchSourceArtifact.json_payload,
  });
  let qaResult = await generateQaReport({
    draft: writerResult.draft,
    leadVisual: visualResult.leadVisual,
    visualPlan: visualResult.visualPlan,
    brandProfile: brandProfileArtifact.json_payload,
    sources: researchSourceArtifact.json_payload,
  });
  qaResult = {
    ...qaResult,
    qaReport: withCitationBlockers(qaResult.qaReport, citationResult.issues),
  };

  await createArtifact({
    organizationId: topicArtifact.organization_id,
    brandId: topicArtifact.brand_id,
    cycleId: input.cycleId,
    type: "QAReport",
    status: qaResult.qaReport.status === "pass" ? "passed" : "needs_revision",
    payload: qaResult.qaReport,
    createdByAgent: "Editor / SEO QA",
  });
  let qaReportBeforeRevision: QAReport | null = null;
  let writerRevisionTaskResults: SeoWriterResult["revisionTaskResults"] = [];
  let revisionPassesAttempted = 0;

  for (
    let revisionPass = 1;
    revisionPass <= MAX_QA_REVISION_PASSES && !qaPassed(qaResult.qaReport);
    revisionPass += 1
  ) {
    const writerInstructions = uniqueStrings(qaRevisionInstructions(qaResult.qaReport));
    const visualInstructions = uniqueStrings(
      visualRevisionInstructions(qaResult.qaReport),
    );

    if (writerInstructions.length === 0 && visualInstructions.length === 0) {
      break;
    }

    qaReportBeforeRevision = qaResult.qaReport;
    await updateCycleStatus(input.cycleId, "revising");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text: `Editor / SEO QA found ${qaResult.qaReport.blockers.length} blocker${qaResult.qaReport.blockers.length === 1 ? "" : "s"}. ContentDesk is attempting targeted revision pass ${revisionPass} of ${MAX_QA_REVISION_PASSES}.`,
    });

    if (writerInstructions.length > 0) {
      const writerRevisionTasks = revisionTasksForWriter(
        createRevisionTasks(qaResult.qaReport),
      );

      await createArtifact({
        organizationId: topicArtifact.organization_id,
        brandId: topicArtifact.brand_id,
        cycleId: input.cycleId,
        type: "RevisionTask[]",
        status: "active",
        payload: writerRevisionTasks,
        createdByAgent: "Editor / SEO QA",
      });

      writerResult = await generateArticleDraft({
        topic,
        brandProfile: brandProfileArtifact.json_payload,
        sources: researchSourceArtifact.json_payload,
        revisionInstructions: writerInstructions,
        revisionTasks: writerRevisionTasks,
        previousDraft: writerResult.draft,
        qaReport: qaResult.qaReport,
      });
      await recordSeoWriterRun({
        cycleId: input.cycleId,
        phase: "revision",
        topic,
        result: writerResult,
        revisionTasks: writerRevisionTasks,
      });

      finalArticleDraftArtifact = await createArtifact({
        organizationId: topicArtifact.organization_id,
        brandId: topicArtifact.brand_id,
        cycleId: input.cycleId,
        type: "ArticleDraft",
        status: writerResult.usedFallback
          ? `revision_${revisionPass}_fallback`
          : `revised_${revisionPass}`,
        payload: writerResult.draft,
        createdByAgent: "SEO Writer",
      });

      await createArtifact({
        organizationId: topicArtifact.organization_id,
        brandId: topicArtifact.brand_id,
        cycleId: input.cycleId,
        type: "RevisionTaskResult[]",
        status: revisionTaskResultStatus(writerResult.revisionTaskResults),
        payload: writerResult.revisionTaskResults,
        createdByAgent: "SEO Writer",
      });
      writerRevisionTaskResults = writerResult.revisionTaskResults;

      if (writerResult.usedFallback) {
        await updateCycleStatus(input.cycleId, "writer_revision_failed");
        await postManagerMessage({
          channelId: input.channelId,
          threadTs: input.threadTs,
          text: writerRevisionFailureMessage(writerResult),
        });

        return {
          publishKitArtifactId: null,
          alreadyApproved: false,
          writerFailed: true,
          qaBlocked: false,
          approvedTopicIndex: input.topicIndex,
        };
      }

      const revisionDeslopResult = await deslopArticleDraft({
        draft: writerResult.draft,
        brandProfile: brandProfileArtifact.json_payload,
      });

      if (revisionDeslopResult.changes.length > 0) {
        writerResult = { ...writerResult, draft: revisionDeslopResult.draft };
        finalArticleDraftArtifact = await createArtifact({
          organizationId: topicArtifact.organization_id,
          brandId: topicArtifact.brand_id,
          cycleId: input.cycleId,
          type: "ArticleDraft",
          status: `polished_${revisionPass}`,
          payload: writerResult.draft,
          createdByAgent: "Copy Editor",
        });
      }
    }

    if (visualInstructions.length > 0) {
      visualResult = await generateVisualPlan({
        draft: writerResult.draft,
        brandProfile: brandProfileArtifact.json_payload,
        sources: researchSourceArtifact.json_payload,
        revisionInstructions: visualInstructions,
        previousLeadVisual: visualResult.leadVisual,
        previousVisualPlan: visualResult.visualPlan,
        qaReport: qaResult.qaReport,
      });

      await createArtifact({
        organizationId: topicArtifact.organization_id,
        brandId: topicArtifact.brand_id,
        cycleId: input.cycleId,
        type: "LeadVisual",
        status: visualResult.usedFallback
          ? `revision_${revisionPass}_fallback`
          : `revised_${revisionPass}`,
        payload: visualResult.leadVisual,
        createdByAgent: "Visual Producer",
      });

      await createArtifact({
        organizationId: topicArtifact.organization_id,
        brandId: topicArtifact.brand_id,
        cycleId: input.cycleId,
        type: "VisualPlan",
        status: visualResult.usedFallback
          ? `revision_${revisionPass}_fallback`
          : `revised_${revisionPass}`,
        payload: visualResult.visualPlan,
        createdByAgent: "Visual Producer",
      });
    }

    await updateCycleStatus(input.cycleId, "qa_reviewing");
    citationResult = await checkCitations({
      draft: writerResult.draft,
      sources: researchSourceArtifact.json_payload,
    });
    qaResult = await generateQaReport({
      draft: writerResult.draft,
      leadVisual: visualResult.leadVisual,
      visualPlan: visualResult.visualPlan,
      brandProfile: brandProfileArtifact.json_payload,
      sources: researchSourceArtifact.json_payload,
      previousQaReport: qaReportBeforeRevision ?? undefined,
      revisionTaskResults: writerRevisionTaskResults,
    });
    qaResult = {
      ...qaResult,
      qaReport: withCitationBlockers(qaResult.qaReport, citationResult.issues),
    };

    await createArtifact({
      organizationId: topicArtifact.organization_id,
      brandId: topicArtifact.brand_id,
      cycleId: input.cycleId,
      type: "QAReport",
      status: qaResult.qaReport.status === "pass" ? "passed" : "needs_revision",
      payload: qaResult.qaReport,
      createdByAgent: "Editor / SEO QA",
    });
    revisionPassesAttempted = revisionPass;
  }

  if (!qaPassed(qaResult.qaReport)) {
    await updateCycleStatus(input.cycleId, "qa_blocked");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text: blockedQaMessage(qaResult.qaReport, revisionPassesAttempted),
    });

    return {
      publishKitArtifactId: null,
      alreadyApproved: false,
      writerFailed: false,
      qaBlocked: true,
      approvedTopicIndex: input.topicIndex,
    };
  }

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: "QA passed. Visual Asset Generator is creating eligible image assets, then Visual Asset QA will inspect the generated images before the publish kit is created.",
  });

  const visualAssetResult = await generateVisualAssets({
    cycleId: input.cycleId,
    draft: writerResult.draft,
    visualPlan: [visualResult.leadVisual, ...visualResult.visualPlan],
    brandProfile: brandProfileArtifact.json_payload,
  });
  const visualAssetQaResult = await reviewVisualAssets({
    draft: writerResult.draft,
    visualPlan: [visualResult.leadVisual, ...visualResult.visualPlan],
    brandProfile: brandProfileArtifact.json_payload,
    visualAssets: visualAssetResult.visualAssets,
  });

  await createArtifact({
    organizationId: topicArtifact.organization_id,
    brandId: topicArtifact.brand_id,
    cycleId: input.cycleId,
    type: "VisualAsset[]",
    status: visualAssetStatus(visualAssetQaResult.visualAssets),
    payload: visualAssetQaResult.visualAssets,
    createdByAgent: "Visual Asset Generator",
  });
  await createArtifact({
    organizationId: topicArtifact.organization_id,
    brandId: topicArtifact.brand_id,
    cycleId: input.cycleId,
    type: "VisualAssetReview[]",
    status: visualAssetReviewStatus(visualAssetQaResult.reviews),
    payload: visualAssetQaResult.reviews,
    createdByAgent: "Visual Asset QA",
  });

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: visualAssetSummaryMessage(visualAssetQaResult.visualAssets),
  });

  if (
    visualAssetResult.generationConfigured &&
    !approvedLeadVisualAsset(visualResult.leadVisual, visualAssetQaResult.visualAssets)
  ) {
    await updateCycleStatus(input.cycleId, "qa_blocked");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text: missingLeadVisualMessage(visualAssetQaResult.visualAssets),
    });

    return {
      publishKitArtifactId: null,
      alreadyApproved: false,
      writerFailed: false,
      qaBlocked: true,
      approvedTopicIndex: input.topicIndex,
    };
  }

  const linkedInPost = await createLinkedInPostForPublishKit({
    organizationId: topicArtifact.organization_id,
    brandId: topicArtifact.brand_id,
    cycleId: input.cycleId,
    brandProfile: brandProfileArtifact.json_payload,
    draft: writerResult.draft,
    leadVisual: visualResult.leadVisual,
    visualPlan: visualResult.visualPlan,
    sourceArtifactId: finalArticleDraftArtifact.id,
  });
  const publishKit = buildPublishKitFromArticleDraft({
    draft: writerResult.draft,
    leadVisual: visualResult.leadVisual,
    visualPlan: visualResult.visualPlan,
    qaReport: qaResult.qaReport,
    visualAssets: visualAssetQaResult.visualAssets,
    linkedInPosts: linkedInPost ? [linkedInPost] : [],
  });
  const parsedPublishKit = publishKitSchema.parse(publishKit);
  const publishKitArtifact = await createArtifact({
    organizationId: topicArtifact.organization_id,
    brandId: topicArtifact.brand_id,
    cycleId: input.cycleId,
    type: "PublishKit",
    status: "awaiting_approval",
    payload: parsedPublishKit,
    createdByAgent: "Manager Agent",
  });
  await updateCycleStatus(input.cycleId, "awaiting_publish_kit_approval");

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: writerResult.usedFallback
      ? "Topic approved. QA passed after fallback drafting. Publish kit preview is ready for final approval."
      : "Topic approved. QA passed and the publish kit preview is ready for final approval.",
    blocks: publishKitBlocks({
      cycleId: input.cycleId,
      artifactId: publishKitArtifact.id,
      publishKit: parsedPublishKit,
    }),
  });

  return {
    publishKitArtifactId: publishKitArtifact.id,
    alreadyApproved: false,
    writerFailed: false,
    approvedTopicIndex: input.topicIndex,
  };
}

export async function handleVisibilityRecommendationApproval(input: {
  cycleId: string;
  artifactId: string;
  runId: string;
  recommendationId: string;
  hash: string;
  taskType: string;
  channelId: string;
  threadTs?: string;
  slackUserId: string;
  onApprovalCommitted?: (input: {
    recommendation: VisibilityRecommendationForSlack;
  }) => Promise<void>;
}) {
  const recommendationArtifact = await getArtifact<VisibilityRecommendationForSlack>(
    input.artifactId,
  );
  if (!recommendationArtifact) throw new Error("Visibility recommendation artifact not found");

  const renderedRecommendation = visibilityRecommendationForSlackSchema.parse(
    recommendationArtifact.json_payload,
  );

  if (
    renderedRecommendation.id !== input.recommendationId ||
    renderedRecommendation.taskType !== input.taskType
  ) {
    return {
      publishKitArtifactId: null,
      stale: true,
      alreadyApproved: false,
      disabledTaskType: false,
      writerFailed: false,
    };
  }

  const currentRecommendation = await reloadVisibilityRecommendationForSlack(
    renderedRecommendation,
  ).catch((error: unknown) => {
    console.warn(
      "Visibility recommendation reload failed",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  });

  if (
    isVisibilityRecommendationStale({
      rendered: renderedRecommendation,
      current: currentRecommendation,
      actionHash: input.hash,
      actionRunId: input.runId,
    })
  ) {
    return {
      publishKitArtifactId: null,
      stale: true,
      alreadyApproved: false,
      disabledTaskType: false,
      writerFailed: false,
    };
  }

  const recommendation = currentRecommendation ?? renderedRecommendation;
  if (!recommendation.productionSupported) {
    return {
      publishKitArtifactId: null,
      stale: false,
      alreadyApproved: false,
      disabledTaskType: true,
      writerFailed: false,
    };
  }

  const didApprove = await setApprovedTopicIfAwaiting({
    cycleId: input.cycleId,
    artifactId: input.artifactId,
  });

  if (!didApprove) {
    return {
      publishKitArtifactId: null,
      stale: false,
      alreadyApproved: true,
      disabledTaskType: false,
      writerFailed: false,
    };
  }

  await createApproval({
    cycleId: input.cycleId,
    artifactId: input.artifactId,
    gate: "visibility_recommendation",
    status: "approved",
    slackUserId: input.slackUserId,
  });

  await input.onApprovalCommitted?.({ recommendation });

  const brandProfileArtifact = await getLatestArtifactForCycle<BrandProfile>(
    input.cycleId,
    "BrandProfile",
  );

  if (!brandProfileArtifact) {
    await updateCycleStatus(input.cycleId, "writer_failed");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text:
        "Visibility recommendation approved, but SEO Writer could not start because this cycle is missing its Brand Profile artifact. Run `/contentdesk` again after fixing the missing artifact.",
    });

    return {
      publishKitArtifactId: null,
      stale: false,
      alreadyApproved: false,
      disabledTaskType: false,
      writerFailed: true,
    };
  }

  const topic = buildTopicBriefFromVisibilityRecommendation({
    recommendation,
    brandProfile: brandProfileArtifact.json_payload,
  });
  const researchSources = buildResearchSourcesFromVisibilityRecommendation({
    recommendation,
  });

  await createArtifact({
    organizationId: recommendationArtifact.organization_id,
    brandId: recommendationArtifact.brand_id,
    cycleId: input.cycleId,
    type: "ResearchSource[]",
    status: "active",
    payload: researchSources,
    createdByAgent: "Visibility Layer",
  });
  const approvedTopicArtifact = await createArtifact({
    organizationId: recommendationArtifact.organization_id,
    brandId: recommendationArtifact.brand_id,
    cycleId: input.cycleId,
    type: "ApprovedTopic",
    status: "active",
    payload: topic,
    createdByAgent: "Manager Agent",
  });
  await markCycleTopicApproved({
    cycleId: input.cycleId,
    artifactId: approvedTopicArtifact.id,
  });

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: `Visibility recommendation approved. Production runner is building: ${topic.workingTitle}`,
  });

  const pipelineResult = await runPublishKitPipelineFromApprovedTopic({
    cycleId: input.cycleId,
    channelId: input.channelId,
    threadTs: input.threadTs,
    organizationId: recommendationArtifact.organization_id,
    brandId: recommendationArtifact.brand_id,
    topic,
    brandProfile: brandProfileArtifact.json_payload,
    researchSources,
    sourceMode: "visibility_recommendation",
  });

  return {
    ...pipelineResult,
    stale: false,
    disabledTaskType: false,
  };
}

async function runPublishKitPipelineFromApprovedTopic(input: {
  cycleId: string;
  channelId: string;
  threadTs?: string;
  organizationId: string;
  brandId: string;
  topic: TopicBrief;
  brandProfile: BrandProfile;
  researchSources: ResearchSource[];
  approvedTopicIndex?: number;
  sourceMode: "topic_approval" | "direct_article" | "visibility_recommendation";
}) {
  if (input.researchSources.length === 0) {
    await updateCycleStatus(input.cycleId, "writer_failed");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text:
        "SEO Writer could not start because this cycle has no research sources. No weak draft was generated.",
    });

    return {
      publishKitArtifactId: null,
      alreadyApproved: false,
      writerFailed: true,
      approvedTopicIndex: input.approvedTopicIndex,
    };
  }

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text:
      input.sourceMode === "direct_article"
        ? "SEO Writer is drafting the requested article, metadata, FAQ, CTA, internal links, and social snippets."
        : input.sourceMode === "visibility_recommendation"
          ? "SEO Writer is drafting the visibility-backed asset, metadata, FAQ, CTA, internal links, and social snippets."
        : "SEO Writer is drafting the article, metadata, FAQ, CTA, internal links, and social snippets.",
  });

  let writerResult = await generateArticleDraft({
    topic: input.topic,
    brandProfile: input.brandProfile,
    sources: input.researchSources,
  });
  await recordSeoWriterRun({
    cycleId: input.cycleId,
    phase: "draft",
    topic: input.topic,
    result: writerResult,
  });

  let finalArticleDraftArtifact = await createArtifact({
    organizationId: input.organizationId,
    brandId: input.brandId,
    cycleId: input.cycleId,
    type: "ArticleDraft",
    status: writerResult.usedFallback ? "fallback" : "drafted",
    payload: writerResult.draft,
    createdByAgent: "SEO Writer",
  });

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: writerResult.usedFallback
      ? "SEO Writer created a fallback article draft. Visual Producer is now planning useful visuals and Markdown placeholders."
      : "SEO Writer drafted the article. Visual Producer is now planning useful visuals, placements, alt text, and Markdown placeholders.",
  });

  let visualResult = await generateVisualPlan({
    draft: writerResult.draft,
    brandProfile: input.brandProfile,
    sources: input.researchSources,
  });

  await createArtifact({
    organizationId: input.organizationId,
    brandId: input.brandId,
    cycleId: input.cycleId,
    type: "LeadVisual",
    status: visualResult.usedFallback ? "fallback" : "planned",
    payload: visualResult.leadVisual,
    createdByAgent: "Visual Producer",
  });

  await createArtifact({
    organizationId: input.organizationId,
    brandId: input.brandId,
    cycleId: input.cycleId,
    type: "VisualPlan",
    status: visualResult.usedFallback ? "fallback" : "planned",
    payload: visualResult.visualPlan,
    createdByAgent: "Visual Producer",
  });

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: visualResult.usedFallback
      ? `Visual Producer created a fallback visual plan with ${visualResult.visualPlan.length} visuals. Editor / SEO QA is reviewing the draft and visual plan.`
      : `Visual Producer planned ${visualResult.visualPlan.length} visuals. Editor / SEO QA is reviewing the draft and visual plan.`,
  });

  await updateCycleStatus(input.cycleId, "qa_reviewing");
  let qaResult = await generateQaReport({
    draft: writerResult.draft,
    leadVisual: visualResult.leadVisual,
    visualPlan: visualResult.visualPlan,
    brandProfile: input.brandProfile,
    sources: input.researchSources,
  });

  await createArtifact({
    organizationId: input.organizationId,
    brandId: input.brandId,
    cycleId: input.cycleId,
    type: "QAReport",
    status: qaResult.qaReport.status === "pass" ? "passed" : "needs_revision",
    payload: qaResult.qaReport,
    createdByAgent: "Editor / SEO QA",
  });
  let qaReportBeforeRevision: QAReport | null = null;
  let writerRevisionTaskResults: SeoWriterResult["revisionTaskResults"] = [];
  let revisionPassesAttempted = 0;

  for (
    let revisionPass = 1;
    revisionPass <= MAX_QA_REVISION_PASSES && !qaPassed(qaResult.qaReport);
    revisionPass += 1
  ) {
    const writerInstructions = uniqueStrings(qaRevisionInstructions(qaResult.qaReport));
    const visualInstructions = uniqueStrings(
      visualRevisionInstructions(qaResult.qaReport),
    );

    if (writerInstructions.length === 0 && visualInstructions.length === 0) {
      break;
    }

    qaReportBeforeRevision = qaResult.qaReport;
    await updateCycleStatus(input.cycleId, "revising");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text: `Editor / SEO QA found ${qaResult.qaReport.blockers.length} blocker${qaResult.qaReport.blockers.length === 1 ? "" : "s"}. ContentDesk is attempting targeted revision pass ${revisionPass} of ${MAX_QA_REVISION_PASSES}.`,
    });

    if (writerInstructions.length > 0) {
      const writerRevisionTasks = revisionTasksForWriter(
        createRevisionTasks(qaResult.qaReport),
      );

      await createArtifact({
        organizationId: input.organizationId,
        brandId: input.brandId,
        cycleId: input.cycleId,
        type: "RevisionTask[]",
        status: "active",
        payload: writerRevisionTasks,
        createdByAgent: "Editor / SEO QA",
      });

      writerResult = await generateArticleDraft({
        topic: input.topic,
        brandProfile: input.brandProfile,
        sources: input.researchSources,
        revisionInstructions: writerInstructions,
        revisionTasks: writerRevisionTasks,
        previousDraft: writerResult.draft,
        qaReport: qaResult.qaReport,
      });
      await recordSeoWriterRun({
        cycleId: input.cycleId,
        phase: "revision",
        topic: input.topic,
        result: writerResult,
        revisionTasks: writerRevisionTasks,
      });

      finalArticleDraftArtifact = await createArtifact({
        organizationId: input.organizationId,
        brandId: input.brandId,
        cycleId: input.cycleId,
        type: "ArticleDraft",
        status: writerResult.usedFallback
          ? `revision_${revisionPass}_fallback`
          : `revised_${revisionPass}`,
        payload: writerResult.draft,
        createdByAgent: "SEO Writer",
      });

      await createArtifact({
        organizationId: input.organizationId,
        brandId: input.brandId,
        cycleId: input.cycleId,
        type: "RevisionTaskResult[]",
        status: revisionTaskResultStatus(writerResult.revisionTaskResults),
        payload: writerResult.revisionTaskResults,
        createdByAgent: "SEO Writer",
      });
      writerRevisionTaskResults = writerResult.revisionTaskResults;

      if (writerResult.usedFallback) {
        await updateCycleStatus(input.cycleId, "writer_revision_failed");
        await postManagerMessage({
          channelId: input.channelId,
          threadTs: input.threadTs,
          text: writerRevisionFailureMessage(writerResult),
        });

        return {
          publishKitArtifactId: null,
          alreadyApproved: false,
          writerFailed: true,
          qaBlocked: false,
          approvedTopicIndex: input.approvedTopicIndex,
        };
      }
    }

    if (visualInstructions.length > 0) {
      visualResult = await generateVisualPlan({
        draft: writerResult.draft,
        brandProfile: input.brandProfile,
        sources: input.researchSources,
        revisionInstructions: visualInstructions,
        previousLeadVisual: visualResult.leadVisual,
        previousVisualPlan: visualResult.visualPlan,
        qaReport: qaResult.qaReport,
      });

      await createArtifact({
        organizationId: input.organizationId,
        brandId: input.brandId,
        cycleId: input.cycleId,
        type: "LeadVisual",
        status: visualResult.usedFallback
          ? `revision_${revisionPass}_fallback`
          : `revised_${revisionPass}`,
        payload: visualResult.leadVisual,
        createdByAgent: "Visual Producer",
      });

      await createArtifact({
        organizationId: input.organizationId,
        brandId: input.brandId,
        cycleId: input.cycleId,
        type: "VisualPlan",
        status: visualResult.usedFallback
          ? `revision_${revisionPass}_fallback`
          : `revised_${revisionPass}`,
        payload: visualResult.visualPlan,
        createdByAgent: "Visual Producer",
      });
    }

    await updateCycleStatus(input.cycleId, "qa_reviewing");
    qaResult = await generateQaReport({
      draft: writerResult.draft,
      leadVisual: visualResult.leadVisual,
      visualPlan: visualResult.visualPlan,
      brandProfile: input.brandProfile,
      sources: input.researchSources,
      previousQaReport: qaReportBeforeRevision ?? undefined,
      revisionTaskResults: writerRevisionTaskResults,
    });

    await createArtifact({
      organizationId: input.organizationId,
      brandId: input.brandId,
      cycleId: input.cycleId,
      type: "QAReport",
      status: qaResult.qaReport.status === "pass" ? "passed" : "needs_revision",
      payload: qaResult.qaReport,
      createdByAgent: "Editor / SEO QA",
    });
    revisionPassesAttempted = revisionPass;
  }

  if (!qaPassed(qaResult.qaReport)) {
    await updateCycleStatus(input.cycleId, "qa_blocked");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text: blockedQaMessage(qaResult.qaReport, revisionPassesAttempted),
    });

    return {
      publishKitArtifactId: null,
      alreadyApproved: false,
      writerFailed: false,
      qaBlocked: true,
      approvedTopicIndex: input.approvedTopicIndex,
    };
  }

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: "QA passed. Visual Asset Generator is creating eligible image assets, then Visual Asset QA will inspect the generated images before the publish kit is created.",
  });

  const visualAssetResult = await generateVisualAssets({
    cycleId: input.cycleId,
    draft: writerResult.draft,
    visualPlan: [visualResult.leadVisual, ...visualResult.visualPlan],
    brandProfile: input.brandProfile,
  });
  const visualAssetQaResult = await reviewVisualAssets({
    draft: writerResult.draft,
    visualPlan: [visualResult.leadVisual, ...visualResult.visualPlan],
    brandProfile: input.brandProfile,
    visualAssets: visualAssetResult.visualAssets,
  });

  await createArtifact({
    organizationId: input.organizationId,
    brandId: input.brandId,
    cycleId: input.cycleId,
    type: "VisualAsset[]",
    status: visualAssetStatus(visualAssetQaResult.visualAssets),
    payload: visualAssetQaResult.visualAssets,
    createdByAgent: "Visual Asset Generator",
  });
  await createArtifact({
    organizationId: input.organizationId,
    brandId: input.brandId,
    cycleId: input.cycleId,
    type: "VisualAssetReview[]",
    status: visualAssetReviewStatus(visualAssetQaResult.reviews),
    payload: visualAssetQaResult.reviews,
    createdByAgent: "Visual Asset QA",
  });

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: visualAssetSummaryMessage(visualAssetQaResult.visualAssets),
  });

  if (
    visualAssetResult.generationConfigured &&
    !approvedLeadVisualAsset(visualResult.leadVisual, visualAssetQaResult.visualAssets)
  ) {
    await updateCycleStatus(input.cycleId, "qa_blocked");
    await postManagerMessage({
      channelId: input.channelId,
      threadTs: input.threadTs,
      text: missingLeadVisualMessage(visualAssetQaResult.visualAssets),
    });

    return {
      publishKitArtifactId: null,
      alreadyApproved: false,
      writerFailed: false,
      qaBlocked: true,
      approvedTopicIndex: input.approvedTopicIndex,
    };
  }

  const linkedInPost = await createLinkedInPostForPublishKit({
    organizationId: input.organizationId,
    brandId: input.brandId,
    cycleId: input.cycleId,
    brandProfile: input.brandProfile,
    draft: writerResult.draft,
    leadVisual: visualResult.leadVisual,
    visualPlan: visualResult.visualPlan,
    sourceArtifactId: finalArticleDraftArtifact.id,
  });
  const publishKit = buildPublishKitFromArticleDraft({
    draft: writerResult.draft,
    leadVisual: visualResult.leadVisual,
    visualPlan: visualResult.visualPlan,
    qaReport: qaResult.qaReport,
    visualAssets: visualAssetQaResult.visualAssets,
    linkedInPosts: linkedInPost ? [linkedInPost] : [],
  });
  const parsedPublishKit = publishKitSchema.parse(publishKit);
  const publishKitArtifact = await createArtifact({
    organizationId: input.organizationId,
    brandId: input.brandId,
    cycleId: input.cycleId,
    type: "PublishKit",
    status: "awaiting_approval",
    payload: parsedPublishKit,
    createdByAgent: "Manager Agent",
  });
  await updateCycleStatus(input.cycleId, "awaiting_publish_kit_approval");

  await postManagerMessage({
    channelId: input.channelId,
    threadTs: input.threadTs,
    text: publishKitReadyMessage(input.sourceMode, writerResult.usedFallback),
    blocks: publishKitBlocks({
      cycleId: input.cycleId,
      artifactId: publishKitArtifact.id,
      publishKit: parsedPublishKit,
    }),
  });

  return {
    publishKitArtifactId: publishKitArtifact.id,
    alreadyApproved: false,
    writerFailed: false,
    approvedTopicIndex: input.approvedTopicIndex,
  };
}

function publishKitReadyMessage(
  sourceMode: "topic_approval" | "direct_article" | "visibility_recommendation",
  usedFallback: boolean,
) {
  if (sourceMode === "direct_article") {
    return usedFallback
      ? "Requested article drafted. QA passed after fallback drafting, and the publish kit preview is ready for final approval."
      : "Requested article drafted. QA passed and the publish kit preview is ready for final approval.";
  }

  if (sourceMode === "visibility_recommendation") {
    return usedFallback
      ? "Visibility-backed asset drafted. QA passed after fallback drafting, and the publish kit preview is ready for final approval."
      : "Visibility-backed asset drafted. QA passed and the publish kit preview is ready for final approval.";
  }

  return usedFallback
    ? "Topic approved. QA passed after fallback drafting. Publish kit preview is ready for final approval."
    : "Topic approved. QA passed and the publish kit preview is ready for final approval.";
}

function findTopicIndex(topics: TopicBrief[], approvedTopic: TopicBrief) {
  const index = topics.findIndex(
    (topic) =>
      topic.topic === approvedTopic.topic &&
      topic.workingTitle === approvedTopic.workingTitle,
  );

  return index === -1 ? null : index;
}

function blockedQaMessage(report: QAReport, revisionPassesAttempted: number) {
  const blockerList = report.blockers
    .slice(0, 5)
    .map(
      (issue, index) =>
        `${index + 1}. ${issue.finding}\nInstruction: ${issue.instruction}`,
    )
    .join("\n\n");

  return [
    `Editor / SEO QA still found blockers after ${formatRevisionPassCount(revisionPassesAttempted)}.`,
    "No PublishKit approval modal was created.",
    "",
    blockerList,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatRevisionPassCount(count: number) {
  if (count <= 0) return "the targeted revision pass";

  return `${count} revision pass${count === 1 ? "" : "es"}`;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function recordSeoWriterRun(input: {
  cycleId: string;
  phase: "draft" | "revision";
  topic: TopicBrief;
  result: SeoWriterResult;
  revisionTasks?: RevisionTask[];
}) {
  await createAgentRun({
    cycleId: input.cycleId,
    agentName: "SEO Writer",
    status: input.result.usedFallback ? "fallback" : "completed",
    input: {
      phase: input.phase,
      topic: input.topic.workingTitle,
      revisionTaskCount: input.revisionTasks?.length ?? 0,
      revisionTasks: input.revisionTasks ?? [],
    },
    output: {
      usedFallback: input.result.usedFallback,
      title: input.result.draft.metadata.title,
      markdownLength: input.result.draft.markdown.length,
      revisionTaskResults: input.result.revisionTaskResults,
      fallbackError: input.result.fallbackError ?? null,
    },
    error: input.result.fallbackError
      ? [
          input.result.fallbackError.errorName,
          input.result.fallbackError.errorMessage,
        ].join(": ")
      : undefined,
  });
}

async function createLinkedInPostForPublishKit(input: {
  organizationId: string;
  brandId: string;
  cycleId: string;
  brandProfile: BrandProfile;
  draft: ArticleDraft;
  leadVisual: VisualPlanItem;
  visualPlan: VisualPlan;
  sourceArtifactId: string;
}) {
  try {
    const result = await generateLinkedInPost({
      brandProfile: input.brandProfile,
      articleDraft: input.draft,
      leadVisual: input.leadVisual,
      visualPlan: input.visualPlan,
      sourceArtifactId: input.sourceArtifactId,
    });
    const artifact = await createArtifact({
      organizationId: input.organizationId,
      brandId: input.brandId,
      cycleId: input.cycleId,
      type: "LinkedInPost",
      status: result.usedFallback ? "fallback" : "draft",
      payload: result.post,
      createdByAgent: "LinkedIn Distributor",
    });

    await createAgentRun({
      cycleId: input.cycleId,
      agentName: "LinkedIn Distributor",
      status: result.usedFallback ? "fallback" : "completed",
      input: {
        sourceArtifactId: input.sourceArtifactId,
        articleTitle: input.draft.metadata.title,
        targetPromptCount: result.post.targetPrompts.length,
      },
      output: {
        artifactId: artifact.id,
        usedFallback: result.usedFallback,
        hook: result.post.hook,
        bodyLength: result.post.body.length,
        fallbackError: result.fallbackError ?? null,
      },
      error: result.fallbackError
        ? [
            result.fallbackError.errorName,
            result.fallbackError.errorMessage,
          ].join(": ")
        : undefined,
    });

    return result.post;
  } catch (error) {
    await createAgentRun({
      cycleId: input.cycleId,
      agentName: "LinkedIn Distributor",
      status: "failed",
      input: {
        sourceArtifactId: input.sourceArtifactId,
        articleTitle: input.draft.metadata.title,
      },
      output: null,
      error: errorMessage(error),
    }).catch((agentRunError: unknown) => {
      console.warn("LinkedIn Distributor agent-run logging failed", agentRunError);
    });

    console.warn("LinkedIn post generation failed", error);
    return null;
  }
}

function writerRevisionFailureMessage(result: SeoWriterResult) {
  const reason = result.fallbackError?.errorMessage ?? "Unknown writer error.";

  return [
    "SEO Writer revision failed before completing the QA task checklist.",
    "No second QA review was run, and no PublishKit approval modal was created.",
    `Reason: ${reason}`,
    "The detailed error was saved to the agent_runs table for debugging.",
  ].join("\n");
}

function createRevisionTasks(report: QAReport): RevisionTask[] {
  return report.blockers.map((blocker, index) => ({
    id: `rev_${index + 1}`,
    area: blocker.area,
    blockerFinding: blocker.finding,
    instruction: blocker.instruction,
    acceptanceCriteria: [
      `Resolve this blocker: ${blocker.finding}`,
      `Address the evidence QA cited: ${blocker.evidence}`,
      "Update every affected ArticleDraft field, including Markdown, outline, metadata, FAQ, CTA, source URLs, and sourceNotes when relevant.",
      "Do not leave stale language that repeats the blocked claim or outdated sourcing rationale.",
    ],
  }));
}

function revisionTasksForWriter(tasks: RevisionTask[]) {
  return tasks.filter((task) => task.area !== "visual_plan");
}

function revisionTaskResultStatus(
  results: Awaited<ReturnType<typeof generateArticleDraft>>["revisionTaskResults"],
) {
  if (results.length === 0) return "empty";
  if (results.every((result) => result.status === "completed")) return "completed";
  if (results.some((result) => result.status === "completed")) return "partial";

  return "not_completed";
}

function visualAssetStatus(
  visualAssets: Awaited<ReturnType<typeof generateVisualAssets>>["visualAssets"],
) {
  const generated = visualAssets.filter((asset) => asset.status === "generated").length;
  const failed = visualAssets.filter((asset) => asset.status === "failed").length;

  if (generated === visualAssets.length && generated > 0) return "generated";
  if (generated > 0 && failed > 0) return "partial";
  if (generated > 0) return "partial";
  if (failed > 0) return "failed";

  return "skipped";
}

function visualAssetReviewStatus(reviews: VisualAssetReview[]) {
  if (reviews.some((review) => review.status === "failed")) return "failed";
  if (reviews.some((review) => review.status === "passed")) return "passed";

  return "skipped";
}

function visualAssetSummaryMessage(
  visualAssets: Awaited<ReturnType<typeof generateVisualAssets>>["visualAssets"],
) {
  const generated = visualAssets.filter((asset) => asset.status === "generated").length;
  const skipped = visualAssets.filter((asset) => asset.status === "skipped").length;
  const failed = visualAssets.filter((asset) => asset.status === "failed").length;

  if (failed > 0 && generated === 0) {
    return `Visual Asset Generator could not create usable image assets. ${failed} visual${failed === 1 ? "" : "s"} failed or was rejected; check the publish kit visual asset reasons before retrying.`;
  }

  if (generated === 0) {
    return "No generated images were attached. The publish kit will continue as text-only unless a usable image asset exists.";
  }

  return [
    `Visual Asset Generator created ${generated} production-approved image asset${generated === 1 ? "" : "s"}.`,
    skipped || failed
      ? `${skipped + failed} visual${skipped + failed === 1 ? "" : "s"} were skipped or rejected because they were not suitable generated images.`
      : "All planned visuals have generated assets.",
  ].join(" ");
}

function approvedLeadVisualAsset(
  leadVisual: VisualPlanItem,
  visualAssets: VisualAsset[],
) {
  return visualAssets.find(
    (asset) =>
      asset.sourcePlaceholder === leadVisual.markdownPlaceholder &&
      asset.status === "generated" &&
      asset.publicUrl.trim(),
  );
}

function missingLeadVisualMessage(visualAssets: VisualAsset[]) {
  const failedLeadAsset = visualAssets.find((asset) =>
    asset.sourcePlaceholder.toLowerCase().includes("lead"),
  );

  return [
    "Publish kit blocked: the required lead fashion outcome image was not approved.",
    "Because image generation is configured, this article is not publish-ready without a usable lead visual near the top.",
    failedLeadAsset?.error ? `Reason: ${failedLeadAsset.error}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function handlePublishKitApproval(input: {
  cycleId: string;
  artifactId: string;
  channelId: string;
  slackUserId: string;
}) {
  const artifact = await getArtifact<PublishKit>(input.artifactId);
  if (!artifact) throw new Error("Publish kit artifact not found");
  const brandProfileArtifact = await getLatestArtifactForCycle<BrandProfile>(
    input.cycleId,
    "BrandProfile",
  );

  await createApproval({
    cycleId: input.cycleId,
    artifactId: input.artifactId,
    gate: "publish_kit",
    status: "approved",
    slackUserId: input.slackUserId,
  });
  await recordPublishKitHandoff({
    organizationId: artifact.organization_id,
    brandId: artifact.brand_id,
    cycleId: input.cycleId,
    artifactId: input.artifactId,
    publishKit: artifact.json_payload,
    brandProfile: brandProfileArtifact?.json_payload,
  });
  await updateCycleStatus(input.cycleId, "approved");

  await postManagerMessage({
    channelId: input.channelId,
    text: "Publish kit approved. ContentDesk generated the Codex handoff prompt.",
    blocks: codexHandoffBlocks({
      cycleId: input.cycleId,
      artifactId: input.artifactId,
    }),
  });

  return { approved: true };
}

export async function handlePublishKitRejection(input: {
  cycleId: string;
  artifactId: string;
  channelId: string;
  slackUserId: string;
}) {
  await createApproval({
    cycleId: input.cycleId,
    artifactId: input.artifactId,
    gate: "publish_kit",
    status: "rejected",
    slackUserId: input.slackUserId,
  });

  const directArticleRequest = await getLatestArtifactForCycle<UserArticleRequest>(
    input.cycleId,
    "UserArticleRequest",
  );

  if (directArticleRequest) {
    await updateCycleStatus(input.cycleId, "publish_kit_rejected");
    await postManagerMessage({
      channelId: input.channelId,
      text: [
        "Publish kit rejected for the direct article request.",
        "Run `/contentdesk article <clearer idea>` to try another direction.",
      ].join("\n"),
    });

    return { rejected: true };
  }

  const topicArtifact = await getLatestArtifactForCycle<TopicBrief[]>(
    input.cycleId,
    "TopicBrief[]",
  );

  await resetCycleToTopicApproval(input.cycleId);

  await postManagerMessage({
    channelId: input.channelId,
    text: topicArtifact
      ? "Publish kit rejected. Choose another topic direction to continue."
      : "Publish kit rejected. I could not find the original topic options for this cycle.",
    blocks: topicArtifact
      ? topicPickerBlocks({
          cycleId: input.cycleId,
          artifactId: topicArtifact.id,
          topics: topicArtifact.json_payload,
        })
      : undefined,
  });

  return { rejected: true };
}
