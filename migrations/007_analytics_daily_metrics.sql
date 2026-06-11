create table if not exists analytics_daily_metrics (
  id text primary key,
  brand_slug text not null,
  metric_date date not null,
  source text not null,
  status text not null,
  provisional boolean not null default false,
  metrics jsonb not null default '{}'::jsonb,
  error text,
  window_start timestamptz not null,
  window_end timestamptz not null,
  pulled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists analytics_daily_metrics_brand_date_source_idx
  on analytics_daily_metrics(brand_slug, metric_date, source);

create index if not exists analytics_daily_metrics_brand_date_idx
  on analytics_daily_metrics(brand_slug, metric_date desc);

create table if not exists analytics_action_log (
  id text primary key,
  brand_slug text not null,
  action_type text not null,
  occurred_at timestamptz not null,
  source_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_action_log_brand_time_idx
  on analytics_action_log(brand_slug, occurred_at desc);
