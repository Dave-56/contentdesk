import "@/lib/load-env";

import { schedules } from "@trigger.dev/sdk";
import { runRedditOpportunityScout } from "@/lib/reddit-opportunities";

export const redditOpportunityScout = schedules.task({
  id: "reddit-opportunity-scout",
  cron: {
    pattern: "0 8-20/2 * * *",
    timezone: "America/Los_Angeles",
    environments: ["PRODUCTION"],
  },
  run: async () => runRedditOpportunityScout(),
});
