---
title: NOW — Current Operating Truth
updated: 2026-06-09
type: living
status: current
read_before: [docs/MAP.md]
---

# NOW

Single source of operational truth. If it conflicts with any other doc, **this wins.**
Keep it short and operational. Background goes in `STATUS.md`; the "why" goes in `decisions/`.

## Stage
Content-production pipeline works end to end (Slack → research → write → QA → visuals →
PublishKit → Codex handoff). Now building the **bare bones of the visibility layer** and
Tiny Lemon Reddit Radar — the AEO/community loop that runs buyer prompts, captures
citations, scores brand visibility, finds relevant Reddit opportunities, and keeps humans
in the approval loop.

## Live goal
Dogfood **Tiny Lemon** (our own Shopify app). Prove ContentDesk measurably lifts Tiny
Lemon's AI-search citations over a 30–60 day window before selling the loop to anyone.
Provider scope: Perplexity, OpenAI, and Anthropic are wired for prompt scans; real
multi-provider runs spend API credits and should be intentional. See
[`../dogfood/README.md`](../dogfood/README.md).

## Non-goals (do NOT chase)
- GitHub / Codex **publish automation** — handoff stays manual for the MVP.
- Broad dashboard / web UI — Slack stays the primary interface; small operator views are
  allowed when they make review/debugging easier.
- Gemini / Google AI Overviews direct scan — current provider set is Perplexity, OpenAI,
  and Anthropic.
- Automated Reddit posting or cold outreach — Reddit Radar can surface opportunities and
  draft replies, but humans decide and post.
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
- Slack default routing now has a rollback flag. `CONTENTDESK_SLACK_DEFAULT=topics` keeps
  the old `/contentdesk` Research Strategist topic-picker flow; `CONTENTDESK_SLACK_DEFAULT=visibility`
  makes `/contentdesk` show the latest validated visibility recommendation card instead.
  Slack remains the control surface and production runner, while visibility owns "what work
  should we do?" The visibility approval path re-reads `recommendations.json`, checks
  `runId` + recommendation hash for stale clicks, uses cycle status to avoid duplicate
  approvals, and fails closed for unsupported task types. Manual `/contentdesk article ...`,
  profile/setup/edit-profile, publish approval, and Reddit teardown paths remain available.
- Visibility recommendations: `npm run visibility:recommend` writes
  `data/tiny-lemon/visibility/recommendations.json` from `strategy.json`,
  `owned-content-inventory.json`, and either a single run or `--summary` synthesis file.
  Current `data/tinylemon-xyz/visibility/recommendations.json` top action is **Build
  Lalaland.ai alternatives page** because Lalaland.ai is recommended while Tiny Lemon stays
  neutral, no Lalaland.ai-specific owned page was found, and the existing Modelia
  alternatives asset can be reused as the pattern.
- Visibility foundation tracker: `docs/status/TASKLIST.md` has completed brand-neutral
  schemas, owned-site inventory, provider interface, OpenAI runner, Claude runner,
  cross-provider synthesis, recommender integration, and `visibility:run`.
- Owned content inventory crawler: `npm run visibility:profile -- --url <url> --out <dir>`
  writes `site-profile.json` and `owned-content-inventory.json`. It uses native fetch,
  sitemap discovery, common owned-content paths, same-domain links, canonical dedupe,
  crawl status fields, and inline AI understanding fields (`summary`, `primaryTopic`,
  `secondaryTopics`, `contentRole`, `audience`, `keyClaims`) when AI Gateway env is
  configured. CLI now supports `--max-pages`, `--max-depth`, `--timeout-ms`,
  `--max-bytes`, and `--no-understanding`, with progress logs for crawl and understanding.
  Tiny Lemon verification on 2026-06-03 found 10 pages, 10 crawled, 0 failed, and all 10
  understanding complete; all 5 website guides were retrieved, with alternatives/comparison
  pages classified separately from plain blog articles. DataJelly bounded verification
  (`--max-pages 10`) on 2026-06-03 found 10 pages, 10 crawled, 0 failed, and all 10
  understanding complete; `/faq` now classifies as `faq`, `/contact` as `other`.
  `owned-content-inventory.json` is the exact owned asset source of truth;
  `site-profile.json` stays broad brand/page context.
- Prompt scan and synthesis now track answer-level recommendation state, not only mention
  and citation. Prompt records can include `answerSignal` and `competitorSignals`; summaries
  count brand recommended, brand top-pick, competitor-recommended-only,
  cited-but-not-recommended, and recommended-but-not-cited states. Cross-provider synthesis carries
  `brandRecommendedProviders`, `brandTopPickProviders`, `competitorRecommendedOnlyProviders`,
  and recommendation-aware gap types such as `competitor_recommended_gap`, `proof_gap`,
  `citation_gap`, `recommendation_gap`, `top_pick_gap`, `mention_gap`, and `absent_gap`.
  `visibility:recommend` now emits `promptGaps` so Slack/cards can preserve the diagnosis
  behind the top task.
- Owned-content crawler caveat: full unbounded runs can be slow on larger sites because
  understanding is sequential. Use `--max-pages` while testing lead domains. Excerpts still
  include repeated nav/footer boilerplate, so extraction cleanup is still needed before using
  excerpt similarity as strong evidence.
- Verification on 2026-06-04: `npm run typecheck` and `npm test` passed after adding the
  Slack visibility adapter/card/approval path and recommendation-aware prompt-gap outputs.
- Verification on 2026-06-04: `npm test -- src/lib/visibility/site-inventory.test.ts`
  passed and `npm run typecheck` passed after adding owned-content crawler progress logs,
  CLI crawl bounds, and path-first page-type classification.
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
- HubSpot AEO / Reddit product read on 2026-06-05: Reddit/community recommendations need a
  promotability gate separate from citation presence. A cited Reddit thread is only useful
  for Tiny Lemon visibility when the thread pain maps to Shopify apparel/product-media work
  and a helpful comment can naturally disclose and mention Tiny Lemon. Promo-sensitive,
  founder-feedback, generic advice, and unrelated ecommerce threads should be marked weak,
  no-promo, or skip unless the goal is community reputation rather than brand visibility.
- Visibility run caveat on 2026-06-03: Anthropic prompt scans can fail because account
  credit is too low, but current output can still record a 0/10 provider run. Fix needed:
  prompt-level provider failures should mark the provider/run invalid or partial, not look
  like real zero visibility.
- Tiny Lemon Reddit Radar: scheduled Trigger task `reddit-opportunity-scout` monitors
  configured subreddits by RSS, prefilters by Tiny Lemon-relevant keywords/mutes,
  classifies and drafts opportunities, stores them in Postgres, and surfaces strong/medium
  Slack cards with `Mark replied` and `Skip` actions. Socket Mode Slack remains the runtime.
- Manual Reddit Radar control: `/contentdesk reddit-scout now` triggers
  `reddit-opportunity-scout-now` with the current Slack channel as override and replies
  ephemeral with the Trigger run id. The scheduled task stays `reddit-opportunity-scout`
  because Trigger scheduled-task payloads are schedule metadata.
- Trigger production deploy on 2026-06-09: version `20260609.4` deployed with 3 detected
  tasks, including `reddit-opportunity-scout-now`.
- Verification on 2026-06-09: `npm test -- src/lib/slack.test.ts src/lib/reddit-opportunities/reddit-opportunities.test.ts`
  passed all repo tests, and `npm run typecheck` passed after adding `/contentdesk
  reddit-scout now`.
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
- Owned-content extraction is still noisy: repeated nav/footer text appears in excerpts and
  should be stripped before excerpt-level matching or duplicate/weak-page scoring.
- Full-site owned-content profiling can still be slow because understanding calls run
  sequentially; larger lead-domain runs should use `--max-pages` until concurrency/timeout
  controls exist.
- Prompt-set quality needs demand evidence. LLM-generated buyer prompts are plausible, but
  should be strengthened with SERP, autocomplete/PAA, competitor titles, forums/reviews, and
  Search Console when available.
- AEO opportunity quality needs off-site evidence too. Some wins require getting included on
  third-party listicles/reviews/directories or creating video proof, not updating owned pages.
- Reddit/community opportunity quality needs thread-level promotability scoring. Current
  recommendation logic can infer `community_answer` from `reddit_thread` source format, but
  it does not yet preserve enough exact thread context or score natural brand-mention fit,
  promo risk, suggested angle, or CTA strength.
- Provider failure handling is incomplete for Anthropic credit errors during visibility runs.
- Slack visibility production runner currently supports page/guide-like tasks only:
  `alternative_page`, `comparison_page`, and `guide`. Recommendations such as
  `shopify_app_store_listing`, `community_answer`, and `manual_inspection` show in Slack but
  fail closed until fix-kit/reply/inspection production paths exist.
- Neon password should be rotated because a production DB URL was pasted in chat during the
  Reddit Radar setup.

## Deploy / ship
Branch pushes do **not** auto-create Vercel previews. Use the `vercel` CLI:
`vercel deploy --yes` (preview) or `vercel deploy --prod` (production at
`contentdesk-lake.vercel.app`). In a git worktree, copy the link first:
`cp -R <main-root>/.vercel .vercel`. Preview URLs return **401 to anonymous requests**
(Vercel deployment protection) — normal; view in a browser logged into the team. Engine
keys (`OPENAI`/`PERPLEXITY`/`GEMINI`) are **Production-only**, so previews can't run the
prompt-lab engines — only `ANTHROPIC_API_KEY` and DB are on Preview. No `gh` CLI: push, then
share the GitHub compare link. Project `contentdesk`, account `dave-56`. Commit/push only
when asked; branch off `master` first. Full runbook: **`.claude/skills/ship/SKILL.md`**
(`ship` skill).

## Next 3 actions
1. Rotate the Neon password used during Reddit Radar setup, then update Railway/Trigger env.
2. Add a read-only Reddit opportunities dashboard: recent opportunities, status/fit/subreddit
   filters, why surfaced, suggested angle, and draft reply.
3. Add production paths for non-article visibility tasks, starting with
   `shopify_app_store_listing` fix kits because the current Tiny Lemon recommendation can
   surface that task type.
