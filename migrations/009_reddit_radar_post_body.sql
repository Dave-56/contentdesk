-- Persist the raw Reddit post body at both funnel stages.
--
-- The body is the exact text the AI reads to judge relevance (prefilter) and
-- fit (classification), but it was never stored — only title/url survived. Keep
-- it so we can audit what the model actually saw and tune prompts against real
-- retrieved data instead of guessing. Existing rows default to '' (body lost).

alter table reddit_prefilter_verdicts
  add column if not exists content text not null default '';

alter table reddit_opportunities
  add column if not exists content text not null default '';
