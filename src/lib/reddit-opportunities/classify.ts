import { generateText, Output } from "ai";
import { z } from "zod";
import {
  redditScoutKeywords,
  redditScoutMuteTerms,
  tinyLemonRedditConfig,
} from "@/lib/reddit-opportunities/config";
import {
  redditMentionRecommendationSchema,
  redditOpportunityClassificationSchema,
  redditOpportunityFitSchema,
  type RedditOpportunityClassification,
  type RedditPost,
} from "@/lib/reddit-opportunities/schemas";
import { buildDeterministicDraft, cleanDraftReply } from "@/lib/reddit-opportunities/draft";

// OpenAI structured outputs reject schemas whose properties are not all
// required, so every field here must stay free of .default()/.optional().
const aiClassificationSchema = z.object({
  fit: redditOpportunityFitSchema,
  score: z.number().int().min(0).max(100),
  whySurfaced: z.array(z.string().trim().min(1)).min(1).max(4),
  tinyLemonFit: z.string().trim(),
  promoRisk: z.string().trim(),
  suggestedAngle: z.string().trim(),
  mentionRecommendation: redditMentionRecommendationSchema,
  draftReply: z.string().trim(),
});

// Same constraint as aiClassificationSchema: no .default()/.optional().
const aiPrefilterSchema = z.object({
  posts: z.array(
    z.object({
      redditPostId: z.string().trim().min(1),
      relevant: z.boolean(),
      reason: z.string().trim(),
    }),
  ),
});

export type RedditPrefilterVerdict = {
  relevant: boolean;
  reason: string;
};

// Cheap relevance gate run on every unseen post before full classification.
// Returns null when no AI credentials are configured so the caller can fall
// back to the deterministic keyword prefilter.
export async function aiPrefilterRedditPosts(input: {
  posts: RedditPost[];
  batchSize?: number;
}): Promise<Map<string, RedditPrefilterVerdict> | null> {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) return null;

  const verdicts = new Map<string, RedditPrefilterVerdict>();
  const batchSize = input.batchSize ?? tinyLemonRedditConfig.prefilterBatchSize;

  for (let start = 0; start < input.posts.length; start += batchSize) {
    const batch = input.posts.slice(start, start + batchSize);
    const { output } = await generateText({
      model:
        process.env.CONTENTDESK_AI_PREFILTER_MODEL ??
        process.env.CONTENTDESK_AI_MODEL ??
        "openai/gpt-5.4",
      output: Output.object({
        schema: aiPrefilterSchema,
      }),
      prompt: [
        "You prefilter Reddit posts for Tiny Lemon Reddit Radar. Judge every post; return one verdict per redditPostId.",
        "Tiny Lemon (tinylemon.xyz) is a Shopify app for apparel merchants that turns flat-lay or supplier product photos into on-model Shopify product images.",
        "relevant=true when the poster plausibly sells (or is launching) physical products and the post touches product imagery: product photos, on-model shots, flat-lays, supplier photos, mockups, lookbooks, catalog visuals, or asking how/what tools to use for any of those. Apparel is the bullseye but keep adjacent product-photo posts.",
        "relevant=false for ads/marketing spend, SEO, fulfillment, shipping, taxes, pricing, legal, hiring human photographers for brand campaigns, replica/rep communities, photographers seeking clients, and generic business advice with no product-imagery angle.",
        "When unsure, lean relevant — a stricter classifier runs after you.",
        "reason: one short sentence.",
        "",
        `Posts:\n${JSON.stringify(batch.map(prefilterPostView), null, 2)}`,
      ].join("\n"),
    });

    for (const verdict of output.posts) {
      verdicts.set(verdict.redditPostId, {
        relevant: verdict.relevant,
        reason: verdict.reason,
      });
    }
  }

  return verdicts;
}

function prefilterPostView(post: RedditPost) {
  return {
    redditPostId: post.redditPostId,
    subreddit: post.subreddit,
    title: post.title,
    content: post.content.slice(0, 400),
  };
}

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
  const aiClassification = await generateAiClassification(input).catch((error: unknown) => {
    console.error(
      `Reddit Radar AI classification failed for ${input.post.redditPostId}; using deterministic fallback:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  });
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
      "Tiny Lemon (tinylemon.xyz) is a Shopify app for apparel merchants that turns flat-lay or supplier product photos into on-model Shopify product images.",
      "Ideal poster: someone selling clothing/apparel online who needs product photos, on-model imagery, or a way to upgrade flat-lay/supplier photos.",
      "Not a fit: non-apparel products (food, electronics, home goods), replica/rep communities, people hiring human photographers for brand shoots, or general business advice with incidental photo language.",
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
  return terms.filter((term) => {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z0-9])${escaped}s?(?![a-z0-9])`).test(text);
  });
}

function postText(post: RedditPost) {
  return `${post.title} ${post.content}`.toLowerCase();
}
