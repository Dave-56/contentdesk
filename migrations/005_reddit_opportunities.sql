create table if not exists reddit_opportunities (
  id text primary key,
  reddit_post_id text not null unique,
  subreddit text not null,
  title text not null,
  url text not null,
  published_at timestamptz not null,
  matched_terms jsonb not null default '[]'::jsonb,
  fit text not null check (fit in ('strong', 'medium', 'weak', 'skip')),
  score integer not null default 0 check (score >= 0 and score <= 100),
  why_surfaced jsonb not null default '[]'::jsonb,
  tiny_lemon_fit text not null default '',
  promo_risk text not null default '',
  suggested_angle text not null default '',
  mention_recommendation text not null default 'no_mention' check (mention_recommendation in ('mention', 'no_mention')),
  draft_reply text not null default '',
  status text not null check (status in ('new', 'surfaced', 'replied', 'skipped')),
  slack_channel_id text,
  slack_message_ts text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reddit_opportunity_mutes (
  id text primary key,
  scope text not null check (scope in ('keyword', 'subreddit')),
  value text not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reddit_opportunity_mutes_scope_value_idx
  on reddit_opportunity_mutes(scope, lower(value));

create index if not exists reddit_opportunities_status_created_idx
  on reddit_opportunities(status, created_at desc);

create index if not exists reddit_opportunities_subreddit_published_idx
  on reddit_opportunities(subreddit, published_at desc);
