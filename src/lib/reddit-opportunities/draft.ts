import type {
  RedditOpportunityClassification,
  RedditPost,
} from "@/lib/reddit-opportunities/schemas";

export function buildDeterministicDraft(input: {
  post: RedditPost;
  matchedTerms: string[];
  mention: boolean;
}) {
  const sourcePhotoLine = "First thing I’d check is whether the source photo is clean enough: front-facing, good light, minimal folds, and enough detail around the garment edges.";
  const workflowLine = "For Shopify apparel, a practical workflow is to standardize the base product shots first, then generate/model-test a small batch before touching the full catalog.";
  const mentionLine = input.mention
    ? "I’m connected to tinylemon, which is built around turning flat-lay or supplier photos into on-model Shopify images, so that kind of workflow is where it fits best."
    : "I’d avoid picking a tool before you know whether your input photos are consistent enough for repeatable results.";

  return [sourcePhotoLine, workflowLine, mentionLine].join(" ");
}

export function cleanDraftReply(
  draft: string,
  classification: Pick<RedditOpportunityClassification, "mentionRecommendation">,
) {
  const trimmed = draft
    .replace(/\bTiny Lemon\b/g, "tinylemon")
    .replace(/\bTinyLemon\b/g, "tinylemon")
    .replace(/\s+/g, " ")
    .trim();

  if (classification.mentionRecommendation === "no_mention") {
    return trimmed.replace(/\s*I.?m connected to tinylemon[^.]*\./i, "").trim();
  }

  return trimmed;
}
