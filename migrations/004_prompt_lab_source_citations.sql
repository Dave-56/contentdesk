alter table prompt_lab_engine_results
  add column if not exists source_citations jsonb not null default '[]'::jsonb;
