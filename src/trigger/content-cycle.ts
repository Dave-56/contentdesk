import "@/lib/load-env";

import { task } from "@trigger.dev/sdk";
import {
  runContentCycleKickoff,
  runDirectArticleRequest,
  type ContentCyclePayload,
} from "@/lib/workflow";
import { parseContentDeskCommand } from "@/lib/slack-command";
import { postManagerMessage } from "@/lib/slack";
import { runRedditTeardown } from "@/lib/reddit-teardown";
import {
  renderRecommendationCard,
  renderManualPrompts,
  renderRedditReplyDraft,
  renderResearchPacket,
} from "@/lib/reddit-teardown/renderer";
import { buildRecommendationCardFromTeardown } from "@/lib/recommendation";

export const contentCycle = task({
  id: "content-cycle",
  run: async (payload: ContentCyclePayload) => {
    const parsedCommand = parseContentDeskCommand(payload.commandText ?? "");
    if (parsedCommand.mode === "reddit-teardown") {
      if (!parsedCommand.websiteUrl) {
        await postManagerMessage({
          channelId: payload.channelId,
          text: "Please include a public website URL, like `/contentdesk reddit-teardown https://example.com`.",
        });
        return { mode: "reddit-teardown", ok: false };
      }

      await postManagerMessage({
        channelId: payload.channelId,
        text: `Working on a Reddit teardown packet for ${parsedCommand.websiteUrl}...`,
      });

      const packet = await runRedditTeardown({ websiteUrl: parsedCommand.websiteUrl });
      await postManagerMessage({
        channelId: payload.channelId,
        text: renderResearchPacket(packet),
      });
      await postManagerMessage({
        channelId: payload.channelId,
        text: renderManualPrompts(packet),
      });
      await postManagerMessage({
        channelId: payload.channelId,
        text: renderRecommendationCard(buildRecommendationCardFromTeardown(packet)),
      });
      await postManagerMessage({
        channelId: payload.channelId,
        text: renderRedditReplyDraft(packet),
      });

      return { mode: "reddit-teardown", ok: true };
    }

    if (parsedCommand.mode === "article" && parsedCommand.idea) {
      return runDirectArticleRequest(payload, { idea: parsedCommand.idea });
    }

    return runContentCycleKickoff(payload);
  },
});
