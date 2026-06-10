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
  listRedditOpportunityMutes,
  markRedditOpportunitySurfaced,
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
    prefilterMode: "deterministic" as "ai" | "deterministic",
    classified: 0,
    stored: 0,
    surfaced: 0,
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

  const candidates: Array<{ post: RedditPost; matchedTerms: string[] }> = [];
  for (const post of unique) {
    if (knownIds.has(post.redditPostId)) continue;
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
    const toSurface = storedOpportunities
      .filter(shouldSurface)
      .sort((a, b) => b.score - a.score)
      .slice(0, tinyLemonRedditConfig.maxSurfacedPerRun);

    for (const opportunity of toSurface) {
      const surfaced = await surfaceOpportunity({ opportunity, channelId });
      if (surfaced) summary.surfaced += 1;
    }
  }

  return summary;
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

function shouldSurface(opportunity: RedditOpportunityRecord) {
  return (
    opportunity.status === "new" &&
    (opportunity.fit === "strong" || opportunity.fit === "medium")
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
