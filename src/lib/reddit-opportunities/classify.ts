import { generateText, Output } from "ai";
import { z } from "zod";
import {
  redditScoutKeywords,
  redditScoutMuteTerms,
} from "@/lib/reddit-opportunities/config";
import {
  redditOpportunityClassificationSchema,
  type RedditOpportunityClassification,
  type RedditPost,
} from "@/lib/reddit-opportunities/schemas";
import { buildDeterministicDraft, cleanDraftReply } from "@/lib/reddit-opportunities/draft";

const aiClassificationSchema = redditOpportunityClassificationSchema.omit({
  matchedTerms: true,
}).extend({
  whySurfaced: z.array(z.string().trim().min(1)).min(1).max(4),
});

export function deterministicPrefilter(input: {
  post: RedditPost;
  keywords?: string[];
  muteTerms?: string[];
}) {
  const text = postText(input.post);
  const matchedTerms = matchingTerms(text, input.keywords ?? redditScoutKeywords());
  const matchedMuteTerms = matchingTerms(text, input.muteTerms ?? redditScoutMuteTerms());

  return {
    matchedTerms,
    muted: matchedMuteTerms.length > 0,
    muteReason: matchedMuteTerms.length
      ? `Matched muted term: ${matchedMuteTerms[0]}`
      : "",
  };
}

export async function classifyRedditOpportunity(input: {
  post: RedditPost;
  matchedTerms: string[];
}) {
  const fallback = deterministicClassification(input);
  const aiClassification = await generateAiClassification(input).catch(() => null);
  const classification = aiClassification
    ? redditOpportunityClassificationSchema.parse({
        ...aiClassification,
        matchedTerms: input.matchedTerms,
        draftReply: cleanDraftReply(aiClassification.draftReply, aiClassification),
      })
    : fallback;

  if (!classification.draftReply && classification.fit !== "skip") {
    return {
      ...classification,
      draftReply: fallback.draftReply,
    };
  }

  return classification;
}

function deterministicClassification(input: {
  post: RedditPost;
  matchedTerms: string[];
}): RedditOpportunityClassification {
  const text = postText(input.post);
  const hasShopify = /\bshopify\b/.test(text);
  const hasApparel = /\b(apparel|clothing|fashion|garment|streetwear|t-?shirt|hoodie|dress)\b/.test(text);
  const hasProductPhoto = /\b(product photo|product image|model photo|on[- ]?model|flat[- ]?lay|supplier photo|photoshoot|lookbook|catalog)\b/.test(text);
  const asksForTool = /\b(tool|app|service|software|how do|how can|recommend|suggest|workflow)\b/.test(text);
  const promoRisk = hasProductPhoto && asksForTool
    ? "Medium. Helpful workflow answer can mention affiliation softly."
    : "High. Mention may feel promotional unless reply stays mostly educational.";

  if (hasShopify && hasApparel && hasProductPhoto) {
    return redditOpportunityClassificationSchema.parse({
      fit: "strong",
      score: asksForTool ? 92 : 84,
      matchedTerms: input.matchedTerms,
      whySurfaced: [
        "Shopify/apparel context",
        "Product-photo or on-model-photo workflow",
        asksForTool ? "Asks for practical tool or workflow help" : "Maps to catalog image quality pain",
      ],
      tinyLemonFit:
        "tinylemon fits when merchant has flat-lay or supplier photos and needs on-model Shopify product images.",
      promoRisk,
      suggestedAngle:
        "Answer source photo quality first, then explain a small-batch workflow before mentioning tinylemon.",
      mentionRecommendation: "mention",
      draftReply: buildDeterministicDraft({
        post: input.post,
        matchedTerms: input.matchedTerms,
        mention: true,
      }),
    });
  }

  if ((hasApparel && hasProductPhoto) || (hasShopify && hasProductPhoto)) {
    return redditOpportunityClassificationSchema.parse({
      fit: "medium",
      score: 72,
      matchedTerms: input.matchedTerms,
      whySurfaced: [
        "Product-media workflow",
        "Could map to Shopify apparel catalog quality",
      ],
      tinyLemonFit:
        "Potential fit if poster needs repeatable product images from existing flat-lay or supplier photos.",
      promoRisk,
      suggestedAngle:
        "Keep reply educational. Mention tinylemon only if poster asks for tools or Shopify-specific workflow.",
      mentionRecommendation: asksForTool ? "mention" : "no_mention",
      draftReply: buildDeterministicDraft({
        post: input.post,
        matchedTerms: input.matchedTerms,
        mention: asksForTool,
      }),
    });
  }

  return redditOpportunityClassificationSchema.parse({
    fit: "weak",
    score: 35,
    matchedTerms: input.matchedTerms,
    whySurfaced: ["Matched broad ecommerce or product-photo language"],
    tinyLemonFit: "Weak unless thread turns specifically toward apparel product images.",
    promoRisk: "High. Product mention would likely feel forced.",
    suggestedAngle: "Do not mention tinylemon. Save for language learning or manual review.",
    mentionRecommendation: "no_mention",
    draftReply: buildDeterministicDraft({
      post: input.post,
      matchedTerms: input.matchedTerms,
      mention: false,
    }),
  });
}

async function generateAiClassification(input: {
  post: RedditPost;
  matchedTerms: string[];
}) {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) return null;

  const { output } = await generateText({
    model: process.env.CONTENTDESK_AI_MODEL ?? "openai/gpt-5.4",
    output: Output.object({
      schema: aiClassificationSchema,
    }),
    prompt: [
      "You classify Reddit posts for Tiny Lemon Reddit Radar.",
      "Tiny Lemon is a Shopify app for apparel merchants that turns flat-lay or supplier product photos into on-model Shopify product images.",
      "",
      "Rules:",
      "- Output conservative fit: strong, medium, weak, or skip.",
      "- strong: Shopify/apparel plus product photos/model photos/flat-lays/supplier photos.",
      "- medium: ecommerce product page/catalog visual workflow.",
      "- weak: broad Shopify/ecommerce where product mention may feel forced.",
      "- skip: ads, SEO, fulfillment, pricing, generic ops, promo threads, or unrelated ecommerce.",
      "- Reply draft must be Reddit-native, 2-5 sentences, answer pain first.",
      "- Use lowercase tinylemon only if mentionRecommendation is mention.",
      "- No fake metrics, no guarantees, no overpromising.",
      "- Disclose/soften promotional angle when mentioning tinylemon.",
      "- Human posts manually.",
      "",
      `Matched terms: ${input.matchedTerms.join(", ")}`,
      `Post:\n${JSON.stringify(input.post, null, 2)}`,
    ].join("\n"),
  });

  return output;
}

function matchingTerms(text: string, terms: readonly string[]) {
  return terms.filter((term) => text.includes(term.toLowerCase()));
}

function postText(post: RedditPost) {
  return `${post.title} ${post.content}`.toLowerCase();
}
