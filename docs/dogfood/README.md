---
title: Tiny Lemon Dogfood — Overview
updated: 2026-06-01
type: living
status: current
read_before: [docs/status/NOW.md]
---

# Dogfood — Tiny Lemon

**The live focus.** Tiny Lemon is our own Shopify app. We use it as the first real test of
ContentDesk's visibility layer before selling the loop to anyone. Rationale:
[`../decisions/003-tiny-lemon-dogfood-first.md`](../decisions/003-tiny-lemon-dogfood-first.md).

## The experiment
- **Brand:** Tiny Lemon
- **Provider:** Perplexity (only, for now)
- **Goal:** make Tiny Lemon more mentioned/cited in AI buyer answers
- **Window:** 30–60 days · **Recheck cadence:** daily for now

## Success looks like
- Tiny Lemon appears in more answers.
- Tiny Lemon gets cited directly.
- Competitor-only answers become mixed answers.
- Owned/earned Tiny Lemon assets enter citations.
- Recommendations get more specific over time.

## Data layout

Everything for this experiment lives under `data/tiny-lemon/visibility/`.

```text
strategy.json          # source-of-truth inputs for selecting buyer prompts
prompts.all.json       # older/wider manual prompt set for broad scans
portfolio.json         # generated prompt candidates + scores + rationales
prompts.selected.json  # generated scan-ready selected prompt set
runs/                  # dated Perplexity scan outputs
```

## Run it
```
npm run visibility:scan      # normal path: select prompts, then scan selected prompts
```
- Strategy input: `data/tiny-lemon/visibility/strategy.json`
- Selected portfolio: `data/tiny-lemon/visibility/portfolio.json`
- Scan input: `data/tiny-lemon/visibility/prompts.selected.json`
- Scan output: `data/tiny-lemon/visibility/runs/YYYY-MM-DD.json`
- Code: `src/lib/prompt-scan/`

Debug commands:
```
npm run prompt:select        # selection only
npm run prompt:scan:selected # scan existing selected prompt file only
```

## Artifacts in this folder
- [`AI_SEARCH_SCAN.md`](AI_SEARCH_SCAN.md) — citation scan notes.
- [`AEO_RECOMMENDATIONS.md`](AEO_RECOMMENDATIONS.md) — recommendation backlog for Tiny Lemon.

Record each run's date + headline result in [`../status/NOW.md`](../status/NOW.md) under
"Last verified."
