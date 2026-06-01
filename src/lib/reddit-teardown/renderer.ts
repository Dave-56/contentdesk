import type { TeardownPacket } from "@/lib/reddit-teardown/schemas";
import type { RecommendationCard } from "@/lib/schemas";

export function renderResearchPacket(packet: TeardownPacket) {
  const sources = packet.likelyCompetitorsOrSources.slice(0, 8);

  return [
    `*Research packet for ${packet.siteProfile.companyName}*`,
    `*Site:* ${packet.websiteUrl}`,
    `*Category guess:* ${packet.categoryGuess} (${packet.categoryConfidence} confidence)`,
    `*Audience guess:* ${packet.siteProfile.audienceGuess}`,
    `*Problem solved:* ${packet.siteProfile.problemSolved}`,
    "",
    "*Likely competitors/sources to inspect:*",
    ...formatBullets(
      sources.map((source) =>
        `${source.name} (${source.sourceType.replaceAll("_", " ")}): ${source.reason}`,
      ),
    ),
    "",
    `*First-pass gap:* ${packet.firstPassGap}`,
    `*Recommended asset:* ${packet.recommendedAsset.title}`,
  ].join("\n");
}

export function renderManualPrompts(packet: TeardownPacket) {
  return [
    "*Manual prompts/searches to run*",
    "",
    "*Buyer questions to test:*",
    ...formatBullets(
      packet.buyerPrompts.map(
        (prompt) => `${prompt.prompt} _(${prompt.intent.replaceAll("_", " ")})_`,
      ),
    ),
    "",
    "*Search queries:*",
    ...formatBullets(packet.discoverySearches.map((search) => `${search.query} - ${search.purpose}`)),
  ].join("\n");
}

export function renderRedditReplyDraft(packet: TeardownPacket) {
  return [
    "*Reddit reply draft*",
    "",
    "```",
    `Took a quick look. I would classify you as competing in ${packet.categoryGuess}.`,
    "",
    "The buyer questions I would test first are:",
    ...packet.buyerPrompts.slice(0, 5).map((prompt) => `- ${prompt.prompt}`),
    "",
    "For questions like these, the pages/sources I would inspect are mostly:",
    ...sourceTypeBullets(packet),
    "",
    "The content gap I would look at first:",
    packet.firstPassGap,
    "",
    "If I were choosing one thing to publish next, I would publish:",
    packet.recommendedAsset.title,
    "",
    "Why:",
    packet.recommendedAsset.whyItMatters,
    "",
    "How I would structure it:",
    ...packet.recommendedAsset.suggestedStructure.map((section) => `- ${section}`),
    "",
    "Caveat: this is directional, not a ranking guarantee. The goal is to give you a concrete next page to publish instead of another abstract visibility score.",
    "```",
  ].join("\n");
}

export function renderRecommendationCard(card: RecommendationCard) {
  return [
    "*Recommendation Card*",
    "",
    `*What did we find?* ${card.finding}`,
    `*Why does it matter?* ${card.whyItMatters}`,
    "",
    "*Evidence:*",
    ...formatBullets(
      card.evidence.map((item) =>
        item.url
          ? `${item.label}: ${item.summary} (${item.url})`
          : `${item.label}: ${item.summary}`,
      ),
    ),
    "",
    `*What should we publish or fix?* ${card.recommendedAsset.title}`,
    `*Why this asset over others?* ${card.recommendedAsset.whyThisAssetOverOthers}`,
    "",
    "*How should it be structured?*",
    ...formatBullets(card.recommendedAsset.suggestedStructure),
    "",
    "*Target prompts:*",
    ...formatBullets(card.targetPrompts.map((prompt) => prompt.prompt)),
    "",
    `*Recheck:* ${card.recheckPlan.recheckOn}`,
    ...formatBullets(card.recheckPlan.prompts),
    `Expected signal: ${card.recheckPlan.expectedSignal}`,
    `If nothing changes: ${card.recheckPlan.ifNoMovement}`,
  ].join("\n");
}

function formatBullets(items: string[]) {
  if (items.length === 0) return ["- Manual review needed."];
  return items.map((item) => `- ${item}`);
}

function sourceTypeBullets(packet: TeardownPacket) {
  const sourceTypes = [
    ...new Set(
      packet.likelyCompetitorsOrSources.map((source) => source.sourceType.replaceAll("_", " ")),
    ),
  ].slice(0, 5);

  return formatBullets(sourceTypes.length ? sourceTypes : ["competitor pages", "guides", "directories"]);
}
