import "@/lib/load-env";

import { App, LogLevel } from "@slack/bolt";
import { tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  getArtifact,
  getOrCreateOrganization,
  getPrimaryBrandForOrganization,
  savePrimaryBrandProfile,
} from "@/lib/repository";
import {
  handleVisibilityRecommendationApproval,
  handlePublishKitApproval,
  handlePublishKitRejection,
  handleTopicApproval,
  runDirectArticleRequest,
  runContentCycleKickoff,
  runVisibilityRecommendationKickoff,
} from "@/lib/workflow";
import { runRedditTeardown } from "@/lib/reddit-teardown";
import {
  renderRecommendationCard,
  renderManualPrompts,
  renderRedditReplyDraft,
  renderResearchPacket,
} from "@/lib/reddit-teardown/renderer";
import { buildRecommendationCardFromTeardown } from "@/lib/recommendation";
import { parseContentDeskCommand } from "@/lib/slack-command";
import {
  brandProfileFieldLabels,
  brandProfileModal,
  brandProfileSummaryBlocks,
  publishKitModal,
  topicPreviewModal,
  topicPickerBlocks,
  visibilityRecommendationBlocks,
} from "@/lib/slack";
import {
  brandProfileSchema,
  getBrandProfileCompleteness,
  slackActionSchema,
  type BrandProfile,
  type BrandProfileField,
  type PublishKit,
  type TopicBrief,
} from "@/lib/schemas";
import { getSlackDefaultMode } from "@/lib/visibility/slack-adapter";
import type { contentCycle } from "@/trigger/content-cycle";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: process.env.NODE_ENV === "development" ? LogLevel.DEBUG : LogLevel.INFO,
});

app.command("/contentdesk", async ({ ack, command, client }) => {
  await ack();

  const payload = {
    teamId: command.team_id,
    teamName: command.team_name,
    channelId: command.channel_id,
    userId: command.user_id,
    commandText: command.text,
  };
  const parsedCommand = parseContentDeskCommand(command.text);

  if (parsedCommand.mode === "reddit-teardown") {
    if (!parsedCommand.websiteUrl) {
      await postCommandEphemeral(client, command, {
        text: "Please include a public website URL, like `/contentdesk reddit-teardown https://example.com`.",
      });
      return;
    }

    await postCommandEphemeral(client, command, {
      text: `Working on a Reddit teardown packet for ${parsedCommand.websiteUrl}...`,
    });

    try {
      const packet = await runRedditTeardown({ websiteUrl: parsedCommand.websiteUrl });
      await postCommandEphemeral(client, command, {
        text: renderResearchPacket(packet),
      });
      await postCommandEphemeral(client, command, {
        text: renderManualPrompts(packet),
      });
      await postCommandEphemeral(client, command, {
        text: renderRecommendationCard(buildRecommendationCardFromTeardown(packet)),
      });
      await postCommandEphemeral(client, command, {
        text: renderRedditReplyDraft(packet),
      });
    } catch (error) {
      await postCommandEphemeral(client, command, {
        text: `I could not create that teardown packet: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    return;
  }

  const organization = await getOrCreateOrganization({
    slackTeamId: command.team_id,
    name: command.team_name,
  });
  const brand = await getPrimaryBrandForOrganization(organization.id);
  const completeness = getBrandProfileCompleteness(brand?.profile);

  if (parsedCommand.mode === "profile") {
    if (!brand) {
      await postCommandEphemeral(client, command, {
        text: "No Brand Profile is set up yet. Run `/contentdesk setup` to create one.",
      });
      return;
    }

    await postCommandEphemeral(client, command, {
      text: `Brand Profile: ${brand.profile.appName}`,
      blocks: brandProfileSummaryBlocks(brand.profile),
    });
    return;
  }

  if (parsedCommand.mode === "edit-profile" || parsedCommand.mode === "setup") {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: brandProfileModal({
        mode: brand ? "edit" : "create",
        initialValues: brand?.profile,
        channelId: command.channel_id,
        teamId: command.team_id,
        teamName: command.team_name,
        userId: command.user_id,
        startAfterSave: false,
      }),
    });
    return;
  }

  if (parsedCommand.mode === "article" && !parsedCommand.idea) {
    await postCommandEphemeral(client, command, {
      text: "Please include an article idea, like `/contentdesk article Modelia alternatives for Shopify fashion product photos`.",
    });
    return;
  }

  if (!brand || !completeness.isComplete) {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: brandProfileModal({
        mode: brand ? "edit" : "create",
        initialValues: brand?.profile,
        channelId: command.channel_id,
        teamId: command.team_id,
        teamName: command.team_name,
        userId: command.user_id,
        startAfterSave: true,
        pendingCommand:
          parsedCommand.mode === "article" ? parsedCommand : undefined,
      }),
    });
    return;
  }

  const defaultMode = getSlackDefaultMode();

  if (
    process.env.CONTENTDESK_WORKFLOW_DRIVER === "trigger" &&
    defaultMode === "topics"
  ) {
    await tasks.trigger<typeof contentCycle>("content-cycle", payload);
    return;
  }

  if (parsedCommand.mode === "article") {
    await runDirectArticleRequest(payload, { idea: parsedCommand.idea });
    return;
  }

  if (defaultMode === "visibility") {
    await runVisibilityRecommendationKickoff(payload).catch(async (error: unknown) => {
      await postCommandEphemeral(client, command, {
        text: `I could not load the latest visibility recommendation: ${error instanceof Error ? error.message : String(error)}`,
      });
    });
    return;
  }

  await runContentCycleKickoff(payload);
});

async function postCommandEphemeral(
  client: Parameters<Parameters<typeof app.command>[1]>[0]["client"],
  command: {
    channel_id: string;
    user_id: string;
  },
  message: {
    text: string;
    blocks?: unknown[];
  },
) {
  try {
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: message.text,
      blocks: message.blocks as never,
    });
  } catch (error) {
    console.warn(
      "[slack command ephemeral failed]",
      error instanceof Error ? error.message : String(error),
    );
  }
}

app.action("edit_brand_profile", async ({ ack, action, body, client }) => {
  await ack();

  if (!isButtonAction(action)) {
    throw new Error("Expected a button action for Brand Profile edit");
  }

  const parsedAction = slackActionSchema.parse(JSON.parse(action.value));
  if (parsedAction.action !== "edit_brand_profile") {
    throw new Error("Unexpected action payload for Brand Profile edit");
  }

  const teamId = getTeamId(body);
  const organization = await getOrCreateOrganization({ slackTeamId: teamId });
  const brand = await getPrimaryBrandForOrganization(organization.id);

  await client.views.open({
    trigger_id: getTriggerId(body as { trigger_id?: string }),
    view: brandProfileModal({
      mode: brand ? "edit" : "create",
      initialValues: brand?.profile,
      channelId: getChannelId(body),
      teamId,
      userId: body.user.id,
      startAfterSave: false,
    }),
  });
});

app.action("approve_topic", async ({ ack, action, body, client }) => {
  await ack();

  if (!isButtonAction(action)) {
    throw new Error("Expected a button action for topic approval");
  }

  const parsedAction = slackActionSchema.parse(JSON.parse(action.value));
  if (parsedAction.action !== "approve_topic") {
    throw new Error("Unexpected action payload for topic approval");
  }

  const channelId = getChannelId(body);
  const slackUserId = body.user.id;
  const messageTs = getMessageTs(body as { message?: { ts?: string } });

  const approvalResult = await handleTopicApproval({
    cycleId: parsedAction.cycleId,
    artifactId: parsedAction.artifactId,
    topicIndex: parsedAction.topicIndex,
    channelId,
    threadTs: messageTs,
    slackUserId,
    onApprovalCommitted: async ({ topics }) => {
      if (messageTs) {
        await client.chat.update({
          channel: channelId,
          ts: messageTs,
          text: "ContentDesk topic approved.",
          blocks: topicPickerBlocks({
            cycleId: parsedAction.cycleId,
            artifactId: parsedAction.artifactId,
            topics,
            approvedTopicIndex: parsedAction.topicIndex,
          }) as never,
        });
      }

      if (messageTs) {
        await client.chat.postMessage({
          channel: channelId,
          thread_ts: messageTs,
          text: "Topic approved. I’ll keep progress updates and the publish kit review in this thread.",
          unfurl_links: false,
          unfurl_media: false,
        });
      }
    },
  });

  if (approvalResult.alreadyApproved) {
    const topicArtifact = await getArtifact<TopicBrief[]>(parsedAction.artifactId);
    const approvedTopicIndex =
      approvalResult.approvedTopicIndex ?? parsedAction.topicIndex;
    const messageTs = getMessageTs(body as { message?: { ts?: string } });

    if (topicArtifact && messageTs) {
      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: "ContentDesk topic approved.",
        blocks: topicPickerBlocks({
          cycleId: parsedAction.cycleId,
          artifactId: parsedAction.artifactId,
          topics: topicArtifact.json_payload,
          approvedTopicIndex,
        }) as never,
      });
    }

    await client.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text: "A topic is already approved for this content cycle. I refreshed the message to show the approved topic.",
    });
    return;
  }

  if (approvalResult.writerFailed) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text: "Topic approved, but SEO Writer could not generate the article draft. I posted the blocker in the channel.",
    });
  }

  if ("qaBlocked" in approvalResult && approvalResult.qaBlocked) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text: "Topic approved, but Editor / SEO QA still found blockers after one revision pass. I posted the blocker summary in the thread.",
    });
  }
});

app.action("preview_topic", async ({ ack, action, body, client }) => {
  await ack();

  if (!isButtonAction(action)) {
    throw new Error("Expected a button action for topic preview");
  }

  const parsedAction = slackActionSchema.parse(JSON.parse(action.value));
  if (parsedAction.action !== "preview_topic") {
    throw new Error("Unexpected action payload for topic preview");
  }

  const topicArtifact = await getArtifact<TopicBrief[]>(parsedAction.artifactId);
  const topic = topicArtifact?.json_payload[parsedAction.topicIndex];
  if (!topic) {
    await client.chat.postEphemeral({
      channel: getChannelId(body),
      user: body.user.id,
      text: "I could not find that topic preview. Try running `/contentdesk` again.",
    });
    return;
  }

  await client.views.open({
    trigger_id: getTriggerId(body as { trigger_id?: string }),
    view: topicPreviewModal({
      topic,
      topicNumber: parsedAction.topicIndex + 1,
    }),
  });
});

app.action("topic_already_approved", async ({ ack }) => {
  await ack();
});

app.action("approve_visibility_recommendation", async ({ ack, action, body, client }) => {
  await ack();

  if (!isButtonAction(action)) {
    throw new Error("Expected a button action for visibility recommendation approval");
  }

  const parsedAction = slackActionSchema.parse(JSON.parse(action.value));
  if (parsedAction.action !== "approve_visibility_recommendation") {
    throw new Error("Unexpected action payload for visibility recommendation approval");
  }

  const channelId = getChannelId(body);
  const slackUserId = body.user.id;
  const messageTs = getMessageTs(body as { message?: { ts?: string } });

  const approvalResult = await handleVisibilityRecommendationApproval({
    cycleId: parsedAction.cycleId,
    artifactId: parsedAction.artifactId,
    runId: parsedAction.runId,
    recommendationId: parsedAction.recommendationId,
    hash: parsedAction.hash,
    taskType: parsedAction.taskType,
    channelId,
    threadTs: messageTs,
    slackUserId,
    onApprovalCommitted: async ({ recommendation }) => {
      if (messageTs) {
        await client.chat.update({
          channel: channelId,
          ts: messageTs,
          text: "ContentDesk visibility recommendation approved.",
          blocks: visibilityRecommendationBlocks({
            cycleId: parsedAction.cycleId,
            artifactId: parsedAction.artifactId,
            recommendation,
            approved: true,
          }) as never,
        });
      }
    },
  });

  if (approvalResult.stale) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text: "This visibility recommendation changed since it was shown. Run `/contentdesk` again to refresh before approving.",
    });
    return;
  }

  if (approvalResult.disabledTaskType) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text: `ContentDesk cannot run ${parsedAction.taskType.replace(/_/g, " ")} recommendations yet. No content cycle was started.`,
    });
    return;
  }

  if (approvalResult.alreadyApproved) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text: "This visibility recommendation was already approved. I will not start a duplicate cycle.",
    });
    return;
  }

  if (approvalResult.writerFailed) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text: "Visibility recommendation approved, but SEO Writer could not start. I posted the blocker in the channel.",
    });
  }

  if ("qaBlocked" in approvalResult && approvalResult.qaBlocked) {
    await client.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text: "Visibility recommendation approved, but Editor / SEO QA still found blockers after revision passes. I posted the blocker summary in the thread.",
    });
  }
});

app.view("review_publish_kit", async ({ ack, body }) => {
  await ack();

  const metadata = publishKitReviewMetadataSchema.parse(
    JSON.parse(body.view.private_metadata),
  );
  const channelId = metadata.channelId;
  const slackUserId = body.user.id;

  await handlePublishKitApproval({
    cycleId: metadata.cycleId,
    artifactId: metadata.artifactId,
    channelId,
    slackUserId,
  });
});

app.view("brand_profile", async ({ ack, body, client }) => {
  const metadata = brandProfileMetadataSchema.parse(
    JSON.parse(body.view.private_metadata),
  );
  const profileInput = readBrandProfileFromViewState(body.view.state.values);
  const parsedProfile = brandProfileSchema.safeParse(profileInput);

  if (!parsedProfile.success) {
    await ack({
      response_action: "errors",
      errors: brandProfileValidationErrors(parsedProfile.error),
    });
    return;
  }

  await ack();

  const organization = await getOrCreateOrganization({
    slackTeamId: metadata.teamId,
    name: metadata.teamName,
  });
  await savePrimaryBrandProfile({
    organizationId: organization.id,
    profile: parsedProfile.data,
  });

  if (metadata.startAfterSave) {
    await client.chat.postEphemeral({
      channel: metadata.channelId,
      user: body.user.id,
      text: metadata.pendingCommand?.mode === "article"
        ? "Brand Profile saved. I’m starting the requested article now."
        : "Brand Profile saved. I’m starting the content cycle now.",
    });
    const payload = {
      teamId: metadata.teamId,
      teamName: metadata.teamName,
      channelId: metadata.channelId,
      userId: metadata.userId,
      commandText: metadata.pendingCommand
        ? `article ${metadata.pendingCommand.idea}`
        : undefined,
    };
    if (metadata.pendingCommand?.mode === "article") {
      await runDirectArticleRequest(payload, {
        idea: metadata.pendingCommand.idea,
      });
      return;
    }

    await runContentCycleKickoff(payload);
    return;
  }

  await client.chat.postEphemeral({
    channel: metadata.channelId,
    user: body.user.id,
    text: `Brand Profile saved for ${parsedProfile.data.appName}. Run \`/contentdesk profile\` anytime to review it.`,
  });
});

app.view(
  { callback_id: "review_publish_kit", type: "view_closed" },
  async ({ ack, body }) => {
    await ack();

    const metadata = publishKitReviewMetadataSchema.parse(
      JSON.parse(body.view.private_metadata),
    );

    await handlePublishKitRejection({
      cycleId: metadata.cycleId,
      artifactId: metadata.artifactId,
      channelId: metadata.channelId,
      slackUserId: body.user.id,
    });
  },
);

app.action("view_publish_kit", async ({ ack, action, body, client }) => {
  await ack();

  if (!isButtonAction(action)) {
    throw new Error("Expected a button action for publish kit details");
  }

  const parsedAction = slackActionSchema.parse(JSON.parse(action.value));
  if (parsedAction.action !== "view_publish_kit") {
    throw new Error("Unexpected action payload for publish kit details");
  }

  const artifact = await getArtifact<PublishKit>(parsedAction.artifactId);
  if (!artifact) throw new Error("Publish kit artifact not found");

  const triggerId = getTriggerId(body as { trigger_id?: string });
  await client.views.open({
    trigger_id: triggerId,
    view: publishKitModal({
      cycleId: parsedAction.cycleId,
      artifactId: parsedAction.artifactId,
      channelId: getChannelId(body),
      publishKit: artifact.json_payload,
    }),
  });
});

app.action("open_codex_handoff", async ({ ack }) => {
  await ack();
});

function isButtonAction(action: unknown): action is { type: "button"; value: string } {
  return (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    action.type === "button" &&
    "value" in action &&
    typeof action.value === "string"
  );
}

function getChannelId(body: { channel?: { id?: string }; container?: { channel_id?: string } }) {
  const channelId = body.channel?.id ?? body.container?.channel_id;
  if (!channelId) throw new Error("Slack action did not include a channel ID");

  return channelId;
}

function getTriggerId(body: { trigger_id?: string }) {
  if (!body.trigger_id) throw new Error("Slack action did not include a trigger ID");

  return body.trigger_id;
}

function getTeamId(body: { team?: { id?: string } | null }) {
  if (!body.team?.id) throw new Error("Slack action did not include a team ID");

  return body.team.id;
}

function getMessageTs(body: { message?: { ts?: string } }) {
  return body.message?.ts;
}

const publishKitReviewMetadataSchema = z.object({
  cycleId: z.string(),
  artifactId: z.string(),
  channelId: z.string(),
});

const brandProfileMetadataSchema = z.object({
  mode: z.enum(["create", "edit"]),
  channelId: z.string(),
  teamId: z.string(),
  teamName: z.string().optional(),
  userId: z.string(),
  startAfterSave: z.boolean(),
  pendingCommand: z.object({
    mode: z.literal("article"),
    idea: z.string(),
  }).optional(),
});

type SlackViewStateValues = Record<
  string,
  Record<
    string,
    {
      value?: string | null;
      selected_options?: { value: string }[] | null;
    }
  >
>;

function readBrandProfileFromViewState(values: SlackViewStateValues) {
  return {
    appName: readViewValue(values, "appName"),
    targetMerchant: readViewValue(values, "targetMerchant"),
    positioning: readViewValue(values, "positioning"),
    featuresUseCases: parseList(readViewValue(values, "featuresUseCases")),
    competitors: parseList(readViewValue(values, "competitors")),
    preferredVoice: readViewValue(values, "preferredVoice"),
    preferredVisuals: readSelectedOptions(values, "preferredVisuals"),
    visualsToAvoid: readSelectedOptions(values, "visualsToAvoid"),
    forbiddenClaims: parseList(readViewValue(values, "forbiddenClaims")),
    ctaStyle: readViewValue(values, "ctaStyle"),
    existingBlogDocsUrls: parseList(readViewValue(values, "existingBlogDocsUrls")),
  };
}

function readViewValue(values: SlackViewStateValues, field: BrandProfileField) {
  return values[field]?.value?.value?.trim() ?? "";
}

function readSelectedOptions(values: SlackViewStateValues, field: BrandProfileField) {
  return values[field]?.value?.selected_options?.map((option) => option.value) ?? [];
}

function parseList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function brandProfileValidationErrors(error: z.ZodError<BrandProfile>) {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !(field in brandProfileFieldLabels)) {
      continue;
    }

    errors[field] = `${brandProfileFieldLabels[field as BrandProfileField]} needs a valid value.`;
  }

  return errors;
}

async function start() {
  await app.start();
  app.logger.info("ContentDesk Bolt app is running");
}

start().catch((error) => {
  console.error("Failed to start ContentDesk Bolt app", error);
  process.exit(1);
});
