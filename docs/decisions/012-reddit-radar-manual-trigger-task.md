---
title: ADR 012 — Separate Manual Reddit Radar Trigger Task
updated: 2026-06-09
type: decision
status: current
---

# ADR 012 — Separate Manual Reddit Radar Trigger Task

## Decision
Keep scheduled Reddit Radar on `reddit-opportunity-scout` and add a separate manual Trigger
task, `reddit-opportunity-scout-now`, for `/contentdesk reddit-scout now`.

## Why
Trigger scheduled tasks receive schedule metadata as payload. A separate manual task keeps
operator input typed and explicit while sharing the same `runRedditOpportunityScout` runner.

## Revisit when
Trigger supports typed custom payloads for declarative scheduled tasks, or manual Reddit Radar
needs to share the exact same task id for external operational tooling.
