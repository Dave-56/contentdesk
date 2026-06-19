import { query } from "@/lib/db";
import { id } from "@/lib/repository";
import {
  redditOpportunityMuteSchema,
  redditOpportunityRecordSchema,
  type RedditOpportunityClassification,
  type RedditOpportunityMute,
  type RedditOpportunityRecord,
  type RedditPost,
} from "@/lib/reddit-opportunities/schemas";

type OpportunityRow = {
  id: string;
  reddit_post_id: string;
  subreddit: string;
  title: string;
  url: string;
  content: string;
  published_at: Date;
  matched_terms: string[];
  fit: RedditOpportunityRecord["fit"];
  score: number;
  why_surfaced: string[];
  tiny_lemon_fit: string;
  promo_risk: string;
  promo_risk_level: RedditOpportunityRecord["promoRiskLevel"];
  suggested_angle: string;
  mention_recommendation: RedditOpportunityRecord["mentionRecommendation"];
  draft_reply: string;
  status: RedditOpportunityRecord["status"];
  slack_channel_id: string | null;
  slack_message_ts: string | null;
  created_at: Date;
  updated_at: Date;
};

type MuteRow = {
  id: string;
  scope: RedditOpportunityMute["scope"];
  value: string;
  reason: string;
};

export async function listRedditOpportunityMutes() {
  const result = await query<MuteRow>(
    "select id, scope, value, reason from reddit_opportunity_mutes order by created_at asc",
  );

  return result.rows.map((row) => redditOpportunityMuteSchema.parse(row));
}

export async function listKnownRedditPostIds(postIds: string[]) {
  if (postIds.length === 0) return new Set<string>();

  const result = await query<{ reddit_post_id: string }>(
    "select reddit_post_id from reddit_opportunities where reddit_post_id = any($1)",
    [postIds],
  );

  return new Set(result.rows.map((row) => row.reddit_post_id));
}

export async function listRejectedRedditPostIds(postIds: string[]) {
  if (postIds.length === 0) return new Set<string>();

  const result = await query<{ reddit_post_id: string }>(
    `select reddit_post_id from reddit_prefilter_verdicts
     where relevant = false and reddit_post_id = any($1)`,
    [postIds],
  );

  return new Set(result.rows.map((row) => row.reddit_post_id));
}

export async function recordRedditPrefilterVerdicts(
  entries: Array<{ post: RedditPost; relevant: boolean; reason: string }>,
) {
  if (entries.length === 0) return;

  await query(
    `insert into reddit_prefilter_verdicts
      (id, reddit_post_id, subreddit, title, url, content, relevant, reason)
     select * from unnest(
       $1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::boolean[], $8::text[]
     )
     on conflict (reddit_post_id) do update
     set content = excluded.content,
       relevant = excluded.relevant,
       reason = excluded.reason`,
    [
      entries.map(() => id("redditpf")),
      entries.map((entry) => entry.post.redditPostId),
      entries.map((entry) => entry.post.subreddit),
      entries.map((entry) => entry.post.title),
      entries.map((entry) => entry.post.url),
      entries.map((entry) => entry.post.content),
      entries.map((entry) => entry.relevant),
      entries.map((entry) => entry.reason),
    ],
  );
}

export async function listPendingRedditOpportunities(limit: number) {
  const result = await query<OpportunityRow>(
    `select * from reddit_opportunities
     where status = 'new' and fit in ('strong', 'medium')
     order by score desc, created_at asc
     limit $1`,
    [limit],
  );

  return result.rows.map(mapOpportunityRow);
}

export async function upsertRedditOpportunity(input: {
  post: RedditPost;
  classification: RedditOpportunityClassification;
  status?: RedditOpportunityRecord["status"];
}) {
  const result = await query<OpportunityRow>(
    `insert into reddit_opportunities
      (id, reddit_post_id, subreddit, title, url, content, published_at, matched_terms, fit, score,
       why_surfaced, tiny_lemon_fit, promo_risk, promo_risk_level, suggested_angle,
       mention_recommendation, draft_reply, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     on conflict (reddit_post_id) do update
     set subreddit = excluded.subreddit,
       title = excluded.title,
       url = excluded.url,
       content = excluded.content,
       published_at = excluded.published_at,
       matched_terms = excluded.matched_terms,
       fit = excluded.fit,
       score = excluded.score,
       why_surfaced = excluded.why_surfaced,
       tiny_lemon_fit = excluded.tiny_lemon_fit,
       promo_risk = excluded.promo_risk,
       promo_risk_level = excluded.promo_risk_level,
       suggested_angle = excluded.suggested_angle,
       mention_recommendation = excluded.mention_recommendation,
       draft_reply = excluded.draft_reply,
       updated_at = now()
     returning *`,
    [
      id("reddit"),
      input.post.redditPostId,
      input.post.subreddit,
      input.post.title,
      input.post.url,
      input.post.content,
      input.post.publishedAt,
      JSON.stringify(input.classification.matchedTerms),
      input.classification.fit,
      input.classification.score,
      JSON.stringify(input.classification.whySurfaced),
      input.classification.tinyLemonFit,
      input.classification.promoRisk,
      input.classification.promoRiskLevel,
      input.classification.suggestedAngle,
      input.classification.mentionRecommendation,
      input.classification.draftReply,
      input.status ?? "new",
    ],
  );

  return mapOpportunityRow(result.rows[0]);
}

export async function markRedditOpportunitySurfaced(input: {
  opportunityId: string;
  slackChannelId: string;
  slackMessageTs?: string;
}) {
  const result = await query<OpportunityRow>(
    `update reddit_opportunities
     set status = 'surfaced',
       slack_channel_id = $2,
       slack_message_ts = $3,
       updated_at = now()
     where id = $1 and status = 'new'
     returning *`,
    [input.opportunityId, input.slackChannelId, input.slackMessageTs ?? null],
  );

  return result.rows[0] ? mapOpportunityRow(result.rows[0]) : null;
}

export async function markRedditOpportunityReplied(opportunityId: string) {
  return updateRedditOpportunityStatus(opportunityId, "replied");
}

export async function skipRedditOpportunity(opportunityId: string) {
  return updateRedditOpportunityStatus(opportunityId, "skipped");
}

async function updateRedditOpportunityStatus(
  opportunityId: string,
  status: RedditOpportunityRecord["status"],
) {
  const result = await query<OpportunityRow>(
    `update reddit_opportunities
     set status = $2, updated_at = now()
     where id = $1
     returning *`,
    [opportunityId, status],
  );

  return result.rows[0] ? mapOpportunityRow(result.rows[0]) : null;
}

function mapOpportunityRow(row: OpportunityRow) {
  return redditOpportunityRecordSchema.parse({
    id: row.id,
    redditPostId: row.reddit_post_id,
    subreddit: row.subreddit,
    title: row.title,
    url: row.url,
    content: row.content,
    publishedAt: row.published_at.toISOString(),
    matchedTerms: row.matched_terms,
    fit: row.fit,
    score: row.score,
    whySurfaced: row.why_surfaced,
    tinyLemonFit: row.tiny_lemon_fit,
    promoRisk: row.promo_risk,
    promoRiskLevel: row.promo_risk_level,
    suggestedAngle: row.suggested_angle,
    mentionRecommendation: row.mention_recommendation,
    draftReply: row.draft_reply,
    status: row.status,
    slackChannelId: row.slack_channel_id,
    slackMessageTs: row.slack_message_ts,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}
