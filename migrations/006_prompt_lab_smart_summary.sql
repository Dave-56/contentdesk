alter table prompt_lab_engine_results
  add column if not exists smart_summary text not null default '';
