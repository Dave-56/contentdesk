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

export const redditOpportunityScout = schedules.task({
  id: "reddit-opportunity-scout",
  cron: {
    pattern: "0 8-20/2 * * *",
    timezone: "America/Los_Angeles",
    environments: ["PRODUCTION"],
  },
  run: async () => runRedditOpportunityScout(),
});

export const redditOpportunityScoutNow = task({
  id: "reddit-opportunity-scout-now",
  run: async (payload: RedditOpportunityScoutPayload = {}) =>
    runRedditOpportunityScout(redditOpportunityScoutPayloadSchema.parse(payload)),
});
