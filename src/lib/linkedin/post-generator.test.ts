import assert from "node:assert/strict";
import test from "node:test";

import { generateLinkedInPost } from "@/lib/linkedin/post-generator";
import type {
  ArticleDraft,
  BrandProfile,
  VisualPlan,
  VisualPlanItem,
} from "@/lib/schemas";

test("LinkedIn generator falls back to a brand-safe company-page post without AI env", async () => {
  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY;
  const previousOidcToken = process.env.VERCEL_OIDC_TOKEN;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;

  try {
    const result = await generateLinkedInPost({
      brandProfile: brandProfileFixture(),
      articleDraft: articleDraftFixture(),
      leadVisual: leadVisualFixture(),
      visualPlan: visualPlanFixture(),
      sourceArtifactId: "artifact_article_1",
    });

    assert.equal(result.usedFallback, true);
    assert.equal(result.post.channel, "company_page");
    assert.equal(result.post.format, "text");
    assert.equal(result.post.status, "draft");
    assert.equal(result.post.sourceArtifactId, "artifact_article_1");
    assert.equal(result.post.sourceArticleTitle, articleDraftFixture().metadata.title);
    assert.match(result.post.hook, /Shopify apparel brands/);
    assert.match(result.post.body, /Tiny Lemon/);
    assert.match(result.post.cta, /Test Tiny Lemon/);
    assert.match(result.post.visualBrief, /Lead premium collection image/);
    assert.ok(result.post.targetPrompts.length > 0);
    assert.equal(result.post.publishUrl, "");
    assert.equal(result.post.publishedAt, null);
  } finally {
    if (previousGatewayKey === undefined) {
      delete process.env.AI_GATEWAY_API_KEY;
    } else {
      process.env.AI_GATEWAY_API_KEY = previousGatewayKey;
    }
    if (previousOidcToken === undefined) {
      delete process.env.VERCEL_OIDC_TOKEN;
    } else {
      process.env.VERCEL_OIDC_TOKEN = previousOidcToken;
    }
  }
});

function brandProfileFixture(): BrandProfile {
  return {
    appName: "Tiny Lemon",
    targetMerchant: "Shopify apparel brands",
    positioning: "turn flat-lay photos into on-model product images",
    featuresUseCases: ["AI on-model photos"],
    competitors: ["Botika"],
    preferredVoice: "",
    voiceProfile: {
      name: "Tiny Lemon Lab",
      description: "Brand/editorial voice for a practical product image lab.",
      toneTraits: ["visual", "specific", "operator-friendly"],
      writingRules: ["Use brand voice, not fake founder voice."],
      phrasesToUse: ["product image lab"],
      phrasesToAvoid: ["game-changing"],
      sampleLines: ["Your product page can look editorial without a new shoot."],
    },
    preferredVisuals: [],
    visualsToAvoid: [],
    forbiddenClaims: [],
    ctaStyle: "soft educational CTA",
    existingBlogDocsUrls: [],
  };
}

function articleDraftFixture(): ArticleDraft {
  return {
    topic: {
      topic: "AI on-model photo apps",
      workingTitle: "How Shopify brands evaluate AI on-model photo apps",
      strategicFingerprint: "evaluate-ai-on-model-apps",
      strategyType: "comparison",
      funnelStage: "bottom",
      merchantJob: "Choose how to create on-model PDP images before launch.",
      intentType: "comparison_decision",
      messageAngle:
        "Frame AI on-model app evaluation around launch risk and product accuracy.",
      proofAngle:
        "Show evaluation criteria and Shopify workflow checks before publishing.",
      strategyEvidence: [
        "Brand Profile: Tiny Lemon supports Shopify fashion visual workflows.",
        "Research source: Shopify context supports merchant app workflow decisions.",
      ],
      whyThisStrategy:
        "Captures merchants comparing AI on-model photo tools for Shopify.",
      targetMerchantPain:
        "Choosing a tool without misrepresenting products or making the catalog look cheaper.",
      shopifySpecificAngle: "Shopify apparel PDP image workflow",
      whyNow: "AI image tooling is now cheap enough for small catalogs.",
      searchIntent: "Commercial investigation",
      contentGap: "Practical evaluation workflow",
      suggestedCtaAngle: "Try Tiny Lemon on a few SKUs.",
      sourceLinks: ["https://example.com/source"],
      score: 90,
    },
    outline: [
      {
        heading: "The short answer",
        purpose: "Answer the query directly",
        sourceLinks: ["https://example.com/source"],
      },
    ],
    markdown: [
      "# How Shopify brands evaluate AI on-model photo apps",
      "",
      "Use clean inputs and compare garment fidelity before publishing.",
      "",
      "## The short answer",
      "",
      "Start with a small SKU test before changing a whole product page gallery.",
    ].join("\n"),
    titleOptions: [
      "How Shopify brands evaluate AI on-model photo apps",
      "AI on-model photo apps for Shopify",
      "Choosing AI model photos for Shopify",
    ],
    metadata: {
      title: "How Shopify brands evaluate AI on-model photo apps",
      metaDescription:
        "A practical workflow for Shopify clothing brands evaluating AI on-model photo apps.",
      targetQueries: [
        "AI on-model photos Shopify",
        "Shopify fashion product image workflow",
      ],
    },
    faq: [
      {
        question: "Can AI on-model photos be used on Shopify?",
        answer: "Yes, if they accurately represent the product.",
      },
    ],
    cta: "Test Tiny Lemon on a small set of flat-lay images.",
    internalLinkSuggestions: [],
    socialDrafts: ["A practical way to evaluate AI on-model photo tools."],
    sources: ["https://example.com/source"],
    sourceNotes: "",
  };
}

function leadVisualFixture(): VisualPlanItem {
  return {
    title: "Lead premium collection image",
    placement: "LEAD_VISUAL_TOP",
    visualType: "hero",
    purpose: "Show a premium fashion ecommerce outcome before the guide explains the workflow.",
    altText: "Premium product-on-model fashion ecommerce image for a Shopify collection",
    instruction: "Create a polished campaign-style fashion product image.",
    markdownPlaceholder: "[Visual placeholder: lead fashion outcome]",
    renderMode: "generated_image",
    textBudget: "none",
    visualStructure: "editorial_scene",
  };
}

function visualPlanFixture(): VisualPlan {
  return [];
}
