---
title: NOW — Current Operating Truth
updated: 2026-06-01
type: living
status: current
read_before: [docs/MAP.md]
---

# NOW

Single source of operational truth. If it conflicts with any other doc, **this wins.**
Keep it short and operational. Background goes in `STATUS.md`; the "why" goes in `decisions/`.

## Stage
Content-production pipeline works end to end (Slack → research → write → QA → visuals →
PublishKit → Codex handoff). Now building the **bare bones of the visibility layer** —
the AEO loop that runs buyer prompts, captures citations, scores brand visibility, and
recommends the next asset.

## Live goal
Dogfood **Tiny Lemon** (our own Shopify app). Prove ContentDesk measurably lifts Tiny
Lemon's AI-search citations over a 30–60 day window before selling the loop to anyone.
Provider scope: **Perplexity only** for now. See [`../dogfood/README.md`](../dogfood/README.md).

## Non-goals (do NOT chase)
- GitHub / Codex **publish automation** — handoff stays manual for the MVP.
- Dashboard / web UI — Slack is the interface.
- Multi-provider scan (ChatGPT, Gemini, Google AI Overviews) — Perplexity only until the
  loop is proven.
- New Reddit lead generation / outreach — existing packets are reference, not active work.
- Pricing / billing build — spec'd, not built.

## Last verified
- Content pipeline: implemented (see `src/lib/workflow.ts`).
- Visibility loop: `npm run prompt:scan` runs against `data/tiny-lemon-prompts.json`,
  writes `data/prompt-runs/`. _Confirm last successful run date here when you run it._

## Blockers
- _(none recorded — add as they appear)_

## Next 3 actions
1. _Fill in_ — e.g. wire Recommendation Card layer into the workflow before writing begins
   (see "Target Flow" in `../product/ARCHITECTURE.md`).
2. _Fill in_ — establish a Tiny Lemon baseline scan + recheck cadence.
3. _Fill in._
