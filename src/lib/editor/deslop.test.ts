import assert from "node:assert/strict";
import test from "node:test";
import { rewriteViolation } from "@/lib/editor/deslop";
import { withCitationBlockers } from "@/lib/editor/seo-qa";
import type { QaBlockerIssue, QAReport } from "@/lib/schemas";

const originalMarkdown = [
  "# How to fix slow product pages",
  "",
  "Slow product pages cost conversions. In today's fast-paced digital landscape, merchants need to act.",
  "",
  "## Diagnose the slowdown",
  "",
  "Start with [PageSpeed Insights](https://pagespeed.web.dev/) and your theme.",
  "",
  "## Fix the biggest offenders",
  "",
  "Compress images and remove unused apps.",
].join("\n");

test("rewriteViolation accepts a sentence-level rewrite", () => {
  const rewritten = originalMarkdown.replace(
    "In today's fast-paced digital landscape, merchants need to act.",
    "Merchants feel it directly in checkout numbers.",
  );

  assert.equal(rewriteViolation(originalMarkdown, rewritten), "");
});

test("rewriteViolation rejects changed headings", () => {
  const rewritten = originalMarkdown.replace(
    "## Diagnose the slowdown",
    "## Find the slowdown",
  );

  assert.match(rewriteViolation(originalMarkdown, rewritten), /headings/i);
});

test("rewriteViolation rejects dropped URLs", () => {
  const rewritten = originalMarkdown.replace(
    "[PageSpeed Insights](https://pagespeed.web.dev/)",
    "PageSpeed Insights",
  );

  assert.match(rewriteViolation(originalMarkdown, rewritten), /dropped URLs/i);
});

test("rewriteViolation rejects a heavily shrunken article", () => {
  const rewritten = [
    "# How to fix slow product pages",
    "## Diagnose the slowdown",
    "https://pagespeed.web.dev/",
    "## Fix the biggest offenders",
  ].join("\n");

  assert.match(rewriteViolation(originalMarkdown, rewritten), /shrank/i);
});

test("withCitationBlockers flips a passing report and appends writer instructions", () => {
  const report = qaReportFixture();
  const citationBlockers: QaBlockerIssue[] = [
    citationBlocker("Shopify stores load 40% faster on average"),
    citationBlocker("90% of merchants uninstall slow apps"),
  ];

  const merged = withCitationBlockers(report, citationBlockers);

  assert.equal(merged.status, "needs_revision");
  assert.equal(merged.blockers.length, 2);
  assert.equal(merged.revisionInstructions.writer.length, 2);
  assert.match(merged.summary, /2 unsupported-claim blockers/);
});

test("withCitationBlockers returns the report unchanged when there are no issues", () => {
  const report = qaReportFixture();

  assert.equal(withCitationBlockers(report, []), report);
});

test("withCitationBlockers keeps distinct claims while deduping repeated findings", () => {
  const report = qaReportFixture();
  const repeated = citationBlocker("Shopify stores load 40% faster on average");

  const merged = withCitationBlockers(report, [
    repeated,
    citationBlocker("90% of merchants uninstall slow apps"),
    { ...repeated },
  ]);

  assert.equal(merged.blockers.length, 2);
});

function citationBlocker(claim: string): QaBlockerIssue {
  return {
    area: "sources",
    severity: "blocker",
    finding: `Draft states a factual claim that no approved research source supports: "${claim}"`,
    evidence: claim,
    instruction: `Remove this claim or rewrite it so it only says what an approved source excerpt supports: "${claim}". No source excerpt mentions it.`,
  };
}

function qaReportFixture(): QAReport {
  return {
    status: "pass",
    usedFallback: false,
    summary: "QA passed with 0 non-blocking notes.",
    blockers: [],
    niceToHaves: [],
    rubricScores: {
      shopifySpecificity: 4,
      merchantPain: 4,
      actionability: 4,
      claimSupport: 4,
      genericFillerAvoidance: 4,
      thinkingGapResolution: 4,
      appPositioning: 4,
      founderPublishConfidence: 4,
      visualUsefulness: 4,
    },
    revisionInstructions: {
      writer: [],
      visualProducer: [],
    },
  };
}
