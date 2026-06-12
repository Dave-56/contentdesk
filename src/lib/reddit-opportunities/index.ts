import {
  redditScoutKeywords,
  redditScoutMuteTerms,
  redditScoutSearchQueries,
  redditScoutSubreddits,
  tinyLemonRedditConfig,
} from "@/lib/reddit-opportunities/config";
import {
  aiPrefilterRedditPosts,
  classifyRedditOpportunity,
  deterministicPrefilter,
} from "@/lib/reddit-opportunities/classify";
import {
  fetchRedditSearchRss,
  fetchSubredditRss,
  type RedditFeedSort,
} from "@/lib/reddit-opportunities/rss";
import { redditOpportunityBlocks } from "@/lib/reddit-opportunities/slack";
import {
  listKnownRedditPostIds,
  listPendingRedditOpportunities,
  listRedditOpportunityMutes,
  listRejectedRedditPostIds,
  markRedditOpportunitySurfaced,
  recordRedditPrefilterVerdicts,
  upsertRedditOpportunity,
} from "@/lib/reddit-opportunities/repository";
import type {
  RedditOpportunityMute,
  RedditOpportunityRecord,
  RedditPost,
} from "@/lib/reddit-opportunities/schemas";
import { postManagerMessage } from "@/lib/slack";

export async function runRedditOpportunityScout(input: {
  channelId?: string;
  subreddits?: string[];
  searchQueries?: string[];
  maxPostsPerSubreddit?: number;
} = {}) {
  const channelId = input.channelId ?? process.env.CONTENTDESK_REDDIT_CHANNEL_ID;
  const subreddits = input.subreddits ?? redditScoutSubreddits();
  const searchQueries = input.searchQueries ?? redditScoutSearchQueries();
  const keywords = redditScoutKeywords();
  const muteTerms = redditScoutMuteTerms();
  const limit = input.maxPostsPerSubreddit ?? tinyLemonRedditConfig.maxPostsPerSubreddit;
  const dbMutes = await listRedditOpportunityMutes();
  const summary = {
    fetched: 0,
    candidates: 0,
    alreadyKnown: 0,
    alreadyRejected: 0,
    prefilterMode: "deterministic" as "ai" | "deterministic",
    classified: 0,
    stored: 0,
    surfaced: 0,
    resurfaced: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // Gather: per-subreddit feeds (new + rising) plus Reddit-wide search feeds.
  // Sequential on purpose — unauthenticated RSS rate limits are unforgiving.
  const gathered: RedditPost[] = [];
  for (const subreddit of subreddits) {
    for (const sort of tinyLemonRedditConfig.feedSorts as readonly RedditFeedSort[]) {
      const posts = await fetchSubredditRss({ subreddit, sort, limit }).catch((error: unknown) => {
        summary.errors.push(error instanceof Error ? error.message : String(error));
        return [];
      });
      gathered.push(...posts);
    }
  }
  for (const query of searchQueries) {
    const posts = await fetchRedditSearchRss({ query, limit }).catch((error: unknown) => {
      summary.errors.push(error instanceof Error ? error.message : String(error));
      return [];
    });
    gathered.push(...posts);
  }
  summary.fetched = gathered.length;

  // Narrow to fresh, unseen, unmuted posts before spending AI calls.
  const unique = dedupeRedditPosts(gathered).filter((post) =>
    isFreshRedditPost(post, tinyLemonRedditConfig.maxPostAgeDays),
  );
  const knownIds = await listKnownRedditPostIds(unique.map((post) => post.redditPostId));
  summary.alreadyKnown = unique.filter((post) => knownIds.has(post.redditPostId)).length;
  // Posts the AI gate already rejected stay rejected — judged once, not every run.
  const rejectedIds = await listRejectedRedditPostIds(
    unique.map((post) => post.redditPostId),
  ).catch((error: unknown) => {
    summary.errors.push(error instanceof Error ? error.message : String(error));
    return new Set<string>();
  });

  const candidates: Array<{ post: RedditPost; matchedTerms: string[] }> = [];
  for (const post of unique) {
    if (knownIds.has(post.redditPostId)) continue;
    if (rejectedIds.has(post.redditPostId)) {
      summary.alreadyRejected += 1;
      continue;
    }
    if (isMutedByDatabase(post, dbMutes)) {
      summary.skipped += 1;
      continue;
    }

    const prefilter = deterministicPrefilter({ post, keywords, muteTerms });
    if (prefilter.muted) {
      summary.skipped += 1;
      continue;
    }
    candidates.push({ post, matchedTerms: prefilter.matchedTerms });
  }
  const capped = candidates.slice(0, tinyLemonRedditConfig.maxPrefilterPostsPerRun);
  if (capped.length < candidates.length) {
    summary.errors.push(
      `Prefilter cap dropped ${candidates.length - capped.length} posts this run`,
    );
  }
  summary.candidates = capped.length;

  // AI gate judges intent; keyword match is only the fallback when the gate
  // is unavailable (no credentials) or fails outright.
  const verdicts = await aiPrefilterRedditPosts({
    posts: capped.map((candidate) => candidate.post),
  }).catch((error: unknown) => {
    console.error(
      "Reddit Radar AI prefilter failed; using deterministic keyword fallback:",
      error instanceof Error ? error.message : error,
    );
    summary.errors.push("AI prefilter failed; deterministic fallback used");
    return null;
  });
  summary.prefilterMode = verdicts ? "ai" : "deterministic";

  if (verdicts) {
    await recordRedditPrefilterVerdicts(
      capped.flatMap(({ post }) => {
        const verdict = verdicts.get(post.redditPostId);
        return verdict ? [{ post, relevant: verdict.relevant, reason: verdict.reason }] : [];
      }),
    ).catch((error: unknown) => {
      summary.errors.push(error instanceof Error ? error.message : String(error));
    });
  }

  const allRelevant = capped.filter(({ post, matchedTerms }) => {
    const verdict = verdicts?.get(post.redditPostId);
    if (verdict) return verdict.relevant;
    return matchedTerms.length > 0;
  });
  summary.skipped += capped.length - allRelevant.length;

  // Classification is sequential AI calls; cap them so one run stays inside
  // the task maxDuration. Uncapped posts stay unstored and re-enter next run.
  const relevant = allRelevant.slice(0, tinyLemonRedditConfig.maxClassifiedPerRun);
  if (relevant.length < allRelevant.length) {
    summary.errors.push(
      `Classification cap deferred ${allRelevant.length - relevant.length} posts to a later run`,
    );
  }

  const storedOpportunities: RedditOpportunityRecord[] = [];
  for (const { post, matchedTerms } of relevant) {
    const classification = await classifyRedditOpportunity({ post, matchedTerms });
    summary.classified += 1;
    const opportunity = await upsertRedditOpportunity({
      post,
      classification,
      status: classification.fit === "skip" ? "skipped" : "new",
    });
    summary.stored += 1;
    storedOpportunities.push(opportunity);
  }

  if (channelId) {
    // Rows can be left `new` by earlier runs (surfacing failed, or caps cut
    // the run short); pick those up alongside this run's stores so they are
    // never stranded.
    const pending = await listPendingRedditOpportunities(
      tinyLemonRedditConfig.maxSurfacedPerRun,
    ).catch((error: unknown) => {
      summary.errors.push(error instanceof Error ? error.message : String(error));
      return [];
    });
    const storedIds = new Set(storedOpportunities.map((opportunity) => opportunity.id));
    const toSurface = selectOpportunitiesToSurface({
      stored: storedOpportunities,
      pending,
      max: tinyLemonRedditConfig.maxSurfacedPerRun,
    });

    for (const opportunity of toSurface) {
      const surfaced = await surfaceOpportunity({ opportunity, channelId });
      if (!surfaced) continue;
      summary.surfaced += 1;
      if (!storedIds.has(opportunity.id)) summary.resurfaced += 1;
    }

    if (summary.surfaced === 0) {
      await postManagerMessage({
        channelId,
        text: `Reddit radar: nothing relevant this run — ${summary.fetched} posts fetched, ${summary.candidates} candidates, ${summary.classified} classified, none worth surfacing.`,
      });
    }
  }

  return summary;
}

export function selectOpportunitiesToSurface(input: {
  stored: RedditOpportunityRecord[];
  pending: RedditOpportunityRecord[];
  max: number;
}) {
  const seen = new Set<string>();

  return [...input.stored, ...input.pending]
    .filter((opportunity) => {
      if (!shouldSurface(opportunity) || seen.has(opportunity.id)) return false;
      seen.add(opportunity.id);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.max);
}

export function dedupeRedditPosts(posts: RedditPost[]) {
  const seen = new Set<string>();

  return posts.filter((post) => {
    if (seen.has(post.redditPostId)) return false;
    seen.add(post.redditPostId);
    return true;
  });
}

export function isFreshRedditPost(post: RedditPost, maxAgeDays: number, now = new Date()) {
  const ageMs = now.getTime() - new Date(post.publishedAt).getTime();
  return ageMs <= maxAgeDays * 24 * 60 * 60 * 1000;
}

// Topical fit alone is not enough: a relevant thread where any product mention
// would read as vendor pitching (hiring posts, portfolio requests) stays stored
// for review but never becomes a Slack opportunity card.
function shouldSurface(opportunity: RedditOpportunityRecord) {
  return (
    opportunity.status === "new" &&
    (opportunity.fit === "strong" || opportunity.fit === "medium") &&
    opportunity.mentionRecommendation === "mention" &&
    opportunity.promoRiskLevel !== "high"
  );
}

async function surfaceOpportunity(input: {
  opportunity: RedditOpportunityRecord;
  channelId: string;
}) {
  const message = await postManagerMessage({
    channelId: input.channelId,
    text: `Reddit opportunity: ${input.opportunity.title}`,
    blocks: redditOpportunityBlocks(input.opportunity),
  });
  const updated = await markRedditOpportunitySurfaced({
    opportunityId: input.opportunity.id,
    slackChannelId: input.channelId,
    slackMessageTs: message.ts,
  });

  return Boolean(updated);
}

function isMutedByDatabase(post: RedditPost, mutes: RedditOpportunityMute[]) {
  const subreddit = post.subreddit.toLowerCase();
  const text = `${post.title} ${post.content}`.toLowerCase();

  return mutes.some((mute) => {
    const value = mute.value.toLowerCase();
    if (mute.scope === "subreddit") return subreddit === value.replace(/^r\//, "");

    return text.includes(value);
  });
}

export {
  markRedditOpportunityReplied,
  skipRedditOpportunity,
} from "@/lib/reddit-opportunities/repository";
