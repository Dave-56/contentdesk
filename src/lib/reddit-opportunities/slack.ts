import type { SlackAction } from "@/lib/schemas";
import type { RedditOpportunityRecord } from "@/lib/reddit-opportunities/schemas";

export function redditOpportunityBlocks(opportunity: RedditOpportunityRecord) {
  const markRepliedAction: SlackAction = {
    action: "mark_reddit_replied",
    opportunityId: opportunity.id,
  };
  const skipAction: SlackAction = {
    action: "skip_reddit_opportunity",
    opportunityId: opportunity.id,
  };

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Reddit opportunity · ${capitalize(opportunity.fit)} fit*`,
          `r/${opportunity.subreddit}`,
          `*${escapeMrkdwn(opportunity.title)}*`,
          `Score: *${opportunity.score}* · Mention: *${opportunity.mentionRecommendation.replace("_", " ")}*`,
        ].join("\n"),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*Why surfaced:*",
          ...bullets(opportunity.whySurfaced),
          "",
          `*Tiny Lemon fit:*\n${escapeMrkdwn(opportunity.tinyLemonFit)}`,
          "",
          `*Promo risk:*\n${escapeMrkdwn(opportunity.promoRisk)}`,
          "",
          `*Suggested angle:*\n${escapeMrkdwn(opportunity.suggestedAngle)}`,
        ].join("\n"),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Draft:*\n\`\`\`\n${opportunity.draftReply}\n\`\`\``,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open post" },
          url: opportunity.url,
          action_id: "open_reddit_post",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Mark replied" },
          style: "primary",
          action_id: "mark_reddit_replied",
          value: JSON.stringify(markRepliedAction),
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Skip" },
          action_id: "skip_reddit_opportunity",
          value: JSON.stringify(skipAction),
        },
      ],
    },
  ];
}

function bullets(items: string[]) {
  return items.length ? items.map((item) => `- ${escapeMrkdwn(item)}`) : ["- Manual review needed."];
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function escapeMrkdwn(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
