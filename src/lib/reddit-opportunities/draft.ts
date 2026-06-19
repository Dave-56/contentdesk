import type {
  RedditOpportunityClassification,
  RedditPost,
} from "@/lib/reddit-opportunities/schemas";

export const tinyLemonRedditGrowthReplyRules = [
  "Tiny Lemon Reddit Growth reply rules:",
  "- Score fit before drafting: strong when Shopify/ecommerce apparel plus product photos, on-model shots, flat-lays, supplier photos, catalog consistency, PDP media, or Shopify publishing are central.",
  "- Medium fit can mention tinylemon only when product media or listing speed is a natural part of the thread.",
  "- Weak/no fit should skip tinylemon and stay useful, or skip drafting a promo reply.",
  "- Lead with merchant pain, not AI novelty.",
  "- Default brand spelling is lowercase tinylemon in Reddit/community replies.",
  "- Treat tinylemon as live and useful: customers/users/merchants use it for flat-lay or supplier photo in, on-model Shopify images out.",
  "- If drafting in operator voice, it is okay to say we use tinylemon in our Shopify workflow.",
  "- Do not say I am building, I am working on, MVP, experimental tool, or looking for validation.",
  "- Do not invent exact user counts, revenue, review counts, customer logos, conversion lift, retention, or case studies.",
  "- Do not overpromise accuracy, conversion improvement, return-rate reduction, perfect output, or guaranteed results.",
  "- Avoid spam words: game changer, revolutionary, 10x, guaranteed, insane results, crush it, viral.",
  "- Keep replies Reddit-native, specific, and short: 2-5 sentences.",
  "- Add one useful caveat when it makes the reply more trustworthy.",
  "- Mention value as workflow: clean source photo, saved/custom model consistency, generate/review, Shopify product-page publishing, test one SKU before full catalog.",
].join("\n");

export function buildDeterministicDraft(input: {
  post: RedditPost;
  matchedTerms: string[];
  mention: boolean;
}) {
  const sourcePhotoLine =
    "First thing I’d check is whether the source photo is clean enough: front-facing, good light, minimal folds, and enough detail around the garment edges.";
  const workflowLine =
    "For Shopify apparel, I’d treat this as a product-page workflow: keep a real flat-lay/product shot as source of truth, then test on-model shots on a small batch before touching the full catalog.";
  const mentionLine = input.mention
    ? "That’s what customers use tinylemon for: flat-lay or supplier photo in, on-model Shopify images out. Worth testing with one SKU before committing the whole catalog."
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
