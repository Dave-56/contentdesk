import assert from "node:assert/strict";
import test from "node:test";

import { buildResearchObjectives } from "@/lib/research/provider";
import type { BrandProfile } from "@/lib/schemas";

test("buildResearchObjectives includes a buyer-intent comparison objective", () => {
  const objectives = buildResearchObjectives(brandProfileFixture());
  const buyerIntentObjective = objectives.at(-1);

  assert.ok(buyerIntentObjective);
  assert.match(buyerIntentObjective.objective, /buyer-intent and comparison/i);
  assert.match(buyerIntentObjective.objective, /alternatives, versus, best-tools/i);
  assert.deepEqual(buyerIntentObjective.searchQueries, [
    "Jasper alternative Shopify",
    "Jasper vs Tiny Lemon",
    "AI on-model photos Shopify app comparison",
  ]);
});

test("buildResearchObjectives falls back to category comparison when competitors are missing", () => {
  const objectives = buildResearchObjectives({
    ...brandProfileFixture(),
    competitors: [],
  });
  const buyerIntentObjective = objectives.at(-1);

  assert.ok(buyerIntentObjective);
  assert.deepEqual(buyerIntentObjective.searchQueries, [
    "best Shopify apps for AI on-model photos",
    "how to choose AI on-model photos Shopify app",
    "AI on-model photos Shopify app comparison",
  ]);
});

function brandProfileFixture(): BrandProfile {
  return {
    appName: "Tiny Lemon",
    targetMerchant: "Shopify fashion merchants",
    positioning: "AI product photography workflow for Shopify apparel teams",
    featuresUseCases: ["AI on-model photos"],
    competitors: ["Jasper", "Booth AI"],
    preferredVoice: "practical",
    preferredVisuals: [],
    visualsToAvoid: [],
    forbiddenClaims: [],
    ctaStyle: "Invite readers to test a few SKUs",
    existingBlogDocsUrls: [],
  };
}
