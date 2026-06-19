import "@/lib/load-env";

import { schedules, task } from "@trigger.dev/sdk";
import { z } from "zod";
import { runRedditOpportunityScout } from "@/lib/reddit-opportunities";
import { postManagerMessage } from "@/lib/slack";

const redditOpportunityScoutPayloadSchema = z.object({
  channelId: z.string().min(1).optional(),
  subreddits: z.array(z.string().min(1)).optional(),
  searchQueries: z.array(z.string().min(1)).optional(),
  maxPostsPerSubreddit: z.number().int().positive().max(100).optional(),
});

export type RedditOpportunityScoutPayload = z.infer<
  typeof redditOpportunityScoutPayloadSchema
>;

// Scout runs ~23 sequential RSS fetches plus one AI call per classified post,
// so it needs far more than the global 300s maxDuration.
const SCOUT_MAX_DURATION_SECONDS = 1800;

export const redditOpportunityScout = schedules.task({
  id: "reddit-opportunity-scout",
  maxDuration: SCOUT_MAX_DURATION_SECONDS,
  cron: {
    pattern: "0 8-20/2 * * *",
    timezone: "America/Los_Angeles",
    environments: ["PRODUCTION"],
  },
  run: async () => runRedditOpportunityScout(),
});

export const redditOpportunityScoutNow = task({
  id: "reddit-opportunity-scout-now",
  maxDuration: SCOUT_MAX_DURATION_SECONDS,
  run: async (payload: RedditOpportunityScoutPayload = {}) => {
    const input = redditOpportunityScoutPayloadSchema.parse(payload);

    try {
      const summary = await runRedditOpportunityScout(input);
      await postRedditScoutCompletion(input.channelId, summary);

      return summary;
    } catch (error) {
      await postRedditScoutFailure(input.channelId, error);
      throw error;
    }
  },
});

type RedditScoutSummary = Awaited<ReturnType<typeof runRedditOpportunityScout>>;

async function postRedditScoutCompletion(
  channelId: string | undefined,
  summary: RedditScoutSummary,
) {
  if (!channelId) return;

  const errors = summary.errors.slice(0, 6);
  const errorText = errors.length
    ? `\nErrors:\n${errors.map((error) => `- ${error}`).join("\n")}`
    : "";

  await postManagerMessage({
    channelId,
    text: [
      "Reddit Radar run complete.",
      `Fetched: ${summary.fetched}`,
      `Candidates: ${summary.candidates}`,
      `Prefilter: ${summary.prefilterMode}`,
      `Classified: ${summary.classified}`,
      `Stored: ${summary.stored}`,
      `Surfaced: ${summary.surfaced}`,
      `Skipped: ${summary.skipped}`,
      `Known: ${summary.alreadyKnown}`,
      `Rejected: ${summary.alreadyRejected}`,
      `Errors: ${summary.errors.length}`,
      errorText,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

async function postRedditScoutFailure(channelId: string | undefined, error: unknown) {
  if (!channelId) return;

  await postManagerMessage({
    channelId,
    text: `Reddit Radar run failed: ${error instanceof Error ? error.message : String(error)}`,
  }).catch((slackError: unknown) => {
    console.error(
      "Failed to post Reddit Radar failure summary:",
      slackError instanceof Error ? slackError.message : slackError,
    );
  });
}
