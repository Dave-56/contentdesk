---
title: NOW — Current Operating Truth
updated: 2026-06-03
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
  scan. Current path is Perplexity-only for business understanding, anchored to the exact
  target URL/domain and first-party site context. Parallel is not used by `prompt:infer`.
  `site-profile.json` carries `profileSources` as Perplexity citations plus
  `profileWarnings`.
- Vanishing rule: if static scrape + search enrichment can't confirm enough product evidence,
  `prompt:infer` stops (`InsufficientSiteProfileEvidenceError`), writes the profile + sources
  for review, and exits 1 — it never falls through to generic software prompts.
- Brand-homonym guard: when relevant sources share the brand name but resolve to many
  distinct domains and none reference the target domain (e.g. xenith.life → MetaStock/football
  /sleeping-bag "Xenith"), evidence is capped (never `strong`), downgraded to `insufficient`
  when static text is also thin, and a `manual_review` warning is added.
- Manual-review gate: `prompt:select` refuses when `strategy.classificationWarnings` contains
  any `manual_review` entry (not just when `buyerLanguage` is missing). Pass `--force` to
  override after human review. Verified on xenith.life: classifier flagged brand ambiguity →
  select refused.
- Fallback strategy is brand-neutral: when AI classification is unavailable/fails, the
  keyword fallback derives category/use-cases generically (no product-specific hardcodes),
  stays review-only, and `prompt:select` refuses to run until `buyerLanguage` exists.
- Buyer Prompt Strategist: `npm run prompt:select` writes
  `portfolio.json` and `prompts.selected.json` from a reviewed strategy file. Prompt
  selection now uses LLM-drafted buyer questions from the reviewed `strategy.json`; code
  still owns validation, dedupe, portfolio size, group balance, file writes, and
  manual-review gating. Helper:
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
- Lead teardown learning on 2026-06-03: runs for DataJelly, Coolie, ScreenFlowy, and
  Insider Alpha showed the same pattern: brand/comparison prompts often work, but broad
  buyer questions are where competitors win. Google SERPs and customer-owned blog indexes
  materially changed recommendations. The next recommendation layer needs owned-content
  inventory before saying "write new guide", demand-backed buyer-question discovery before
  final prompt sets, cited-source analysis, and gap classification before work orders.
- Coolie finding: Coolie has many blog posts, but sample posts were broad/product-story
  content. Gap is not "no blog"; gap is buyer-question framing. Recommendation should be
  "update/expand the right existing post" when owned content exists, not default to new
  content.
- DataJelly finding: DataJelly already has a strong guide library. Recommendation should
  expand existing guides such as "Why Pages Break After Deploy (And No One Notices)" or
  "Guard Test Suite: What We Monitor" when they can answer the discovered buyer question.
- Ahrefs CMO research note on 2026-06-03: AI-search optimization is not SEO with schema.
  Reported findings: "Best X" listicles are heavily cited by ChatGPT, many top citations
  are from sources marketers cannot directly edit, cited AI pages can have zero Google
  organic visibility, retrieved URLs and cited URLs are different, schema has little
  measured citation lift, YouTube mentions correlate strongly with AI brand visibility, and
  AI citation sources churn while answer meaning stays stable. Product implication: track
  owned content, off-site inclusion, listicle/review opportunities, YouTube/video assets,
  retrieved-vs-cited states, and re-test trends over time.
- Visibility run caveat on 2026-06-03: Anthropic prompt scans can fail because account
  credit is too low, but current output can still record a 0/10 provider run. Fix needed:
  prompt-level provider failures should mark the provider/run invalid or partial, not look
  like real zero visibility.
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
- Recommendation quality now depends on knowing owned content. Without blog/guide inventory,
  the system can recommend creating pages the customer already has.
- Prompt-set quality needs demand evidence. LLM-generated buyer prompts are plausible, but
  should be strengthened with SERP, autocomplete/PAA, competitor titles, forums/reviews, and
  Search Console when available.
- AEO opportunity quality needs off-site evidence too. Some wins require getting included on
  third-party listicles/reviews/directories or creating video proof, not updating owned pages.
- Provider failure handling is incomplete for Anthropic credit errors during visibility runs.

## Next 3 actions
1. Build owned-content inventory crawler for blog/guides/docs/comparison pages and attach
   page title, URL, H1, meta, summary, buyer question, topic, type, and freshness.
2. Add buyer-question discovery and scoring from demand evidence: Google SERP,
   autocomplete/PAA, competitor titles, forums/reviews, AI answers, and Search Console when
   available.
3. Add recommendation gap classifier: missing page, weak existing page, off-site citation
   gap, comparison gap, proof/case-study gap, and prompt-set gap, then output page-level work
   orders.
