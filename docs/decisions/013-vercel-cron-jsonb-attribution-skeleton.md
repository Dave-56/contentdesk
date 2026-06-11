---
title: ADR 013 — Vercel Cron + Per-Source JSONB Rows for Attribution Skeleton
updated: 2026-06-10
type: decision
status: current
---

# ADR 013 — Vercel Cron + Per-Source JSONB Rows for Attribution Skeleton

## Decision
Run the daily analytics pull as a Vercel cron route (`/api/cron/analytics-daily`, hourly
schedule with a 9 PT in-route gate, cloning the prompt-lab cron shape) and store one row per
(brand_slug, metric_date, source) in `analytics_daily_metrics` with metrics as JSONB, instead
of a Trigger.dev task and per-metric typed columns.

## Why
- Pull is small and bounded (4 HTTP sources, <1 min), so Vercel cron + CRON_SECRET reuses a
  proven pattern; Trigger.dev adds a second env surface for no benefit at this size.
- Per-source rows make the run fail-soft and rerunnable: a source failure writes a
  failed/failed_auth/missing_config row instead of poisoning a wide row, and upsert on the
  unique key makes backfill idempotent.
- JSONB metrics lets each source keep its natural shape (GA4 AI-referrer splits, GSC branded
  splits, Partner event counts) while Phase 2 brief queries stay simple; typed columns can be
  promoted later once the brief stabilizes which fields matter.
- Status taxonomy + per-source Slack posting enforces "no silent zeros" — the visibility-run
  lesson where provider credit failures looked like real zero visibility.

## Revisit when
- Pull duration approaches Vercel function limits (more brands or heavier sources) → move to
  Trigger.dev.
- Phase 2 growth-brief queries need indexed aggregation over specific metric fields → promote
  those fields to typed columns or a view.
