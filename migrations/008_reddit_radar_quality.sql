-- Radar quality batch: promotability gating + prefilter audit trail.

-- Structured promo-risk level so surfacing can gate on it (promo_risk stays
-- free text for the Slack card explanation). Existing rows default to 'high'
-- because they predate the level and must not retro-surface.
alter table reddit_opportunities
  add column if not exists promo_risk_level text not null default 'high'
  check (promo_risk_level in ('low', 'medium', 'high'));

-- Every AI prefilter verdict, kept so rejected posts are judged once (not
-- re-sent to the model every run) and rejections stay reviewable.
create table if not exists reddit_prefilter_verdicts (
  id text primary key,
  reddit_post_id text not null unique,
  subreddit text not null,
  title text not null,
  url text not null,
  relevant boolean not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists reddit_prefilter_verdicts_relevant_created_idx
  on reddit_prefilter_verdicts(relevant, created_at desc);
