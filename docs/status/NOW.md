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
- Visibility loop: `npm run visibility:scan` selects prompts from
  `data/tiny-lemon/visibility/strategy.json`, scans selected prompts, and writes
  `data/tiny-lemon/visibility/runs/`.
- Website-first strategy inference: `npm run prompt:infer -- --url <url>` writes one editable
  `strategy.json` plus `site-profile.json` and `research-sources.inferred.json`; it does not
  select prompts or scan. `npm run prompt:select` rejects URL input and only uses reviewed
  strategy files.
- Buyer Prompt Strategist: `npm run prompt:select` writes
  `data/tiny-lemon/visibility/portfolio.json` and
  `data/tiny-lemon/visibility/prompts.selected.json`.
- Prompt scan env loading: `scripts/prompt-scan.ts` now imports `@/lib/load-env`, so
  `PERPLEXITY_API_KEY` can be read from `.env.local`.
- Verification on 2026-06-01: `npm test -- src/lib/buyer-prompt-strategist/infer.test.ts`
  passed, `npm run typecheck` passed, `npm run prompt:select` passed, and URL input to
  `prompt:select` correctly failed with the prompt-infer instruction.
- Repo memory ritual: `AGENTS.md` and `docs/SESSION_CHECKLIST.md` define the shared
  "update repo memory" stop routine; latest memory commit is `a058f71`.
- Last successful Tiny Lemon Perplexity scan: 2026-06-01. Output:
  `data/tiny-lemon/visibility/runs/2026-06-01.json`.
  Baseline: Tiny Lemon mentioned 0/20, cited 0/20, average visibility score 0.
  Competitor-only answers: 11/20 — the winnable hit list (rival named, Tiny Lemon absent).

## Blockers
- `PERPLEXITY_API_KEY` was not visible in `.env.local` during verification, so
  `npm run prompt:scan:selected` cannot run until the key is added with that exact name.

## Next 3 actions
1. Add/verify `PERPLEXITY_API_KEY` in `.env.local` with the exact variable name.
2. Review `data/tiny-lemon/visibility/strategy.json` after any `prompt:infer` run, especially
   competitors and buyer jobs, then run `npm run prompt:select`.
3. Improve citation/source intelligence for prompt scans, especially reducing `unknown`
   source-format and citation-quality classifications.
