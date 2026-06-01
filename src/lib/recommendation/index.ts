import {
  recommendationCardSchema,
  type BrandProfile,
  type RecommendationAsset,
  type RecommendationCard,
  type RecommendationEvidence,
  type RecommendationTargetPrompt,
  type ResearchSource,
  type TopicBrief,
} from "@/lib/schemas";
import type { TeardownPacket } from "@/lib/reddit-teardown/schemas";

const DEFAULT_RECHECK_DAYS = 30;

export function buildRecommendationCardFromTopic(input: {
  topic: TopicBrief;
  brandProfile: BrandProfile;
  sources: ResearchSource[];
  createdAt?: Date;
}): RecommendationCard {
  const createdAt = input.createdAt ?? new Date();
  const sourceEvidence = input.sources
    .filter((source) => input.topic.sourceLinks.includes(source.url))
    .slice(0, 4)
    .map<RecommendationEvidence>((source) => ({
      label: source.title || source.url,
      summary: source.extractedMarkdown || source.excerpt,
      url: source.url,
    }));
  const fallbackEvidence = input.topic.strategyEvidence.map<RecommendationEvidence>(
    (item, index) => ({
      label: `Strategy evidence ${index + 1}`,
      summary: item,
    }),
  );
  if (fallbackEvidence.length === 0) {
    fallbackEvidence.push({
      label: "Approved topic brief",
      summary: `${input.topic.shopifySpecificAngle} ${input.topic.whyNow}`,
    });
  }
  const targetPrompts = topicTargetPrompts(input.topic);

  return recommendationCardSchema.parse({
    source: "topic_brief",
    audience: input.brandProfile.targetMerchant,
    finding: input.topic.contentGap,
    whyItMatters: input.topic.targetMerchantPain,
    evidence: sourceEvidence.length ? sourceEvidence : fallbackEvidence,
    recommendedAsset: topicRecommendedAsset(input.topic),
    targetPrompts,
    crawlabilityNotes: [
      "Use a clear answer-first opening.",
      "Make the article crawlable as plain HTML/Markdown with descriptive headings.",
      "Avoid hiding the core answer behind images, scripts, or interactive-only UI.",
    ],
    risks: [
      "Recommendation is based on current research sources and should be rechecked after publishing.",
      "Do not make ranking, traffic, or AI-citation guarantees.",
    ],
    recheckPlan: {
      recheckOn: dateAfter(createdAt, DEFAULT_RECHECK_DAYS),
      prompts: targetPrompts.map((prompt) => prompt.prompt),
      expectedSignal:
        "The brand has a crawlable asset that directly answers the target prompts and can be compared against cited competitor/source pages.",
      ifNoMovement:
        "Inspect which sources still appear, compare their structure and proof against the published asset, then refresh the page or add supporting proof/offsite mentions.",
    },
    createdAt: createdAt.toISOString(),
  });
}

export function buildRecommendationCardFromTeardown(
  packet: TeardownPacket,
  input: { createdAt?: Date } = {},
): RecommendationCard {
  const createdAt = input.createdAt ?? new Date();
  const targetPrompts = packet.buyerPrompts.slice(0, 5).map<RecommendationTargetPrompt>(
    (prompt) => ({
      prompt: prompt.prompt,
      intent: prompt.intent,
    }),
  );
  const competitorEvidence = packet.likelyCompetitorsOrSources
    .slice(0, 4)
    .map<RecommendationEvidence>((source) => ({
      label: source.name,
      summary: `${source.sourceType.replaceAll("_", " ")}: ${source.reason}`,
      url: source.url,
    }));
  const evidence: RecommendationEvidence[] = [
    {
      label: "Site profile",
      summary: `${packet.siteProfile.companyName} appears to serve ${packet.siteProfile.audienceGuess}: ${packet.siteProfile.problemSolved}`,
      url: packet.websiteUrl,
    },
    {
      label: "Category guess",
      summary: `${packet.categoryGuess} (${packet.categoryConfidence} confidence).`,
    },
    ...competitorEvidence,
  ];

  return recommendationCardSchema.parse({
    source: "reddit_teardown",
    audience: packet.siteProfile.audienceGuess,
    finding: packet.firstPassGap,
    whyItMatters: packet.recommendedAsset.whyItMatters,
    evidence,
    recommendedAsset: teardownRecommendedAsset(packet),
    targetPrompts,
    crawlabilityNotes: [
      "Publish the asset as an indexable page with one clear H1 and descriptive H2 sections.",
      "Answer the buyer question near the top before adding background.",
      "Use plain text for evaluation criteria and FAQs so search and AI systems can parse them.",
    ],
    risks: packet.caveats,
    recheckPlan: {
      recheckOn: dateAfter(createdAt, DEFAULT_RECHECK_DAYS),
      prompts: targetPrompts.map((prompt) => prompt.prompt),
      expectedSignal:
        "The new asset should be a credible page to inspect alongside competitors, directories, guides, or community threads that currently answer these prompts.",
      ifNoMovement:
        "Rerun the prompts, identify which cited pages still win, then strengthen the asset with missing proof, clearer comparison criteria, or supporting distribution.",
    },
    createdAt: createdAt.toISOString(),
  });
}

function topicRecommendedAsset(topic: TopicBrief): RecommendationAsset {
  return {
    assetType: topic.strategyType === "comparison" ? "comparison" : "guide",
    title: topic.workingTitle,
    reason: topic.whyThisStrategy,
    whyThisAssetOverOthers:
      topic.strategyType === "comparison"
        ? "The approved topic serves buyers who are already evaluating options, so a comparison asset can answer decision criteria more directly than a broad educational post."
        : "The approved topic maps to a specific merchant job and content gap, so a focused guide is more useful than a generic category post.",
    suggestedStructure: [
      "Answer-first summary",
      topic.merchantJob,
      topic.shopifySpecificAngle,
      topic.proofAngle,
      topic.suggestedCtaAngle,
      "FAQ",
    ],
  };
}

function teardownRecommendedAsset(packet: TeardownPacket): RecommendationAsset {
  return {
    assetType: packet.recommendedAsset.assetType,
    title: packet.recommendedAsset.title,
    reason: packet.recommendedAsset.whyItMatters,
    whyThisAssetOverOthers:
      "This asset directly answers the buyer-facing gap identified in the teardown, while broader content would be less falsifiable and harder to recheck.",
    suggestedStructure: packet.recommendedAsset.suggestedStructure,
  };
}

function topicTargetPrompts(topic: TopicBrief): RecommendationTargetPrompt[] {
  return [
    {
      prompt: topic.searchIntent,
      intent: topic.intentType,
    },
    {
      prompt: topic.workingTitle,
      intent: topic.strategyType,
    },
    {
      prompt: topic.merchantJob,
      intent: "merchant_job",
    },
  ];
}

function dateAfter(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);

  return next.toISOString().slice(0, 10);
}
