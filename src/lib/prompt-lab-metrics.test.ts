import assert from "node:assert/strict";
import test from "node:test";
import { calculateDailyMetrics, type PromptLabEngineName, type PromptLabEngineStatus } from "@/lib/prompt-lab-store";

function row(input: {
  questionId: string;
  engine: PromptLabEngineName;
  status: PromptLabEngineStatus;
  brandMentioned?: boolean;
}) {
  const completed = input.status === "mentioned" || input.status === "missing";

  return {
    batch_id: "batch-1",
    brand_slug: "tinylemon-xyz",
    run_date: "2026-06-09",
    status: "completed" as const,
    question_id: input.questionId,
    engine: input.engine,
    engine_status: input.status,
    visibility_score: completed
      ? {
          brandMentioned: input.brandMentioned ?? input.status === "mentioned",
          brandCited: false,
          mentionPosition: "absent" as const,
          competitorsMentioned: [],
          competitorsCited: [],
          citationCount: 0,
          sourceStrength: "weak" as const,
          score: 0,
        }
      : null,
    answer_signal: null,
    competitor_signals: null,
    citations: null,
  };
}

test("reruns of the same question and engine count as extra samples", () => {
  const metrics = calculateDailyMetrics([
    row({ questionId: "q1", engine: "ChatGPT", status: "missing" }),
    row({ questionId: "q1", engine: "ChatGPT", status: "mentioned" }),
    row({ questionId: "q2", engine: "ChatGPT", status: "missing" }),
  ]);

  assert.equal(metrics.completedAnswerCount, 3);
  assert.equal(metrics.brandMentionedCount, 1);
  assert.equal(metrics.visibilityPct, 33.33);
});

test("an error followed by a completed rerun is not a failure", () => {
  const metrics = calculateDailyMetrics([
    row({ questionId: "q1", engine: "Perplexity", status: "error" }),
    row({ questionId: "q1", engine: "Perplexity", status: "mentioned" }),
  ]);

  assert.equal(metrics.failedAnswerCount, 0);
  assert.equal(metrics.completedAnswerCount, 1);
  assert.equal(metrics.brandMentionedCount, 1);
});

test("a pair with only errors counts as one failure", () => {
  const metrics = calculateDailyMetrics([
    row({ questionId: "q1", engine: "Gemini", status: "error" }),
    row({ questionId: "q1", engine: "Gemini", status: "error" }),
    row({ questionId: "q2", engine: "Gemini", status: "missing" }),
  ]);

  assert.equal(metrics.failedAnswerCount, 1);
  assert.equal(metrics.completedAnswerCount, 1);
});

test("visibility falls back to engine status when score payload missing", () => {
  const noScore = {
    ...row({ questionId: "q1", engine: "ChatGPT", status: "mentioned" }),
    visibility_score: null,
  };
  const metrics = calculateDailyMetrics([noScore]);

  assert.equal(metrics.brandMentionedCount, 1);
  assert.equal(metrics.visibilityPct, 100);
});
