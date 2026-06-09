create table if not exists prompt_lab_questions (
  id text primary key,
  brand_slug text not null,
  question text not null,
  topic text not null,
  stage text not null,
  last_run_label text not null default 'Not run',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz
);

create table if not exists prompt_lab_batches (
  id text primary key,
  brand_slug text not null,
  scope text not null,
  run_date date not null,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists prompt_lab_runs (
  id text primary key,
  brand_slug text not null,
  batch_id text references prompt_lab_batches(id) on delete cascade,
  scope text not null default 'spot_check',
  run_date date,
  question_id text not null references prompt_lab_questions(id) on delete cascade,
  question text not null,
  requested_engines jsonb not null default '[]'::jsonb,
  status text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists prompt_lab_engine_results (
  id text primary key,
  run_id text not null references prompt_lab_runs(id) on delete cascade,
  batch_id text references prompt_lab_batches(id) on delete cascade,
  question_id text not null references prompt_lab_questions(id) on delete cascade,
  brand_slug text not null,
  engine text not null,
  provider text,
  status text not null,
  rank text,
  answer text not null default '',
  raw_answer text not null default '',
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table prompt_lab_runs
  add column if not exists batch_id text references prompt_lab_batches(id) on delete cascade,
  add column if not exists scope text not null default 'spot_check',
  add column if not exists run_date date;

alter table prompt_lab_engine_results
  add column if not exists batch_id text references prompt_lab_batches(id) on delete cascade;

create index if not exists prompt_lab_questions_brand_updated_idx
  on prompt_lab_questions(brand_slug, updated_at desc);

create unique index if not exists prompt_lab_batches_brand_scope_date_idx
  on prompt_lab_batches(brand_slug, scope, run_date);

create index if not exists prompt_lab_batches_brand_date_idx
  on prompt_lab_batches(brand_slug, run_date desc, started_at desc);

create index if not exists prompt_lab_runs_batch_question_idx
  on prompt_lab_runs(batch_id, question_id);

create index if not exists prompt_lab_runs_question_created_idx
  on prompt_lab_runs(question_id, created_at desc);

create index if not exists prompt_lab_engine_results_question_engine_created_idx
  on prompt_lab_engine_results(question_id, engine, created_at desc);

create unique index if not exists prompt_lab_engine_results_run_engine_idx
  on prompt_lab_engine_results(run_id, engine);
