---
title: NOW — Current Operating Truth
updated: 2026-06-02
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
- Visibility recommendations: `npm run visibility:recommend` writes
  `data/tiny-lemon/visibility/recommendations.json` from `strategy.json`, latest run data,
  and `site-profile.json`. Current top action is **Build Botika alternatives page** because
  the Botika prompt cites comparison pages, Tiny Lemon is absent, no Botika-specific owned
  page was found in site-profile evidence, and the existing Modelia alternatives asset can
  be reused as the pattern.
- Verification on 2026-06-02: `npm test -- src/lib/visibility/recommender.test.ts`
  passed, `npm run typecheck` passed, and `npm run visibility:recommend` passed.
- Repo memory ritual: `AGENTS.md` and `docs/SESSION_CHECKLIST.md` define the shared
  "update repo memory" stop routine.
- Last successful Tiny Lemon Perplexity scan: 2026-06-01. Output:
  `data/tiny-lemon/visibility/runs/2026-06-01.json`.
  Baseline: Tiny Lemon mentioned 0/10, cited 0/10, average visibility score 0.
  Competitor-only answers: 7/10 — the winnable hit list (rival named, Tiny Lemon absent).

## Blockers
- _(none recorded — add as they appear)_

## Next 3 actions
1. Make site profiling store exact article URLs from sitemap/blog index so recommendations can
   cite the exact existing asset, not only `/blog`.
2. Build/publish the Botika alternatives page using the existing Modelia alternatives page
   pattern, then re-run `competitor-botika-alternatives`.
3. Add owned-site content inventory before full Shopify external asset audit; keep App Store,
   YouTube, reviews, community, and earned mentions as later V2 scope.
