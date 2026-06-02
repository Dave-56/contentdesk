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
Provider scope: Perplexity, OpenAI, and Anthropic are wired for prompt scans; real
multi-provider runs spend API credits and should be intentional. See
[`../dogfood/README.md`](../dogfood/README.md).

## Non-goals (do NOT chase)
- GitHub / Codex **publish automation** — handoff stays manual for the MVP.
- Dashboard / web UI — Slack is the interface.
- Gemini / Google AI Overviews direct scan — current provider set is Perplexity, OpenAI,
  and Anthropic.
- New Reddit lead generation / outreach — existing packets are reference, not active work.
- Pricing / billing build — spec'd, not built.

## Last verified
- Content pipeline: implemented (see `src/lib/workflow.ts`).
- Visibility loop: `npm run prompt:scan:selected` runs one provider from
  `data/tiny-lemon/visibility/prompts.selected.json`; current config value is
  `provider: "perplexity"`. It writes `runs/YYYY-MM-DD.<provider>.json`.
- Multi-provider visibility job: `npm run visibility:run` runs Perplexity, OpenAI, and
  Anthropic against the selected prompts in memory, writes provider-specific run files,
  runs `visibility:synthesize`, and can run recommendations with `--recommend`. Provider
  failures are fail-soft: later providers still run, and partial synthesis records
  `providerErrors`.
- Cross-provider synthesis: `npm run visibility:synthesize` expects
  `runs/YYYY-MM-DD.perplexity.json`, `runs/YYYY-MM-DD.openai.json`, and
  `runs/YYYY-MM-DD.anthropic.json`, then writes `runs/YYYY-MM-DD.summary.json`.
- Website-first strategy inference: `npm run prompt:infer -- --url <url>` writes one editable
  `strategy.json` plus `site-profile.json` and `research-sources.inferred.json`; it does not
  scan. It uses AI Gateway structured classification when available to create
  `buyerLanguage`, `market`, and `classificationWarnings`. If classification is unavailable
  or fails, fallback strategy is review-only and `prompt:select` refuses to run until
  `buyerLanguage` exists.
- Buyer Prompt Strategist: `npm run prompt:select` writes
  `portfolio.json` and `prompts.selected.json` from a reviewed strategy file. Prompt
  assembly uses `buyerLanguage` nouns only; deterministic code validates and assembles,
  but does not try to understand market language. Helper:
  `scripts/prompt-workflow.sh infer <url>` then review strategy, then
  `scripts/prompt-workflow.sh select data/<slug>/visibility/strategy.json`.
- Prompt scan env loading: `scripts/prompt-scan.ts` now imports `@/lib/load-env`, so
  `PERPLEXITY_API_KEY` can be read from `.env.local`.
- Visibility recommendations: `npm run visibility:recommend` writes
  `data/tiny-lemon/visibility/recommendations.json` from `strategy.json`,
  `owned-content-inventory.json`, and either a single run or `--summary` synthesis file.
  Current top action is **Build Botika alternatives page** because the Botika prompt cites
  comparison pages, Tiny Lemon is absent, no Botika-specific owned page was found, and the
  existing Modelia alternatives asset can be reused as the pattern.
- Visibility foundation tracker: `docs/status/TASKLIST.md` has completed brand-neutral
  schemas, owned-site inventory, provider interface, OpenAI runner, Claude runner,
  cross-provider synthesis, recommender integration, and `visibility:run`.
- Owned-site raw inventory: `npm run visibility:profile -- --url https://tinylemon.xyz --out data/tiny-lemon/visibility`
  writes `owned-content-inventory.json`. Latest Tiny Lemon profile found 8 owned assets:
  3 profile pages and 5 blog articles. `owned-content-inventory.json` is the exact owned
  asset source of truth; `site-profile.json` stays broad brand/page context. No
  classification/story layer yet.
- Verification on 2026-06-02: `npm test -- src/lib/prompt-scan/provider.test.ts src/lib/visibility/synthesis.test.ts src/lib/visibility/recommender.test.ts`
  passed, `npm run typecheck` passed, and temp-file full/partial synthesis plus
  recommendation smokes passed.
- Buyer-prompt inference verification on 2026-06-02: AI Gateway env loads through
  `@/lib/load-env`; previous classifier fallback was caused by AI Gateway rejecting optional
  structured-output fields, not by a missing key. Schema now requires `comparisonNoun` and
  `warnings`; direct classifier test passed for Beatable. `npm run prompt:infer -- --url
  https://beatable.co/` wrote `data/beatable/visibility/strategy.json` with
  `buyerLanguage`, and `npm run prompt:select -- data/beatable/visibility/strategy.json
  --out data/beatable/visibility` selected 10/12 prompts. Generated prompts are usable but
  still show quality risks: competitor inference can be noisy and product nouns such as
  "validator" may be too terse.
- Repo memory ritual: `AGENTS.md` and `docs/SESSION_CHECKLIST.md` define the shared
  "update repo memory" stop routine.
- Last successful Tiny Lemon Perplexity scan: 2026-06-01. Output:
  `data/tiny-lemon/visibility/runs/2026-06-01.json` before provider-specific filenames;
  new scans write `YYYY-MM-DD.perplexity.json`.
  Baseline: Tiny Lemon mentioned 0/10, cited 0/10, average visibility score 0.
  Competitor-only answers: 7/10 — the winnable hit list (rival named, Tiny Lemon absent).
- Last attempted multi-provider Tiny Lemon run: 2026-06-02. Perplexity wrote
  `data/tiny-lemon/visibility/runs/2026-06-02.perplexity.json` with Tiny Lemon mentioned
  0/10, cited 0/10, competitor-only 8/10, average visibility 0. OpenAI failed with 429
  insufficient quota; Anthropic was not reached before fail-soft orchestration was added.
- Last successful multi-provider Tiny Lemon run: 2026-06-02. `npm run visibility:run`
  wrote `2026-06-02.perplexity.json`, `2026-06-02.openai.json`,
  `2026-06-02.anthropic.json`, and `2026-06-02.summary.json`. Results: Perplexity
  mentioned 0/10, cited 0/10, competitor-only 9/10, average visibility 0; OpenAI mentioned
  1/10, cited 1/10, competitor-only 8/10, average visibility 7; Anthropic mentioned 0/10,
  cited 0/10, competitor-only 10/10, average visibility 0. Synthesis covered 10 prompts,
  3 providers, 0 failed providers, and 9 repeated gaps. `npm run typecheck` passed after
  the run. OpenAI web-search calls are materially slower than Perplexity and Anthropic.

## Blockers
- Fresh URL strategy quality now depends on AI Gateway classification. Without it, inferred
  strategies are intentionally review-only and cannot select prompts.
- Competitor inference for non-Tiny-Lemon SaaS can still pull noisy domains from broad search
  results.

## Next 3 actions
1. Tighten `prompt:infer` competitor filtering and add manual-review warnings when competitor
   evidence is weak or broad.
2. Add buyerLanguage quality checks for too-generic `productNoun`/`comparisonNoun` values
   before `prompt:select` writes selected prompts.
3. Add request timeout, bounded prompt concurrency, and skip-existing/force controls for
   `visibility:run`; OpenAI web search is slow enough to make sequential scans painful.
