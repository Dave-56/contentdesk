import assert from "node:assert/strict";
import { test } from "node:test";
import { engineFailureAlertText } from "@/lib/prompt-lab-alerts";
import type { PromptLabEngineFailureSummary } from "@/lib/prompt-lab-store";

function summary(input: Partial<PromptLabEngineFailureSummary>): PromptLabEngineFailureSummary {
  return {
    engine: "ChatGPT",
    brandSlug: "tinylemon-xyz",
    total: 11,
    failed: 0,
    sampleError: null,
    ...input,
  };
}

test("engineFailureAlertText returns null when every engine completed", () => {
  const text = engineFailureAlertText({
    runDate: "2026-06-12",
    engines: [
      summary({ engine: "ChatGPT" }),
      summary({ engine: "Gemini" }),
      summary({ engine: "Perplexity" }),
    ],
  });

  assert.equal(text, null);
});

test("engineFailureAlertText lists failing and healthy engines with the error", () => {
  const text = engineFailureAlertText({
    runDate: "2026-06-11",
    engines: [
      summary({
        engine: "ChatGPT",
        failed: 11,
        sampleError:
          'ChatGPT run failed. OpenAI request failed with 429: {\n  "error": { "type": "insufficient_quota" } }',
      }),
      summary({ engine: "Gemini" }),
      summary({ engine: "Perplexity" }),
    ],
  });

  assert.ok(text);
  assert.match(text, /⚠️ Prompt Lab engine failures · tinylemon-xyz · 2026-06-11/);
  assert.match(text, /❌ ChatGPT: 11\/11 failed — ChatGPT run failed\. OpenAI request failed with 429/);
  assert.match(text, /insufficient_quota/);
  assert.match(text, /✅ Gemini: 11\/11 ok/);
  assert.match(text, /✅ Perplexity: 11\/11 ok/);
  assert.match(text, /visibility denominator/);
  assert.ok(!text.includes("\n  "), "sample error should be flattened to one line");
});

test("engineFailureAlertText truncates long error messages", () => {
  const text = engineFailureAlertText({
    runDate: "2026-06-11",
    engines: [summary({ failed: 3, sampleError: "x".repeat(500) })],
  });

  assert.ok(text);
  const errorLine = text.split("\n").find((line) => line.startsWith("❌"));
  assert.ok(errorLine);
  assert.ok(errorLine.length < 250, `error line too long: ${errorLine.length}`);
  assert.match(errorLine, /…$/);
});

test("engineFailureAlertText alerts on partial engine failure", () => {
  const text = engineFailureAlertText({
    runDate: "2026-06-12",
    engines: [
      summary({ engine: "ChatGPT", failed: 2, sampleError: "timeout" }),
      summary({ engine: "Gemini" }),
    ],
  });

  assert.ok(text);
  assert.match(text, /❌ ChatGPT: 2\/11 failed — timeout/);
});
