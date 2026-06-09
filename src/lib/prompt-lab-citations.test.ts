import test from "node:test";
import assert from "node:assert/strict";
import {
  parseRawAnswerCitationMarkers,
  sourceRefsForDisplay,
  type PromptLabSourceCitation,
} from "@/lib/prompt-lab-citations";

const sources: PromptLabSourceCitation[] = [
  {
    url: "https://polamarketing.com/article",
    domain: "polamarketing.com",
    sourceFormat: "blog_guide",
    citationQuality: "earned_source",
  },
  {
    url: "https://wearview.co/guide",
    domain: "wearview.co",
    sourceFormat: "product_page",
    citationQuality: "unknown",
  },
];

test("links numeric raw markers to provider source order", () => {
  const refs = sourceRefsForDisplay(sources);
  const tokens = parseRawAnswerCitationMarkers("Use better product pages.[2][4]", refs);

  assert.deepEqual(tokens, [
    { type: "text", value: "Use better product pages." },
    { type: "marker", value: "[2]", index: 2, source: refs[1] },
    { type: "text", value: "[4]" },
  ]);
});

test("keeps punctuation outside citation marker links", () => {
  const refs = sourceRefsForDisplay(sources);
  const tokens = parseRawAnswerCitationMarkers("Source [1]. Next", refs);

  assert.deepEqual(tokens, [
    { type: "text", value: "Source " },
    { type: "marker", value: "[1]", index: 1, source: refs[0] },
    { type: "text", value: ". Next" },
  ]);
});

test("links duplicate markers to same source", () => {
  const refs = sourceRefsForDisplay(sources);
  const markers = parseRawAnswerCitationMarkers("[1] then [1]", refs).filter(
    (token) => token.type === "marker",
  );

  assert.equal(markers.length, 2);
  assert.equal(markers[0].source.url, refs[0].url);
  assert.equal(markers[1].source.url, refs[0].url);
});

test("leaves malformed markers as plain text", () => {
  const refs = sourceRefsForDisplay(sources);
  const tokens = parseRawAnswerCitationMarkers("[abc] [] [01] [0]", refs);

  assert.deepEqual(tokens, [{ type: "text", value: "[abc] [] [01] [0]" }]);
});

test("drops invalid source urls and de-dupes by normalized url", () => {
  const refs = sourceRefsForDisplay([
    ...sources,
    {
      url: "not-a-url",
      domain: "broken.example",
      sourceFormat: "unknown",
      citationQuality: "unknown",
    },
    sources[0],
  ]);

  assert.equal(refs.length, 2);
  assert.equal(refs[0].url, "https://polamarketing.com/article");
});

test("normalizes null or missing source citations to empty list", () => {
  assert.deepEqual(sourceRefsForDisplay(null), []);
  assert.deepEqual(sourceRefsForDisplay(undefined), []);
});
