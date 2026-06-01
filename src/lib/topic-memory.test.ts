import assert from "node:assert/strict";
import test from "node:test";

import {
  formatRecentTopicStrategyMemory,
  topicMemoryItemsFromRows,
  type TopicMemoryRow,
} from "@/lib/topic-memory";

test("topic memory summarizes recent fingerprints and approval status", () => {
  const rows: TopicMemoryRow[] = [
    topicMemoryRow({
      cycleId: "cycle_1",
      approvedTitle: "Flat lay to launch assets",
      topics: [
        topicPayload({
          workingTitle: "Flat lay to launch assets",
          strategicFingerprint: "flat-lay-to-launch-assets",
        }),
        topicPayload({
          workingTitle: "AI vs photoshoot comparison",
          strategicFingerprint: "ai-vs-photoshoot-comparison",
          strategyType: "comparison",
        }),
      ],
    }),
    topicMemoryRow({
      cycleId: "cycle_2",
      topics: [
        topicPayload({
          workingTitle: "Flat lay launch workflow",
          strategicFingerprint: "flat-lay-to-launch-assets",
        }),
      ],
    }),
  ];

  const memory = topicMemoryItemsFromRows(rows);
  const summary = formatRecentTopicStrategyMemory(memory);

  assert.equal(memory.length, 3);
  assert.equal(memory[0]?.approved, true);
  assert.match(summary, /flat-lay-to-launch-assets: proposed 2 times recently; approved 1 time/);
  assert.match(summary, /AI vs photoshoot comparison/);
});

function topicMemoryRow(input: {
  cycleId: string;
  topics: unknown[];
  approvedTitle?: string;
}): TopicMemoryRow {
  const approvedTopic = input.approvedTitle
    ? input.topics.find(
        (topic) =>
          typeof topic === "object" &&
          topic !== null &&
          "workingTitle" in topic &&
          topic.workingTitle === input.approvedTitle,
      )
    : null;

  return {
    content_cycle_id: input.cycleId,
    status: "awaiting_approval",
    topics: input.topics,
    approved_topic: approvedTopic ?? null,
  };
}

function topicPayload(input: {
  workingTitle: string;
  strategicFingerprint: string;
  strategyType?: "education" | "workflow" | "comparison";
}) {
  return {
    topic: input.workingTitle,
    workingTitle: input.workingTitle,
    strategicFingerprint: input.strategicFingerprint,
    strategyType: input.strategyType ?? "workflow",
    funnelStage: "middle",
    merchantJob: "Turn product photos into launch-ready Shopify assets.",
    messageAngle: "Frame the article around reducing launch risk.",
    proofAngle: "Use Shopify workflow context and practical criteria.",
    strategyEvidence: [
      "Brand Profile: Tiny Lemon targets Shopify fashion merchants.",
      "Research source: Shopify guidance supports merchant workflows.",
    ],
    whyThisStrategy: "This topic supports a practical merchant workflow.",
    targetMerchantPain: "Merchants need repeatable launch asset workflows.",
    shopifySpecificAngle: "Shopify apparel PDP image workflow.",
    whyNow: "Small teams need faster catalog launches.",
    searchIntent: "Workflow search",
    contentGap: "Practical Shopify-specific launch workflow.",
    suggestedCtaAngle: "Try Tiny Lemon on a few SKUs.",
    sourceLinks: ["https://example.com/source"],
    score: 80,
  };
}
