import test from "node:test";
import assert from "node:assert/strict";
import { summarizePromptAnswer } from "@/lib/prompt-answer-summary";

test("summarizes raw prompt answers without truncating mid-thought", () => {
  const summary = summarizePromptAnswer(
    "An indie fashion brand on Shopify can get stronger apparel photos without a full shoot budget by combining DIY flat lays / phone shots, free or low-cost editing, and AI background or lifestyle-image tools to turn simple product photos into polished catalog images. The most practical low-budget workflow is: shoot simple source images yourself with a smartphone in bright, even light and a clean background; use inexpensive DIY setup tools such as a white foam board or a clean neutral surface to create a more professional look without renting a studio.",
  );

  assert.equal(
    summary,
    "Combine DIY flat lays / phone shots, free/low-cost editing, and AI background/lifestyle tools to turn source photos into catalog-ready images. Shoot source images with a phone and bright light with a clean background.",
  );
  assert.ok(!summary.endsWith("..."));
});
