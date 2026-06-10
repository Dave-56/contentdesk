import assert from "node:assert/strict";
import test from "node:test";

import { slackActionSchema } from "@/lib/schemas";
import { deterministicPrefilter } from "@/lib/reddit-opportunities/classify";
import {
  dedupeRedditPosts,
  isFreshRedditPost,
  selectOpportunitiesToSurface,
} from "@/lib/reddit-opportunities";
import { subredditFromUrl } from "@/lib/reddit-opportunities/rss";
import { redditOpportunityBlocks } from "@/lib/reddit-opportunities/slack";
import type { RedditOpportunityRecord, RedditPost } from "@/lib/reddit-opportunities/schemas";

test("reddit prefilter matches product-photo terms and mute terms", () => {
  const post: RedditPost = {
    redditPostId: "abc123",
    subreddit: "shopify",
    title: "How do clothing stores get on-model product photos?",
    url: "https://www.reddit.com/r/shopify/comments/abc123/example/",
    publishedAt: "2026-06-09T12:00:00.000Z",
    content: "I have flat-lay supplier photos and want better Shopify images.",
  };

  const result = deterministicPrefilter({
    post,
    keywords: ["on-model", "flat-lay", "supplier photos"],
    muteTerms: ["fulfillment"],
  });

  assert.deepEqual(result, {
    matchedTerms: ["on-model", "flat-lay", "supplier photos"],
    muted: false,
    muteReason: "",
  });
});

test("reddit prefilter matches whole words, not substrings", () => {
  const post: RedditPost = {
    redditPostId: "def456",
    subreddit: "Entrepreneur",
    title: "What business models are old-fashioned in 2026?",
    url: "https://www.reddit.com/r/Entrepreneur/comments/def456/example/",
    publishedAt: "2026-06-09T12:00:00.000Z",
    content: "Nobody talks about catalog photos of success anymore.",
  };

  const result = deterministicPrefilter({
    post,
    keywords: ["model", "fashion", "catalog photos"],
    muteTerms: [],
  });

  assert.deepEqual(result.matchedTerms, ["model", "catalog photos"]);
});

test("reddit opportunity Slack blocks carry mark replied and skip actions", () => {
  const blocks = redditOpportunityBlocks(opportunityFixture());
  const values = JSON.stringify(blocks);

  assert.match(values, /mark_reddit_replied/);
  assert.match(values, /skip_reddit_opportunity/);
  assert.doesNotThrow(() =>
    slackActionSchema.parse({
      action: "mark_reddit_replied",
      opportunityId: "reddit_1",
    }),
  );
  assert.doesNotThrow(() =>
    slackActionSchema.parse({
      action: "skip_reddit_opportunity",
      opportunityId: "reddit_1",
    }),
  );
});

test("dedupeRedditPosts keeps first occurrence per reddit post id", () => {
  const base = postFixture();
  const posts = [
    base,
    { ...base, subreddit: "ecommerce" },
    { ...base, redditPostId: "other99" },
  ];

  const unique = dedupeRedditPosts(posts);

  assert.equal(unique.length, 2);
  assert.equal(unique[0].subreddit, "shopify");
  assert.equal(unique[1].redditPostId, "other99");
});

test("isFreshRedditPost filters by max age", () => {
  const now = new Date("2026-06-09T12:00:00.000Z");
  const fresh = { ...postFixture(), publishedAt: "2026-06-05T12:00:00.000Z" };
  const stale = { ...postFixture(), publishedAt: "2026-05-20T12:00:00.000Z" };

  assert.equal(isFreshRedditPost(fresh, 7, now), true);
  assert.equal(isFreshRedditPost(stale, 7, now), false);
});

test("selectOpportunitiesToSurface merges stored and pending, dedupes, sorts, caps", () => {
  const stored = [
    { ...opportunityFixture(), id: "reddit_1", score: 70 },
    { ...opportunityFixture(), id: "reddit_2", score: 90, status: "skipped" as const },
  ];
  const pending = [
    { ...opportunityFixture(), id: "reddit_1", score: 70 },
    { ...opportunityFixture(), id: "reddit_3", score: 85, fit: "medium" as const },
    { ...opportunityFixture(), id: "reddit_4", score: 60 },
  ];

  const selected = selectOpportunitiesToSurface({ stored, pending, max: 2 });

  assert.deepEqual(
    selected.map((opportunity) => opportunity.id),
    ["reddit_3", "reddit_1"],
  );
});

test("selectOpportunitiesToSurface picks up pending rows when nothing was stored", () => {
  const pending = [{ ...opportunityFixture(), id: "reddit_5", score: 80 }];

  const selected = selectOpportunitiesToSurface({ stored: [], pending, max: 8 });

  assert.deepEqual(
    selected.map((opportunity) => opportunity.id),
    ["reddit_5"],
  );
});

test("subredditFromUrl extracts subreddit from post urls", () => {
  assert.equal(
    subredditFromUrl("https://www.reddit.com/r/printondemand/comments/xyz789/example/"),
    "printondemand",
  );
  assert.equal(subredditFromUrl("https://www.reddit.com/user/someone/comments/abc/"), "");
});

function postFixture(): RedditPost {
  return {
    redditPostId: "abc123",
    subreddit: "shopify",
    title: "How do clothing stores get on-model product photos?",
    url: "https://www.reddit.com/r/shopify/comments/abc123/example/",
    publishedAt: "2026-06-09T12:00:00.000Z",
    content: "I have flat-lay supplier photos and want better Shopify images.",
  };
}

function opportunityFixture(): RedditOpportunityRecord {
  return {
    id: "reddit_1",
    redditPostId: "abc123",
    subreddit: "shopify",
    title: "How do clothing stores get on-model product photos?",
    url: "https://www.reddit.com/r/shopify/comments/abc123/example/",
    publishedAt: "2026-06-09T12:00:00.000Z",
    matchedTerms: ["on-model", "product photos"],
    fit: "strong",
    score: 92,
    whySurfaced: ["Shopify/apparel context"],
    tinyLemonFit: "tinylemon fits this image workflow.",
    promoRisk: "Medium.",
    suggestedAngle: "Answer source photo quality first.",
    mentionRecommendation: "mention",
    draftReply: "First check the source photo quality. I’m connected to tinylemon.",
    status: "new",
    slackChannelId: null,
    slackMessageTs: null,
    createdAt: "2026-06-09T12:00:00.000Z",
    updatedAt: "2026-06-09T12:00:00.000Z",
  };
}
