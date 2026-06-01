import assert from "node:assert/strict";
import test from "node:test";

import {
  imageGenerationSkipReason,
  shouldGenerateImage,
} from "@/lib/visual/image-generator";
import type { VisualPlanItem } from "@/lib/schemas";

test("image eligibility allows workflow visuals that mention avoided formats negatively", async () => {
  const visual = visualFixture({
    title: "Catalog consistency workflow from anchor set to collection-page review",
    purpose:
      "Show that keeping on-model apparel images aligned is a repeatable workflow for Shopify fashion teams.",
    altText: "Editorial workflow image for reviewing on-model apparel photos",
    instruction:
      "Create a clean editorial 4-step workflow image for indie Shopify fashion merchants. Use only 2-4 short labels: Anchor set, Style profile, Standardized inputs, Storefront review. Avoid tables, worksheet layouts, dense text, checklists, screenshots, and small labels.",
  });

  assert.equal(shouldGenerateImage(visual), true);
});

test("image eligibility allows Shopify collection grid context", async () => {
  const visual = visualFixture({
    title: "Visual system for consistent new-arrivals imagery",
    purpose:
      "Show model rules, styling profile, standardized gallery, and final review in both collection-grid and PDP contexts.",
    altText:
      "A four-step workflow showing consistent imagery across a collection grid and product page gallery.",
    instruction:
      "Create a clean editorial workflow image. Step 4 shows consistent imagery in a collection grid/new-arrivals row and a single PDP gallery context. Avoid tables, worksheet layouts, dense text, fake UI, and small labels.",
    visualStructure: "workflow_diagram",
  });

  assert.equal(shouldGenerateImage(visual), true);
});

test("image eligibility skips visuals whose actual concept is a checklist worksheet", async () => {
  const visual = visualFixture({
    title: "Apparel image evaluation checklist",
    purpose:
      "Turn the article's evaluation criteria into a scannable checklist worksheet merchants can use while testing tools.",
    altText: "Checklist worksheet for Shopify apparel image evaluation",
    instruction:
      "Create a checklist worksheet with 5 numbered sections, scoring rows, and test prompts.",
    renderMode: "markdown_block",
    textBudget: "text_heavy",
    visualStructure: "checklist",
  });

  assert.equal(shouldGenerateImage(visual), false);
  assert.match(imageGenerationSkipReason(visual), /checklist|worksheet|Markdown/i);
});

function visualFixture(overrides: Partial<VisualPlanItem>): VisualPlanItem {
  return {
    title: "Catalog workflow",
    placement: "The short answer",
    visualType: "hero",
    purpose: "Show a simple Shopify merchant workflow.",
    altText: "Editorial Shopify merchant workflow image",
    instruction: "Create a clean editorial workflow image.",
    markdownPlaceholder: "[Visual placeholder: catalog workflow]",
    renderMode: "generated_image",
    textBudget: "short_labels",
    visualStructure: "workflow_diagram",
    ...overrides,
  };
}
