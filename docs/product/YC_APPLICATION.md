---
updated: 2026-06-10
type: strategy
status: draft
---

# YC Application Draft — ContentDesk

Working doc from 2026-06-09 strategy session. Captures positioning decision + next steps.
Use as source material for the actual YC form and for roadmap sequencing.

---

## What is it? (one-liner)

> **ContentDesk is a $19/month growth agent for founders at zero — it finds the Reddit
> conversations where their customers are already asking for help, drafts the replies and
> content in their voice, keeps their brand covered in AI search, and reads their analytics
> so they never have to learn Google Analytics.**

Shorter: *"A growth employee for $19/month, for founders who can't afford one."*

Elevator floor: *"HubSpot's AEO tells you why AI ignores your brand. ContentDesk fixes it,
and shows you the customers it brought."*

## Why now?

- Search is migrating from ten blue links to AI answers. Reddit + community content feeds
  ~24–48% of AI citations; AI-referred traffic converts 4–23x better than average.
- The tooling wave chasing this shift is exploding: Profound raised $96M Series C at a
  **$1B valuation** (Feb 2026); Peec AI hit $4M ARR in 10 months; HubSpot shipped AEO at
  $50/mo with one-click draft-from-gap.
- **Every player sells monitoring + recommendations to brands that already have traffic,
  content teams, and budget.** The market's loudest complaint — "mentions are great, but
  did it get me customers?" — is unanswered.
- Nobody serves the founder at zero: pre-traffic, no marketing team, $50/mo is too much,
  GA/GSC are unintelligible. There are far more of them than brands with content ops.

## Why is this interesting? (the insight)

1. **Differentiate by stage, not features.** Feature depth converges in months (HubSpot
   already drafts content from visibility gaps). ICP-stage doesn't converge: enterprise
   tools structurally can't serve a $19 customer.
2. **Community presence IS AEO.** Answering Reddit threads is simultaneously customer
   acquisition today and AI-citation building for tomorrow. The radar compounds.
3. **The chore framing sets the price.** Founders won't pay $19 for a visibility score.
   They will pay $19 for an agent that removes chores: hunting Reddit manually, writing
   from a blank page, decoding GA/GSC dashboards.
4. **Founder = user.** Dogfooding ContentDesk to grow Tiny Lemon (Shopify app, just
   launched, fighting for first reviews/installs). Every feature is usage-voted.

## How does it work? (the loop)

**Source → Draft → Cover → Prove**, delivered in Slack:

1. **Source** — Reddit Opportunity Radar scouts buying-intent conversations on a schedule,
   AI-classifies fit for the brand, surfaces them in Slack. (Manual alternative: keyword-
   hacking Reddit search daily. Nobody does it consistently.)
2. **Draft** — replies drafted in the founder's configured voice ("skills", e.g. Tiny Lemon
   Reddit growth skill); articles drafted through the Slack approval workflow
   (research → topic → draft → QA → publish).
3. **Cover** — Prompt Lab tracks brand visibility across ChatGPT/Perplexity/Gemini daily
   (mention %, citations, competitor share of voice) and identifies gaps: missing content,
   listicles you're absent from. Insurance framing: you're *covered* for AI search.
4. **Prove** — (roadmap) weekly growth brief joins actions to outcomes: installs, AI-referral
   sessions, branded-query growth. Answers "did it get me customers?" with
   confidence-labeled evidence, not a vanity score.

## What do we have currently?

All shipped and running (Slack-native, multi-tenant by workspace, Postgres, Trigger.dev +
Vercel cron):

- **Reddit Opportunity Radar** — RSS-based (no Reddit API/approval needed), 5 subreddits
  every 2h, deterministic prefilter → AI classification → Slack surfacing with fit scores
  and drafted replies. Mute controls. *Currently thin: ~3 opportunities surfaced.*
- **Prompt Lab** — buyer-prompt tracking across engines, daily visibility metrics
  (`prompt_lab_daily_metrics`), citation analysis per engine answer.
- **Content workflow** — article drafting via Slack with approval gates, versioned
  artifacts, published-article tracking with target queries.
- **Infra patterns ready for reuse** — daily-metric cron, brand-scoped config JSONB,
  Slack bot as the delivery surface.

## AEO playbook scorecard (HubSpot CMO, 2026-06-10)

Kipp Bodnar (HubSpot CMO) published a 6-step AEO playbook with numbers from inside
HubSpot: AI search traffic 15x in one year, AI-search conversion 5–13x Google, 60% of AI
citations not in Google's top-20 results.

**Why we track it here:** (1) independent validation of the thesis from the biggest
incumbent — his "source of customers, not source of traffic" is literally our Prove
layer, and his 60%-citation stat corroborates the Ahrefs CMO finding already in NOW.md
(quote both in the "why now" answer). (2) It's a gap tracker for roadmap sequencing —
audited the codebase against each step on 2026-06-10; re-audit when steps ship. (3) His
conversion stats (5–13x) are the demo-moment ammo for the attribution layer.

| # | Kipp's step | ContentDesk today | Gap |
|---|---|---|---|
| 1 | Grade AEO presence across engines | `visibility:run` scans Perplexity/OpenAI/Anthropic; per-prompt 0–100 score; cross-provider synthesis; hourly metrics cron | CLI-only, not the planned free-tier grader; scans Anthropic instead of Gemini (runner exists, non-goal in NOW.md) |
| 2 | Restructure: chunked, answer-first pages | `seo-qa.ts` enforces one H1, ≥2 H2s, direct-answer opening, FAQ, tradeoff sections | No question-form-header rule, section-length cap, ToC, or consolidate-pages task type |
| 3 | Separate mentions from citations | Strongest area — mention/cite split **plus** recommendation state (recommended/top-pick/qualified/not), gap types, citation-quality classes, per-gap actions | Recommendation/sentiment classifier is regex, brittle; sentiment derived, not measured |
| 4 | Open up: Reddit presence + entity understanding | Reddit radar + drafted replies is the wedge; site profiling + brand-homonym guard measures entity confusion | Entity confusion treated as pipeline error (exit 1), not a sellable finding; no ungated/pricing/off-site checks |
| 5 | Tool up: track prompts + share of voice | We are the tool: `competitor_share_of_voice`, citation %, recheck dates | Week-over-week deltas not surfaced; prompt sets still lack demand evidence |
| 6 | Attribution: source of customers, not traffic | **Zero code.** Doc-only (Steps 2–3 below) | The whole layer — and it's our stated differentiator. Build next. |

Sequenced recommendations from the audit: attribution skeleton first (only step with
nothing built, and the market's unanswered complaint), then free-tier grader, Gemini
revisit, the four `seo-qa` rules, entity-clarity finding, SoV deltas in Slack.

## What do we need to change?

### Step 1 — Radar v2 (now): make the wedge undeniable

Bar: **10+ genuinely good opportunities/week, replies pre-drafted.** ("For $19 you really
have to give me good Reddit opportunities.")

Diagnosis: the funnel starves the AI. Only 5 subreddits' `/new.rss` (≤15 posts each), and an
exact-substring keyword prefilter (19 terms) gates posts **before** AI classification runs.
Smart judge, dumb bouncer.

Fix, biggest lever first (all in `src/lib/reddit-opportunities/`):

1. **Reddit search RSS** — add fetchers for `reddit.com/search.rss?q=...&sort=new` and
   `r/{sub}/search.rss?q=...&restrict_sr=1`. Flips radar from "watch 5 rooms" to "search
   all of Reddit for buying intent." Same approval-free RSS; few lines in `rss.ts`.
2. **Cheap-model prefilter** — replace the substring gate with a fast/cheap LLM pass on
   title+snippet ("is this someone with the problem the brand solves?"). Dedup by post ID
   before classifying; pennies/day at current volume. Catches *intent*, not vocabulary.
3. **Wider sources** — AI-proposed subreddit list from brand profile (r/printondemand,
   r/FashionStartup, r/EcommerceGrowth, ...); add `rising.rss` alongside `new.rss`.

### Step 2 — Metrics interpretation (next): the growth brief

Weekly plain-English brief posted by the existing Slack bot. Replaces the five-tab ritual
(PostHog, Shopify, GA, GSC, prompt lab). Contents: installs/uninstalls, AI-referral
sessions, GSC query movers, visibility changes, Reddit outcomes, 3 prioritized actions.
Storage: sibling table to `prompt_lab_daily_metrics` (e.g. `analytics_daily_metrics`),
fed by the same cron pattern; integration config lives in `brands.profile` JSONB.

**Integration recipe (dogfood-first, nothing needs anyone's approval):**

| Platform | How | Notes |
|---|---|---|
| Google Analytics 4 | Google Cloud **service account** → JSON key in env → add the service-account email as *Viewer* on the GA4 property → GA4 Data API | No OAuth consent screen needed for your own property. OAuth only later, for customers. |
| Search Console | Same service account → add its email as a *user* on the GSC property → Search Analytics API | Same key, two APIs. |
| Shopify (installs) | **Partner API**: Partner Dashboard → Settings → API clients → create token → GraphQL app events (installs, uninstalls, charges) | Self-serve, no Shopify approval. Customers later paste their own Partner token (Mantle pattern). |
| PostHog | Personal/project API key → query API | Trivial. |
| Reddit | Stays RSS | Approval-free. Accept rented-land risk; official-API free tier is the fallback. |
| Facebook / LinkedIn | **Don't integrate** (Groups API dead, LinkedIn closed) | Log manual posts (paste URL), measure outcome curves instead. |

### Step 3 — Attribution (later): layered evidence, confidence-labeled

1. *Confirmed*: AI-referral sessions (`utm_source=chatgpt.com`, perplexity referrer);
   tagged install-button clicks to the App Store listing.
2. *Likely*: timeline correlation — actions (Reddit post, article, new citation) vs.
   branded-query impressions, listing views, installs.
3. *Surveyed*: one onboarding question — "How did you hear about us?"

Honesty is the differentiator: confidence labels instead of a hand-wavy score.

## Business shape

- **Free tier**: limited visibility check (~10 tracked prompts, weekly refresh) — the
  RankIn-style top-of-funnel that converted us as a user.
- **Paid $19/mo**: the agent — radar with drafted replies, content drafting, growth brief.
- $1M ARR ≈ 4,400 subscribers at $19 (tiers can raise ACV later). Category ceiling proven:
  Profound $1B valuation; SEO-tool analogs (Semrush $400M+ ARR, Ahrefs $100M+ bootstrapped).
- Landscape for reference: HubSpot AEO $50 (bundled w/ Marketing Hub), RankIn $75 (free
  tier: AI Overviews + 10 prompts), Otterly $29, Scrunch/AthenaHQ ~$300, Profound enterprise.

## Next steps (sequenced)

1. [ ] Radar v2: search RSS + cheap-model prefilter + wider sources. Ship, then measure:
       ≥10 good opportunities/week for Tiny Lemon.
2. [ ] GA4 + GSC service account; PostHog key; Shopify Partner API token (env-level, dogfood).
3. [ ] `analytics_daily_metrics` table + daily pull cron (clone prompt-lab pattern).
4. [ ] Weekly growth brief → Slack.
5. [ ] Onboarding survey question in Tiny Lemon ("how did you hear about us?").
6. [ ] Attribution layer on top of 2–5.
