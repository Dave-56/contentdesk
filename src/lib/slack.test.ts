import assert from "node:assert/strict";
import test from "node:test";

import { brandProfileModal, topicPickerBlocks, topicPreviewModal } from "@/lib/slack";
import { parseContentDeskCommand } from "@/lib/slack-command";
import { topicBriefSchema, type TopicBrief } from "@/lib/schemas";

test("contentdesk article command preserves the requested idea text", () => {
  const parsed = parseContentDeskCommand(
    "article Modelia alternatives for Shopify fashion product photos",
  );

  assert.deepEqual(parsed, {
    mode: "article",
    idea: "Modelia alternatives for Shopify fashion product photos",
  });
});

test("contentdesk article command supports colon syntax", () => {
  const parsed = parseContentDeskCommand(
    "article: Best AI model photo apps for Shopify fashion stores",
  );

  assert.deepEqual(parsed, {
    mode: "article",
    idea: "Best AI model photo apps for Shopify fashion stores",
  });
});

test("contentdesk reddit teardown command supports explicit syntax", () => {
  const parsed = parseContentDeskCommand("reddit-teardown https://example.com");

  assert.deepEqual(parsed, {
    mode: "reddit-teardown",
    websiteUrl: "https://example.com",
  });
});

test("contentdesk teardown command accepts bare domains", () => {
  const parsed = parseContentDeskCommand("teardown example.com");

  assert.deepEqual(parsed, {
    mode: "reddit-teardown",
    websiteUrl: "example.com",
  });
});

test("contentdesk teardown command handles empty URL", () => {
  const parsed = parseContentDeskCommand("teardown");

  assert.deepEqual(parsed, {
    mode: "reddit-teardown",
    websiteUrl: "",
  });
});

test("contentdesk teardown command rejects obviously invalid URL input", () => {
  const parsed = parseContentDeskCommand("teardown not a url");

  assert.deepEqual(parsed, {
    mode: "reddit-teardown",
    websiteUrl: "",
  });
});

test("brand profile modal preserves a pending article request", () => {
  const modal = brandProfileModal({
    mode: "create",
    channelId: "C123",
    teamId: "T123",
    userId: "U123",
    startAfterSave: true,
    pendingCommand: {
      mode: "article",
      idea: "Modelia alternatives for Shopify fashion product photos",
    },
  });

  assert.deepEqual(JSON.parse(modal.private_metadata ?? "{}"), {
    mode: "create",
    channelId: "C123",
    teamId: "T123",
    userId: "U123",
    startAfterSave: true,
    pendingCommand: {
      mode: "article",
      idea: "Modelia alternatives for Shopify fashion product photos",
    },
  });
});

test("topic picker shows compact strategy labels", () => {
  const blocks = topicPickerBlocks({
    cycleId: "cycle_1",
    artifactId: "artifact_1",
    topics: [
      topicFixture({
        workingTitle: "Jasper alternatives for Shopify fashion photo workflows",
        strategyType: "comparison",
        funnelStage: "bottom",
        score: 95,
      }),
      topicFixture({
        workingTitle: "How apparel merchants evaluate AI photo quality",
        strategyType: "education",
        funnelStage: "top",
        score: 85,
      }),
      topicFixture({
        workingTitle: "A weekly Shopify photo QA workflow",
        strategyType: "workflow",
        funnelStage: "middle",
        score: 75,
      }),
    ],
  });

  const text = JSON.stringify(blocks);

  assert.match(text, /Bottom-funnel comparison/);
  assert.match(text, /Top-funnel education/);
  assert.match(text, /Mid-funnel workflow/);
  assert.match(text, /Job: Choose how to create on-model PDP images before launch/);
});

test("topic preview includes the strategy rationale", () => {
  const modal = topicPreviewModal({
    topic: topicFixture({
      strategyType: "comparison",
      funnelStage: "bottom",
      intentType: "comparison_decision",
      strategicFingerprint: "ai-vs-photoshoot-comparison",
      whyThisStrategy:
        "Captures merchants who are actively choosing between Shopify AI photo tools.",
    }),
    topicNumber: 1,
  });

  const text = JSON.stringify(modal);

  assert.match(text, /Bottom-funnel comparison/);
  assert.match(text, /Merchant job/);
  assert.match(text, /Choose how to create on-model PDP images before launch/);
  assert.match(text, /Intent type/);
  assert.match(text, /Comparison decision/);
  assert.match(text, /Message angle/);
  assert.match(text, /frame AI photo selection around launch risk/);
  assert.match(text, /Proof angle/);
  assert.match(text, /show evaluation criteria/);
  assert.match(text, /Available evidence/);
  assert.match(text, /Research source: Shopify guidance/);
  assert.match(text, /actively choosing between Shopify AI photo tools/);
  assert.doesNotMatch(text, /ai-vs-photoshoot-comparison/);
});

test("legacy topic renders in Slack picker and preview without strategy fields", () => {
  const legacyTopic = {
    topic: "AI on-model photo apps",
    workingTitle: "Legacy AI on-model guide",
    strategyType: "workflow",
    funnelStage: "middle",
    whyThisStrategy: "Legacy rationale.",
    targetMerchantPain: "Merchants need a repeatable PDP image workflow.",
    shopifySpecificAngle: "Shopify apparel PDP image workflow",
    whyNow: "AI image tooling is now cheap enough for small catalogs.",
    searchIntent: "Workflow search",
    contentGap: "Practical evaluation workflow for Shopify apparel teams.",
    suggestedCtaAngle: "Try Tiny Lemon on a few SKUs.",
    sourceLinks: ["https://example.com/source"],
    score: 88,
  } as TopicBrief;

  assert.doesNotThrow(() =>
    topicPickerBlocks({
      cycleId: "cycle_1",
      artifactId: "artifact_1",
      topics: [legacyTopic],
    }),
  );
  assert.doesNotThrow(() =>
    topicPreviewModal({
      topic: legacyTopic,
      topicNumber: 1,
    }),
  );
});

function topicFixture(overrides: Partial<TopicBrief> = {}): TopicBrief {
  return topicBriefSchema.parse({
    topic: "AI on-model photo apps",
    workingTitle: "How Shopify brands evaluate AI on-model photo apps",
    strategicFingerprint: "ai-on-model-photo-evaluation",
    strategyType: "education",
    funnelStage: "top",
    merchantJob: "Choose how to create on-model PDP images before launch.",
    messageAngle:
      "Help merchants frame AI photo selection around launch risk and product accuracy.",
    proofAngle:
      "Use Shopify workflow context and show evaluation criteria merchants can apply.",
    strategyEvidence: [
      "Brand Profile: Tiny Lemon targets Shopify fashion merchants.",
      "Research source: Shopify guidance supports app-led merchant workflows.",
    ],
    whyThisStrategy:
      "Builds category understanding before a merchant starts comparing products.",
    targetMerchantPain:
      "Choosing a tool without misrepresenting products or slowing catalog launches.",
    shopifySpecificAngle: "Shopify apparel PDP image workflow",
    whyNow: "AI image tooling is now cheap enough for small catalogs.",
    searchIntent: "Commercial investigation",
    contentGap: "Practical evaluation workflow for Shopify apparel teams.",
    suggestedCtaAngle: "Try Tiny Lemon on a few SKUs.",
    sourceLinks: ["https://example.com/source"],
    score: 90,
    ...overrides,
  });
}
