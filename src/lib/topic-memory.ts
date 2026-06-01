import { query } from "@/lib/db";
import {
  topicBriefSchema,
  type TopicBrief,
} from "@/lib/schemas";

export type TopicStrategyMemoryItem = {
  cycleId: string;
  workingTitle: string;
  strategyType: TopicBrief["strategyType"];
  merchantJob: string;
  messageAngle: string;
  strategicFingerprint: string;
  status: string;
  approved: boolean;
};

export type TopicMemoryRow = {
  content_cycle_id: string;
  status: string;
  topics: unknown;
  approved_topic: unknown | null;
};

export async function getRecentTopicStrategyMemory(input: {
  brandId: string;
  limitCycles?: number;
}) {
  const result = await query<TopicMemoryRow>(
    `select
       topic_artifacts.content_cycle_id,
       topic_artifacts.status,
       topic_artifacts.json_payload as topics,
       approved_artifacts.json_payload as approved_topic
     from artifacts topic_artifacts
     left join artifacts approved_artifacts
       on approved_artifacts.content_cycle_id = topic_artifacts.content_cycle_id
      and approved_artifacts.type = 'ApprovedTopic'
     where topic_artifacts.brand_id = $1
       and topic_artifacts.type = 'TopicBrief[]'
     order by topic_artifacts.created_at desc
     limit $2`,
    [input.brandId, input.limitCycles ?? 8],
  );

  return topicMemoryItemsFromRows(result.rows);
}

export function topicMemoryItemsFromRows(rows: TopicMemoryRow[]) {
  return rows.flatMap((row) => {
    const topics = parseTopicArray(row.topics);
    const approvedTopic = row.approved_topic
      ? topicBriefSchema.safeParse(row.approved_topic)
      : null;

    return topics.map((topic) => ({
      cycleId: row.content_cycle_id,
      workingTitle: topic.workingTitle,
      strategyType: topic.strategyType,
      merchantJob: topic.merchantJob,
      messageAngle: topic.messageAngle,
      strategicFingerprint: topic.strategicFingerprint,
      status: row.status,
      approved: approvedTopic?.success ? topicsMatch(topic, approvedTopic.data) : false,
    }));
  });
}

export function formatRecentTopicStrategyMemory(
  memory: TopicStrategyMemoryItem[],
) {
  if (memory.length === 0) return "- None";

  const groups = new Map<
    string,
    {
      count: number;
      approvedCount: number;
      examples: TopicStrategyMemoryItem[];
    }
  >();

  for (const item of memory) {
    const existing = groups.get(item.strategicFingerprint) ?? {
      count: 0,
      approvedCount: 0,
      examples: [],
    };

    existing.count += 1;
    if (item.approved) existing.approvedCount += 1;
    if (existing.examples.length < 2) existing.examples.push(item);
    groups.set(item.strategicFingerprint, existing);
  }

  return [...groups.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 12)
    .map(([fingerprint, group]) => {
      const approved = group.approvedCount
        ? `; approved ${group.approvedCount} time${group.approvedCount === 1 ? "" : "s"}`
        : "";
      const examples = group.examples
        .map((item) => `${item.strategyType}: ${item.workingTitle}`)
        .join(" | ");

      return `- ${fingerprint}: proposed ${group.count} time${group.count === 1 ? "" : "s"} recently${approved}. Examples: ${examples}`;
    })
    .join("\n");
}

function parseTopicArray(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const parsed = topicBriefSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function topicsMatch(left: TopicBrief, right: TopicBrief) {
  return (
    left.workingTitle === right.workingTitle &&
    left.topic === right.topic &&
    left.strategicFingerprint === right.strategicFingerprint
  );
}
