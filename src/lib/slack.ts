import crypto from "node:crypto";
import { WebClient } from "@slack/web-api";
import { getEnv } from "@/lib/env";
import type { View } from "@slack/types";
import type { ContentDeskCommand } from "@/lib/slack-command";
import {
  getBrandProfileCompleteness,
  type BrandProfile,
  type BrandProfileField,
  type PublishKit,
  requiredBrandProfileFields,
  type SlackAction,
  type TopicBrief,
} from "@/lib/schemas";

let client: WebClient | undefined;

function getSlackClient() {
  const { SLACK_BOT_TOKEN } = getEnv();

  if (!SLACK_BOT_TOKEN) return null;
  if (!client) client = new WebClient(SLACK_BOT_TOKEN);

  return client;
}

export function verifySlackRequest(headers: Headers, rawBody: string) {
  const { SLACK_SIGNING_SECRET } = getEnv();
  if (!SLACK_SIGNING_SECRET) return true;

  const timestamp = headers.get("x-slack-request-timestamp");
  const signature = headers.get("x-slack-signature");
  if (!timestamp || !signature) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const digest = crypto
    .createHmac("sha256", SLACK_SIGNING_SECRET)
    .update(base)
    .digest("hex");
  const expected = Buffer.from(`v0=${digest}`, "utf8");
  const actual = Buffer.from(signature, "utf8");

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export async function postManagerMessage(input: {
  channelId: string;
  text: string;
  blocks?: unknown[];
  threadTs?: string;
}) {
  const slack = getSlackClient();

  if (!slack) {
    console.log("[slack disabled]", input.text, JSON.stringify(input.blocks ?? []));
    return { ts: undefined };
  }

  const response = await slack.chat.postMessage({
    channel: input.channelId,
    text: input.text,
    blocks: input.blocks as never,
    thread_ts: input.threadTs,
    unfurl_links: false,
    unfurl_media: false,
  });

  return { ts: response.ts };
}

export async function updateManagerMessage(input: {
  channelId: string;
  ts: string;
  text: string;
  blocks?: unknown[];
}) {
  const slack = getSlackClient();

  if (!slack) {
    console.log("[slack disabled update]", input.text, JSON.stringify(input.blocks ?? []));
    return;
  }

  await slack.chat.update({
    channel: input.channelId,
    ts: input.ts,
    text: input.text,
    blocks: input.blocks as never,
  });
}

export function topicPickerBlocks(input: {
  cycleId: string;
  artifactId: string;
  topics: TopicBrief[];
  approvedTopicIndex?: number;
}) {
  const blocks: unknown[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          input.approvedTopicIndex === undefined
            ? "*ContentDesk topic options*\nChoose one direction to continue."
            : "*ContentDesk topic approved*",
      },
    },
    { type: "divider" },
  ];

  const rankedTopics = input.topics
    .map((topic, index) => ({ topic, index }))
    .sort((left, right) => right.topic.score - left.topic.score);
  const visibleTopics =
    input.approvedTopicIndex === undefined
      ? rankedTopics
      : rankedTopics.filter(({ index }) => index === input.approvedTopicIndex);

  visibleTopics.forEach(({ topic, index }) => {
    const approveAction: SlackAction = {
      action: "approve_topic",
      cycleId: input.cycleId,
      artifactId: input.artifactId,
      topicIndex: index,
    };
    const previewAction: SlackAction = {
      action: "preview_topic",
      cycleId: input.cycleId,
      artifactId: input.artifactId,
      topicIndex: index,
    };
    const approved = input.approvedTopicIndex === index;
    const approvalComplete = input.approvedTopicIndex !== undefined;
    const block = {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*${topic.workingTitle}*${approved ? "  _Approved_" : ""}`,
          `_${formatStrategyLabel(topic)}_`,
          `Job: ${truncateText(topic.merchantJob || topic.targetMerchantPain, 160)}`,
          approvalComplete
            ? `Next: progress updates and the publish kit review will appear in this thread.`
            : truncateText(topic.targetMerchantPain, 180),
        ]
          .filter(Boolean)
          .join("\n"),
      },
    };

    if (!approvalComplete) {
      blocks.push(block);
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Preview" },
            action_id: "preview_topic",
            value: JSON.stringify(previewAction),
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            action_id: "approve_topic",
            value: JSON.stringify(approveAction),
          },
        ],
      });
      return;
    }

    blocks.push(block);
  });

  return blocks;
}

export function topicPreviewModal(input: {
  topic: TopicBrief;
  topicNumber: number;
}): View {
  const topic = input.topic;

  return {
    type: "modal",
    callback_id: "topic_preview",
    title: {
      type: "plain_text",
      text: "Topic Preview",
    },
    close: {
      type: "plain_text",
      text: "Close",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Option ${input.topicNumber}: ${topic.workingTitle}*`,
        },
      },
      { type: "divider" },
      modalSection("Why it matters", topic.targetMerchantPain),
      modalSection("Strategy", formatStrategyReasoning(topic)),
      modalSection("Shopify angle", topic.shopifySpecificAngle),
      modalSection("Content gap", topic.contentGap),
      modalSection("Why now", topic.whyNow),
      modalSection("Search intent", topic.searchIntent),
      modalSection("Sources", formatSourceList(topic.sourceLinks)),
    ],
  } satisfies View;
}

function formatStrategyReasoning(topic: TopicBrief) {
  const evidence = topic.strategyEvidence?.length
    ? topic.strategyEvidence.map((item) => `- ${item}`).join("\n")
    : "- Available evidence was not stored for this legacy topic.";

  return [
    formatStrategyLabel(topic),
    "",
    "*Merchant job*",
    topic.merchantJob || topic.targetMerchantPain,
    "",
    "*Intent type*",
    formatIntentType(topic.intentType),
    "",
    "*Message angle*",
    topic.messageAngle || "Frame the topic around a practical Shopify merchant problem.",
    "",
    "*Proof angle*",
    topic.proofAngle ||
      "Use available Brand Profile and research-source context to make the article credible.",
    "",
    "*Available evidence*",
    evidence,
    "",
    "*Why this strategy*",
    topic.whyThisStrategy ||
      "Selected as a useful topic opportunity for founder approval.",
  ].join("\n");
}

function formatIntentType(intentType: TopicBrief["intentType"] | undefined) {
  const labels: Record<TopicBrief["intentType"], string> = {
    pain_awareness: "Pain awareness",
    workflow_solution: "Workflow solution",
    comparison_decision: "Comparison decision",
  };

  return intentType ? labels[intentType] : "Pain awareness";
}

function formatStrategyLabel(topic: TopicBrief) {
  const funnelStage = topic.funnelStage ?? "top";
  const strategyType = topic.strategyType ?? "education";
  const stageLabels: Record<TopicBrief["funnelStage"], string> = {
    top: "Top-funnel",
    middle: "Mid-funnel",
    bottom: "Bottom-funnel",
  };
  const strategyLabels: Record<TopicBrief["strategyType"], string> = {
    education: "education",
    workflow: "workflow",
    comparison: "comparison",
  };

  return `${stageLabels[funnelStage]} ${strategyLabels[strategyType]}`;
}

function modalSection(label: string, value: string) {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*${label}*\n${truncateText(value, 1800)}`,
    },
  };
}

function formatSourceList(sourceLinks: string[]) {
  return sourceLinks
    .slice(0, 5)
    .map((url) => `<${url}|${sourceLabel(url)}>`)
    .join("\n");
}

function sourceLabel(url: string) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname
      .split("/")
      .filter(Boolean)
      .slice(-1)[0]
      ?.replace(/[-_]/g, " ");

    return path ? `${domain} / ${truncateText(path, 48)}` : domain;
  } catch {
    return truncateText(url, 60);
  }
}

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength - 1).trim()}…`;
}

export const brandProfileFieldLabels: Record<BrandProfileField, string> = {
  appName: "App name",
  targetMerchant: "Target merchant",
  positioning: "Positioning",
  featuresUseCases: "Features/use cases",
  competitors: "Competitors",
  preferredVoice: "Preferred voice",
  preferredVisuals: "Preferred visuals",
  visualsToAvoid: "Visuals to avoid",
  forbiddenClaims: "Forbidden claims",
  ctaStyle: "CTA style",
  existingBlogDocsUrls: "Existing blog/docs URLs",
};

export const visualAvoidOptions = [
  "Fake dashboards or app UI",
  "Screenshots",
  "Dense text inside images",
  "Tables or spreadsheets as images",
  "Checklists or worksheets as images",
  "Generic stock-photo style",
  "Cartoon/mascot illustrations",
  "Logos or competitor branding",
  "Unrealistic metrics or claims",
] as const;

export const preferredVisualOptions = [
  "Product/editorial photos",
  "Simple workflow diagrams",
  "Before/after concepts",
  "Merchant process scenes",
  "Clean conceptual illustrations",
  "Minimal labeled diagrams",
] as const;

const defaultVisualAvoidOptions = [
  "Fake dashboards or app UI",
  "Dense text inside images",
  "Tables or spreadsheets as images",
  "Checklists or worksheets as images",
  "Unrealistic metrics or claims",
];

export function brandProfileModal(input: {
  mode: "create" | "edit";
  initialValues?: Partial<BrandProfile>;
  channelId: string;
  teamId: string;
  teamName?: string;
  userId: string;
  startAfterSave: boolean;
  pendingCommand?: Extract<ContentDeskCommand, { mode: "article" }>;
}): View {
  const profile = input.initialValues;
  const completeness = getBrandProfileCompleteness(profile);
  const requiredFields = requiredBrandProfileFields
    .map((field) => brandProfileFieldLabels[field])
    .join(", ");
  const missingRequired = completeness.requiredMissing
    .map((field) => brandProfileFieldLabels[field])
    .join(", ");

  return {
    type: "modal",
    callback_id: "brand_profile",
    private_metadata: JSON.stringify({
      mode: input.mode,
      channelId: input.channelId,
      teamId: input.teamId,
      teamName: input.teamName,
      userId: input.userId,
      startAfterSave: input.startAfterSave,
      pendingCommand: input.pendingCommand,
    }),
    title: {
      type: "plain_text",
      text: "Brand Profile",
    },
    submit: {
      type: "plain_text",
      text: "Save",
    },
    close: {
      type: "plain_text",
      text: "Cancel",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: missingRequired
            ? `Required to start a content cycle: ${requiredFields}\nMissing now: ${missingRequired}`
            : `Required to start a content cycle: ${requiredFields}`,
        },
      },
      textInputBlock("appName", {
        initialValue: profile?.appName,
        placeholder: "Acme Reviews",
      }),
      textInputBlock("targetMerchant", {
        initialValue: profile?.targetMerchant,
        placeholder: "growth-stage Shopify merchants",
      }),
      textInputBlock("positioning", {
        initialValue: profile?.positioning,
        multiline: true,
        placeholder: "What the app helps merchants do, in plain language",
      }),
      textInputBlock("featuresUseCases", {
        initialValue: listToText(profile?.featuresUseCases),
        multiline: true,
        placeholder: "One per line",
      }),
      textInputBlock("ctaStyle", {
        initialValue: profile?.ctaStyle,
        placeholder: "soft educational CTA",
      }),
      textInputBlock("competitors", {
        initialValue: listToText(profile?.competitors),
        multiline: true,
        optional: true,
        placeholder: "One per line",
      }),
      textInputBlock("preferredVoice", {
        initialValue: profile?.preferredVoice,
        optional: true,
        placeholder: "clear, practical, founder-led",
      }),
      checkboxInputBlock("preferredVisuals", {
        options: preferredVisualOptions,
        initialValues: profile?.preferredVisuals,
        optional: true,
        hint: "Choose up to 3 that fit this brand.",
      }),
      checkboxInputBlock("visualsToAvoid", {
        options: visualAvoidOptions,
        initialValues: profile?.visualsToAvoid ?? defaultVisualAvoidOptions,
        optional: true,
        hint: "Safe defaults are preselected. Change only if needed.",
      }),
      textInputBlock("forbiddenClaims", {
        initialValue: listToText(profile?.forbiddenClaims),
        multiline: true,
        optional: true,
        placeholder: "One per line",
      }),
      textInputBlock("existingBlogDocsUrls", {
        initialValue: listToText(profile?.existingBlogDocsUrls),
        multiline: true,
        optional: true,
        placeholder: "One URL per line",
      }),
    ],
  } satisfies View;
}

export function brandProfileSummaryBlocks(profile: BrandProfile) {
  const completeness = getBrandProfileCompleteness(profile);
  const editAction: SlackAction = { action: "edit_brand_profile" };
  const missingOptional = completeness.optionalMissing
    .map((field) => brandProfileFieldLabels[field])
    .join(", ");

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Brand Profile: ${profile.appName}*`,
          `*Target merchant:* ${profile.targetMerchant}`,
          `*Positioning:* ${profile.positioning}`,
          `*Features/use cases:* ${formatList(profile.featuresUseCases)}`,
          `*CTA style:* ${profile.ctaStyle}`,
          `*Completeness:* ${completeness.isComplete ? "Ready for topic generation" : "Missing required fields"}`,
        ].join("\n"),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `*Competitors:* ${formatList(profile.competitors)}`,
          `*Preferred voice:* ${profile.preferredVoice || "Not set"}`,
          `*Preferred visuals:* ${formatList(profile.preferredVisuals)}`,
          `*Visuals to avoid:* ${formatList(profile.visualsToAvoid)}`,
          `*Forbidden claims:* ${formatList(profile.forbiddenClaims)}`,
          `*Blog/docs URLs:* ${formatList(profile.existingBlogDocsUrls)}`,
          missingOptional ? `*Optional fields to improve later:* ${missingOptional}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Edit Brand Profile" },
          action_id: "edit_brand_profile",
          value: JSON.stringify(editAction),
        },
      ],
    },
  ];
}

export function publishKitBlocks(input: {
  cycleId: string;
  artifactId: string;
  publishKit: PublishKit;
}) {
  const viewAction: SlackAction = {
    action: "view_publish_kit",
    cycleId: input.cycleId,
    artifactId: input.artifactId,
  };

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Article draft ready for review*\nOpen the publish kit preview to approve or reject.`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View details" },
          style: "primary",
          action_id: "view_publish_kit",
          value: JSON.stringify(viewAction),
        },
      ],
    },
  ];
}

export function publishKitModal(input: {
  cycleId: string;
  artifactId: string;
  channelId: string;
  publishKit: PublishKit;
}): View {
  return {
    type: "modal",
    callback_id: "review_publish_kit",
    notify_on_close: true,
    private_metadata: JSON.stringify({
      cycleId: input.cycleId,
      artifactId: input.artifactId,
      channelId: input.channelId,
    }),
    title: {
      type: "plain_text",
      text: "Publish Kit",
    },
    submit: {
      type: "plain_text",
      text: "Approve",
    },
    close: {
      type: "plain_text",
      text: "Reject",
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${input.publishKit.metadata.title}*\n${input.publishKit.metadata.metaDescription}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Editor QA*\n${truncate(formatQaSummary(input.publishKit), 1800)}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Markdown draft*\n\`\`\`${truncate(input.publishKit.markdown, 2700)}\`\`\``,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*FAQ*\n${truncate(
            input.publishKit.faq
              .map((item) => `*Q:* ${item.question}\n*A:* ${item.answer}`)
              .join("\n\n"),
            2600,
          )}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Visual plan*\n${truncate(formatVisualPlanSummary(input.publishKit), 1800)}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Visual assets*\n${truncate(formatVisualAssetSummary(input.publishKit), 1800)}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Sources*\n${input.publishKit.sources.map((source) => `- ${source}`).join("\n")}`,
        },
      },
    ],
  } satisfies View;
}

export function codexHandoffBlocks(input: {
  cycleId: string;
  artifactId: string;
}) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Publish kit approved*\nCodex handoff prompt is ready.`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open handoff" },
          style: "primary",
          action_id: "open_codex_handoff",
          url: handoffUrl(input.artifactId),
        },
      ],
    },
  ];
}

function handoffUrl(artifactId: string) {
  const baseUrl = process.env.CONTENTDESK_APP_URL?.trim() || "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/handoff/${encodeURIComponent(artifactId)}`;
}

function formatVisualPlanSummary(publishKit: PublishKit) {
  const leadVisual = [
    `*Lead visual: ${publishKit.leadVisual.title}*`,
    `Status: ${publishKit.leadVisualReadiness}`,
    `Purpose: ${publishKit.leadVisual.purpose}`,
  ].join("\n");

  if (publishKit.visualPlan.length === 0) return leadVisual;

  return [
    leadVisual,
    ...publishKit.visualPlan.map(
      (visual) =>
        [
          `*${visual.title}*`,
          `Placement: ${visual.placement}`,
          `Purpose: ${visual.purpose}`,
        ].join("\n"),
    ),
  ].join("\n\n");
}

function formatVisualAssetSummary(publishKit: PublishKit) {
  if (publishKit.visualAssets.length === 0) {
    return "No visual asset generation was attempted.";
  }

  return publishKit.visualAssets
    .map((asset) => {
      const location =
        asset.status === "generated" && asset.publicUrl
          ? `URL/path: ${asset.publicUrl}`
          : `Reason: ${asset.error || "No generated asset available."}`;

      return [
        `*${asset.title}*`,
        `Status: ${asset.status}`,
        location,
      ].join("\n");
    })
    .join("\n\n");
}

function formatQaSummary(publishKit: PublishKit) {
  const blockers = publishKit.blockers.length
    ? publishKit.blockers
        .map((issue) => `- ${issue.finding}: ${issue.instruction}`)
        .join("\n")
    : "- None";
  const notes = publishKit.nonBlockingNotes.length
    ? publishKit.nonBlockingNotes
        .slice(0, 4)
        .map((issue) => `- ${issue.finding}`)
        .join("\n")
    : "- None";

  return [
    publishKit.qaSummary,
    "",
    "*Blockers*",
    blockers,
    "",
    "*Non-blocking notes*",
    notes,
  ].join("\n");
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength - 20).trimEnd()}\n...[truncated]`;
}

function textInputBlock(
  field: BrandProfileField,
  options: {
    initialValue?: string;
    multiline?: boolean;
    optional?: boolean;
    placeholder?: string;
  },
) {
  const element: {
    type: "plain_text_input";
    action_id: "value";
    multiline?: boolean;
    initial_value?: string;
    placeholder?: { type: "plain_text"; text: string };
  } = {
    type: "plain_text_input",
    action_id: "value",
  };

  if (options.multiline) element.multiline = true;
  if (options.initialValue?.trim()) element.initial_value = options.initialValue;
  if (options.placeholder) {
    element.placeholder = { type: "plain_text", text: options.placeholder };
  }

  return {
    type: "input",
    block_id: field,
    optional: options.optional ?? false,
    label: {
      type: "plain_text",
      text: brandProfileFieldLabels[field],
    },
    element,
  };
}

function checkboxInputBlock(
  field: BrandProfileField,
  options: {
    options: readonly string[];
    initialValues?: string[];
    optional?: boolean;
    hint?: string;
  },
) {
  const selected = new Set(options.initialValues ?? []);
  const optionObjects = options.options.map((value) => ({
    text: {
      type: "plain_text" as const,
      text: value,
    },
    value,
  }));

  const element: {
    type: "checkboxes";
    action_id: "value";
    options: typeof optionObjects;
    initial_options?: typeof optionObjects;
  } = {
    type: "checkboxes",
    action_id: "value",
    options: optionObjects,
  };
  const initialOptions = optionObjects.filter((option) => selected.has(option.value));
  if (initialOptions.length > 0) element.initial_options = initialOptions;

  return {
    type: "input",
    block_id: field,
    optional: options.optional ?? false,
    label: {
      type: "plain_text",
      text: brandProfileFieldLabels[field],
    },
    hint: options.hint
      ? {
          type: "plain_text",
          text: options.hint,
        }
      : undefined,
    element,
  };
}

function listToText(values: string[] | string | undefined) {
  if (typeof values === "string") return values;

  return values?.join("\n") ?? "";
}

function formatList(values: string[] | string | undefined) {
  if (typeof values === "string") return values || "Not set";

  return values?.length ? values.join(", ") : "Not set";
}
