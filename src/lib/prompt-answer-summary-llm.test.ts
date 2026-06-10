import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSummaryPrompt,
  generateSmartSummary,
} from "@/lib/prompt-answer-summary-llm";
import type { AnswerSignal } from "@/lib/prompt-scan/schemas";

const absentSignal: AnswerSignal = {
  brandPresence: "absent",
  brandCitations: [],
  brandRecommendation: "absent",
  brandRank: null,
  recommendationPosition: null,
  sentiment: "neutral",
  quote: null,
  confidence: "high",
  competitorSignals: [],
};

test("buildSummaryPrompt carries question, brand, and computed verdict", () => {
  const prompt = buildSummaryPrompt({
    question: "What are the best alternatives to Botika?",
    brandName: "Tiny Lemon",
    rawAnswer: "Claid, FASHN, and Modelia are the strongest options.",
    group: "competitor_comparison",
    answerSignal: absentSignal,
  });

  assert.match(prompt, /Best alternatives to Botika|alternatives to Botika/i);
  assert.match(prompt, /Tiny Lemon/);
  assert.match(prompt, /competitor comparison/);
  assert.match(prompt, /absent from this answer/);
  assert.match(prompt, /Claid, FASHN, and Modelia/);
});

test("generateSmartSummary returns the model takeaway when available", async () => {
  const summary = await generateSmartSummary({
    question: "What are the best alternatives to Botika?",
    brandName: "Tiny Lemon",
    rawAnswer: "Claid, FASHN, and Modelia lead for flat-lay to studio conversion.",
    apiKey: "test-key",
    answerSignal: absentSignal,
    runSummary: async () =>
      "Engine names Claid, FASHN, and Modelia as top picks. Tiny Lemon is absent.",
  });

  assert.equal(
    summary,
    "Engine names Claid, FASHN, and Modelia as top picks. Tiny Lemon is absent.",
  );
});

test("generateSmartSummary falls back to extraction without an api key", async () => {
  const summary = await generateSmartSummary({
    question: "What are the best alternatives to Botika?",
    brandName: "Tiny Lemon",
    rawAnswer:
      "You should consider Claid because it is the best option for flat-lay conversion.",
    apiKey: "",
  });

  assert.match(summary, /Claid/);
});

test("generateSmartSummary falls back when the model call throws", async () => {
  const summary = await generateSmartSummary({
    question: "What are the best alternatives to Botika?",
    brandName: "Tiny Lemon",
    rawAnswer:
      "You should consider Claid because it is the best option for flat-lay conversion.",
    apiKey: "test-key",
    runSummary: async () => {
      throw new Error("boom");
    },
  });

  assert.match(summary, /Claid/);
});
