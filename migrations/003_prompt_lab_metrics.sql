alter table prompt_lab_engine_results
  add column if not exists visibility_score jsonb,
  add column if not exists answer_signal jsonb,
  add column if not exists competitor_signals jsonb not null default '[]'::jsonb;

create table if not exists prompt_lab_daily_metrics (
  id text primary key,
  batch_id text not null references prompt_lab_batches(id) on delete cascade,
  brand_slug text not null,
  run_date date not null,
  status text not null,
  engine_count integer not null,
  completed_answer_count integer not null,
  failed_answer_count integer not null,
  brand_mentioned_count integer not null,
  brand_cited_count integer not null,
  brand_recommended_count integer not null,
  brand_top_pick_count integer not null,
  sentiment_answer_count integer not null,
  sentiment_score numeric(6, 2) not null,
  visibility_pct numeric(6, 2) not null,
  citation_pct numeric(6, 2) not null,
  low_sample_size boolean not null,
  competitor_share_of_voice jsonb not null default '[]'::jsonb,
  source_mix jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists prompt_lab_daily_metrics_batch_idx
  on prompt_lab_daily_metrics(batch_id);

create index if not exists prompt_lab_daily_metrics_brand_date_idx
  on prompt_lab_daily_metrics(brand_slug, run_date desc);
