import "@/lib/load-env";

import { schedules, task } from "@trigger.dev/sdk";
import { z } from "zod";
import { runRedditOpportunityScout } from "@/lib/reddit-opportunities";

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
  run: async (payload: RedditOpportunityScoutPayload = {}) =>
    runRedditOpportunityScout(redditOpportunityScoutPayloadSchema.parse(payload)),
});
