import crypto from "node:crypto";
import { query } from "@/lib/db";
import type { BrandProfile } from "@/lib/schemas";

export type ArtifactType =
  | "BrandProfile"
  | "UserArticleRequest"
  | "ResearchSource[]"
  | "TopicBrief[]"
  | "RecommendationCard"
  | "VisibilityRecommendation"
  | "ApprovedTopic"
  | "ArticleDraft"
  | "QAReport"
  | "RevisionTask[]"
  | "RevisionTaskResult[]"
  | "LeadVisual"
  | "VisualPlan"
  | "VisualAsset[]"
  | "VisualAssetReview[]"
  | "PublishKit";

export type ArtifactRecord<T = unknown> = {
  id: string;
  organization_id: string;
  brand_id: string;
  content_cycle_id: string;
  type: ArtifactType;
  status: string;
  version: number;
  json_payload: T;
  created_by_agent: string;
};

export type BrandRecord = {
  id: string;
  name: string;
  profile: BrandProfile;
};

export function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function getOrCreateOrganization(input: {
  slackTeamId: string;
  name?: string;
}) {
  const existing = await query<{ id: string }>(
    "select id from organizations where slack_team_id = $1",
    [input.slackTeamId],
  );

  if (existing.rowCount) return existing.rows[0];

  const created = await query<{ id: string }>(
    "insert into organizations (id, slack_team_id, name) values ($1, $2, $3) returning id",
    [id("org"), input.slackTeamId, input.name ?? null],
  );

  return created.rows[0];
}

export async function getPrimaryBrandForOrganization(organizationId: string) {
  const result = await query<BrandRecord>(
    "select id, name, profile from brands where organization_id = $1 order by created_at asc limit 1",
    [organizationId],
  );

  return result.rows[0] ?? null;
}

export async function savePrimaryBrandProfile(input: {
  organizationId: string;
  profile: BrandProfile;
}) {
  const existing = await getPrimaryBrandForOrganization(input.organizationId);

  if (existing) {
    const updated = await query<BrandRecord>(
      `update brands
       set name = $2, profile = $3, updated_at = now()
       where id = $1
       returning id, name, profile`,
      [existing.id, input.profile.appName, JSON.stringify(input.profile)],
    );

    return updated.rows[0];
  }

  const created = await query<BrandRecord>(
    "insert into brands (id, organization_id, name, profile) values ($1, $2, $3, $4) returning id, name, profile",
    [
      id("brand"),
      input.organizationId,
      input.profile.appName,
      JSON.stringify(input.profile),
    ],
  );

  return created.rows[0];
}

export async function createContentCycle(input: {
  organizationId: string;
  brandId: string;
  slackChannelId: string;
}) {
  const created = await query<{ id: string }>(
    `insert into content_cycles
      (id, organization_id, brand_id, status, slack_channel_id)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [
      id("cycle"),
      input.organizationId,
      input.brandId,
      "awaiting_topic_approval",
      input.slackChannelId,
    ],
  );

  return created.rows[0];
}

export async function updateCycleThread(cycleId: string, threadTs: string) {
  await query(
    "update content_cycles set slack_thread_ts = $2, updated_at = now() where id = $1",
    [cycleId, threadTs],
  );
}

export async function updateCycleStatus(cycleId: string, status: string) {
  await query(
    "update content_cycles set status = $2, updated_at = now() where id = $1",
    [cycleId, status],
  );
}

export async function resetCycleToTopicApproval(cycleId: string) {
  await query(
    `update content_cycles
     set status = 'awaiting_topic_approval',
       approved_topic_artifact_id = null,
       updated_at = now()
     where id = $1`,
    [cycleId],
  );
}

export async function setApprovedTopicIfAwaiting(input: {
  cycleId: string;
  artifactId: string;
}) {
  const result = await query<{ id: string }>(
    `update content_cycles
     set approved_topic_artifact_id = $2, status = 'drafting', updated_at = now()
     where id = $1 and status = 'awaiting_topic_approval'
     returning id`,
    [input.cycleId, input.artifactId],
  );

  return result.rowCount === 1;
}

export async function markCycleTopicApproved(input: {
  cycleId: string;
  artifactId: string;
}) {
  await query(
    `update content_cycles
     set approved_topic_artifact_id = $2, status = 'drafting', updated_at = now()
     where id = $1`,
    [input.cycleId, input.artifactId],
  );
}

export async function createArtifact<T>(input: {
  organizationId: string;
  brandId: string;
  cycleId: string;
  type: ArtifactType;
  status: string;
  payload: T;
  createdByAgent: string;
}) {
  const created = await query<{ id: string }>(
    `insert into artifacts
      (id, organization_id, brand_id, content_cycle_id, type, status, version, json_payload, created_by_agent)
     values ($1, $2, $3, $4, $5, $6, 1, $7, $8)
     returning id`,
    [
      id("artifact"),
      input.organizationId,
      input.brandId,
      input.cycleId,
      input.type,
      input.status,
      JSON.stringify(input.payload),
      input.createdByAgent,
    ],
  );

  return created.rows[0];
}

export async function getArtifact<T>(artifactId: string) {
  const result = await query<ArtifactRecord<T>>(
    "select * from artifacts where id = $1",
    [artifactId],
  );

  return result.rows[0] ?? null;
}

export async function getLatestArtifactForCycle<T>(
  cycleId: string,
  type: ArtifactType,
) {
  const result = await query<ArtifactRecord<T>>(
    `select * from artifacts
     where content_cycle_id = $1 and type = $2
     order by created_at desc
     limit 1`,
    [cycleId, type],
  );

  return result.rows[0] ?? null;
}

export async function createApproval(input: {
  cycleId: string;
  artifactId: string;
  gate: string;
  status: string;
  slackUserId?: string;
}) {
  await query(
    `insert into approvals
      (id, content_cycle_id, artifact_id, gate, status, slack_user_id)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id("approval"),
      input.cycleId,
      input.artifactId,
      input.gate,
      input.status,
      input.slackUserId ?? null,
    ],
  );
}

export async function createAgentRun(input: {
  cycleId: string;
  agentName: string;
  status: string;
  input: unknown;
  output: unknown;
  error?: string;
}) {
  await query(
    `insert into agent_runs
      (id, content_cycle_id, agent_name, status, input, output, error)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id("run"),
      input.cycleId,
      input.agentName,
      input.status,
      JSON.stringify(input.input),
      JSON.stringify(input.output),
      input.error ?? null,
    ],
  );
}
