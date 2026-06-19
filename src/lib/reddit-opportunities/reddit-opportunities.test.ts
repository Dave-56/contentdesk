import assert from "node:assert/strict";
import test from "node:test";

import { slackActionSchema } from "@/lib/schemas";
import { deterministicPrefilter } from "@/lib/reddit-opportunities/classify";
import {
  dedupeRedditPosts,
  isFreshRedditPost,
  selectOpportunitiesToSurface,
} from "@/lib/reddit-opportunities";
import { fetchSubredditRss, subredditFromUrl } from "@/lib/reddit-opportunities/rss";
import { redditOpportunityBlocks } from "@/lib/reddit-opportunities/slack";
import {
  buildDeterministicDraft,
  tinyLemonRedditGrowthReplyRules,
} from "@/lib/reddit-opportunities/draft";
import type { RedditOpportunityRecord, RedditPost } from "@/lib/reddit-opportunities/schemas";

test("reddit prefilter matches product-photo terms and mute terms", () => {
  const post: RedditPost = {
    redditPostId: "abc123",
    subreddit: "shopify",
    author: "shopifymerchant",
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
    author: "founder101",
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

test("deterministic Reddit reply follows Tiny Lemon growth posture", () => {
  const draft = buildDeterministicDraft({
    post: postFixture(),
    matchedTerms: ["on-model", "flat-lay"],
    mention: true,
  });

  assert.match(draft, /customers use tinylemon/);
  assert.match(draft, /one SKU/);
  assert.doesNotMatch(draft, /\bTiny Lemon\b/);
  assert.doesNotMatch(draft, /I.?m connected|I.?m building|MVP|experimental/i);
});

test("deterministic Reddit reply omits tinylemon when mention is unsafe", () => {
  const draft = buildDeterministicDraft({
    post: postFixture(),
    matchedTerms: ["product photos"],
    mention: false,
  });

  assert.doesNotMatch(draft, /tinylemon/i);
});

test("Tiny Lemon Reddit growth rules block weak launch language", () => {
  assert.match(tinyLemonRedditGrowthReplyRules, /lowercase tinylemon/);
  assert.match(tinyLemonRedditGrowthReplyRules, /customers\/users\/merchants use it/);
  assert.match(tinyLemonRedditGrowthReplyRules, /Do not say I am building/);
});

test("dedupeRedditPosts keeps first occurrence per reddit post id", () => {
  const base = postFixture();
  const posts = [
    base,
    { ...base, subreddit: "ecommerce" },
    { ...base, redditPostId: "other99", title: "Different product photo question" },
  ];

  const unique = dedupeRedditPosts(posts);

  assert.equal(unique.length, 2);
  assert.equal(unique[0].subreddit, "shopify");
  assert.equal(unique[1].redditPostId, "other99");
});

test("dedupeRedditPosts collapses same-author crossposts with different ids", () => {
  const base = {
    ...postFixture(),
    author: "same_user",
    title: "Would you use this virtual try-on workflow?",
    content: "I built a virtual try-on workflow for clothing stores and want feedback.",
  };
  const posts = [
    { ...base, redditPostId: "abc123", subreddit: "fashiondesigner" },
    { ...base, redditPostId: "xyz789", subreddit: "ecommerce101" },
    { ...base, redditPostId: "keep99", author: "other_user" },
  ];

  const unique = dedupeRedditPosts(posts);

  assert.deepEqual(
    unique.map((post) => post.redditPostId),
    ["abc123", "keep99"],
  );
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

test("selectOpportunitiesToSurface drops unpromotable threads even with good fit", () => {
  const stored = [
    { ...opportunityFixture(), id: "reddit_6", score: 95, mentionRecommendation: "no_mention" as const },
    { ...opportunityFixture(), id: "reddit_7", score: 90, promoRiskLevel: "high" as const },
    { ...opportunityFixture(), id: "reddit_8", score: 40 },
  ];

  const selected = selectOpportunitiesToSurface({ stored, pending: [], max: 8 });

  assert.deepEqual(
    selected.map((opportunity) => opportunity.id),
    ["reddit_8"],
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

test("reddit fetcher uses OAuth JSON listing when credentials exist", async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.REDDIT_CLIENT_ID;
  const originalClientSecret = process.env.REDDIT_CLIENT_SECRET;
  const originalUserAgent = process.env.REDDIT_USER_AGENT;
  const requests: Array<{ url: string; headers: Headers }> = [];

  process.env.REDDIT_CLIENT_ID = "client_id";
  process.env.REDDIT_CLIENT_SECRET = "client_secret";
  process.env.REDDIT_USER_AGENT = "web:contentdesk-reddit-radar:test by u/example";

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, headers: new Headers(init?.headers) });

    if (url === "https://www.reddit.com/api/v1/access_token") {
      return new Response(JSON.stringify({ access_token: "token_123", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.startsWith("https://oauth.reddit.com/r/shopify/new.json")) {
      return new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  id: "abc123",
                  author: "shopifymerchant",
                  subreddit: "shopify",
                  title: "How do I improve apparel product photos?",
                  permalink: "/r/shopify/comments/abc123/example/",
                  created_utc: 1781006400,
                  selftext: "I have supplier photos and need better Shopify images.",
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response("unexpected request", { status: 500 });
  };

  try {
    const posts = await fetchSubredditRss({ subreddit: "shopify", sort: "new", limit: 1 });

    assert.equal(posts.length, 1);
    assert.equal(posts[0].redditPostId, "abc123");
    assert.equal(posts[0].author, "shopifymerchant");
    assert.equal(posts[0].url, "https://www.reddit.com/r/shopify/comments/abc123/example/");
    assert.equal(posts[0].content, "I have supplier photos and need better Shopify images.");
    assert.equal(requests[0].headers.get("authorization")?.startsWith("Basic "), true);
    assert.equal(requests[1].headers.get("authorization"), "Bearer token_123");
    assert.equal(requests[1].headers.get("user-agent"), process.env.REDDIT_USER_AGENT);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("REDDIT_CLIENT_ID", originalClientId);
    restoreEnv("REDDIT_CLIENT_SECRET", originalClientSecret);
    restoreEnv("REDDIT_USER_AGENT", originalUserAgent);
  }
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function postFixture(): RedditPost {
  return {
    redditPostId: "abc123",
    subreddit: "shopify",
    author: "shopifymerchant",
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
    content: "I have flat-lay supplier photos and want better Shopify images.",
    publishedAt: "2026-06-09T12:00:00.000Z",
    matchedTerms: ["on-model", "product photos"],
    fit: "strong",
    score: 92,
    whySurfaced: ["Shopify/apparel context"],
    tinyLemonFit: "tinylemon fits this image workflow.",
    promoRisk: "Medium.",
    promoRiskLevel: "medium",
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
