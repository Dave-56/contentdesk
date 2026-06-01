create table if not exists organizations (
  id text primary key,
  slack_team_id text not null unique,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists brands (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  name text not null,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_cycles (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  brand_id text not null references brands(id) on delete cascade,
  status text not null,
  slack_channel_id text not null,
  slack_thread_ts text,
  approved_topic_artifact_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists artifacts (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  brand_id text not null references brands(id) on delete cascade,
  content_cycle_id text not null references content_cycles(id) on delete cascade,
  type text not null,
  status text not null,
  version integer not null,
  json_payload jsonb not null,
  created_by_agent text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists approvals (
  id text primary key,
  content_cycle_id text not null references content_cycles(id) on delete cascade,
  artifact_id text not null references artifacts(id) on delete cascade,
  gate text not null,
  status text not null,
  slack_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_runs (
  id text primary key,
  content_cycle_id text not null references content_cycles(id) on delete cascade,
  agent_name text not null,
  status text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists published_articles (
  id text primary key,
  organization_id text not null references organizations(id) on delete cascade,
  brand_id text not null references brands(id) on delete cascade,
  content_cycle_id text references content_cycles(id) on delete set null,
  publish_kit_artifact_id text,
  status text not null,
  source text not null,
  url text,
  slug text not null,
  title text not null,
  excerpt text not null default '',
  topic_summary text not null default '',
  target_queries jsonb not null default '[]'::jsonb,
  headings jsonb not null default '[]'::jsonb,
  published_at text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artifacts_cycle_type_idx on artifacts(content_cycle_id, type);
create index if not exists approvals_cycle_gate_idx on approvals(content_cycle_id, gate);
create unique index if not exists published_articles_brand_slug_idx on published_articles(brand_id, slug);
create unique index if not exists published_articles_brand_url_idx on published_articles(brand_id, url) where url is not null;
create unique index if not exists published_articles_publish_kit_idx on published_articles(publish_kit_artifact_id) where publish_kit_artifact_id is not null;
create index if not exists published_articles_brand_status_idx on published_articles(brand_id, status, updated_at desc);
