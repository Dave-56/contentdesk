import {
  redditScoutKeywords,
  redditScoutMuteTerms,
  redditScoutSubreddits,
  tinyLemonRedditConfig,
} from "@/lib/reddit-opportunities/config";
import {
  classifyRedditOpportunity,
  deterministicPrefilter,
} from "@/lib/reddit-opportunities/classify";
import { fetchSubredditRss } from "@/lib/reddit-opportunities/rss";
import { redditOpportunityBlocks } from "@/lib/reddit-opportunities/slack";
import {
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
  maxPostsPerSubreddit?: number;
} = {}) {
  const channelId = input.channelId ?? process.env.CONTENTDESK_REDDIT_CHANNEL_ID;
  const subreddits = input.subreddits ?? redditScoutSubreddits();
  const keywords = redditScoutKeywords();
  const muteTerms = redditScoutMuteTerms();
  const dbMutes = await listRedditOpportunityMutes();
  const summary = {
    fetched: 0,
    matched: 0,
    stored: 0,
    surfaced: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const subreddit of subreddits) {
    const posts = await fetchSubredditRss({
      subreddit,
      limit: input.maxPostsPerSubreddit ?? tinyLemonRedditConfig.maxPostsPerSubreddit,
    }).catch((error: unknown) => {
      summary.errors.push(error instanceof Error ? error.message : String(error));
      return [];
    });
    summary.fetched += posts.length;

    for (const post of posts) {
      if (isMutedByDatabase(post, dbMutes)) {
        summary.skipped += 1;
        continue;
      }

      const prefilter = deterministicPrefilter({ post, keywords, muteTerms });
      if (prefilter.muted || prefilter.matchedTerms.length === 0) {
        summary.skipped += 1;
        continue;
      }
      summary.matched += 1;

      const classification = await classifyRedditOpportunity({
        post,
        matchedTerms: prefilter.matchedTerms,
      });
      const opportunity = await upsertRedditOpportunity({
        post,
        classification,
        status: classification.fit === "skip" ? "skipped" : "new",
      });
      summary.stored += 1;

      if (!channelId || !shouldSurface(opportunity)) continue;

      const surfaced = await surfaceOpportunity({ opportunity, channelId });
      if (surfaced) summary.surfaced += 1;
    }
  }

  return summary;
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
