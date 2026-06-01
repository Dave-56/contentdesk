---
title: ContentDesk — Start Here (MAP)
updated: 2026-06-01
type: living
status: current
---

# ContentDesk — Start Here

Entry point for any human or agent. Read this first, then drill only where needed.

**What:** Slack-first AEO/SEO operator for lean Shopify app founders. Finds the buyer
prompts where competitors get cited by AI/search and the founder does not, then turns
those gaps into founder-approved, publish-ready content.

**Where we are → read [`status/NOW.md`](status/NOW.md) first.** It is the single source of
operational truth: stage, live goal, non-goals, blockers, next actions.

---

## Right now (2026-06-01)

Building the bare bones of the **visibility layer**. The content-production pipeline already
works end to end. Driver is dogfooding **Tiny Lemon** (our own Shopify app) — prove
ContentDesk lifts Tiny Lemon's AI-search citations before selling it to anyone else.

Full detail: [`status/NOW.md`](status/NOW.md) · [`dogfood/README.md`](dogfood/README.md)

---

## Doc map (where knowledge lives)

| You want… | Read |
|---|---|
| Agent operating rules | [`../AGENTS.md`](../AGENTS.md) |
| Current operating state | [`status/NOW.md`](status/NOW.md) |
| What's next / roadmap | [`status/ROADMAP.md`](status/ROADMAP.md) |
| Open checkboxes | [`status/TASKLIST.md`](status/TASKLIST.md) |
| Decisions not to re-litigate | [`decisions/`](decisions/) |
| Why it sells / positioning | [`strategy/POSITIONING.md`](strategy/POSITIONING.md) |
| Pricing · sales · copy | [`strategy/`](strategy/) |
| How it's built | [`product/ARCHITECTURE.md`](product/ARCHITECTURE.md) |
| MVP spec | [`product/MVP_SPEC.md`](product/MVP_SPEC.md) |
| What we learned (Reddit, prompts) | [`research/`](research/) |
| Sales leads + teardown packets | [`leads/README.md`](leads/README.md) |
| Tiny Lemon dogfood | [`dogfood/README.md`](dogfood/README.md) |
| Narrative history / thesis | [`status/STATUS.md`](status/STATUS.md) |
| Superseded / dead docs | [`archive/`](archive/) |
| End-of-session ritual | [`SESSION_CHECKLIST.md`](SESSION_CHECKLIST.md) |

## Code map (implemented truth — don't read docs forever and miss this)

| Concern | Path |
|---|---|
| Workflow orchestration engine | `src/lib/workflow.ts` |
| Trigger.dev durable task | `src/trigger/content-cycle.ts` |
| Slack app entrypoint (commands, buttons) | `src/slack/app.ts` |
| Postgres data access | `src/lib/repository.ts` |
| Zod schemas (all artifact types) | `src/lib/schemas.ts` |
| Research Strategist | `src/lib/research/` |
| SEO Writer | `src/lib/writer/seo-writer.ts` |
| Editor / SEO QA gate | `src/lib/editor/seo-qa.ts` |
| Visual plan + image gen + QA | `src/lib/visual/` |
| Recommendation Card layer (AEO) | `src/lib/recommendation/` |
| Prompt-scan / citation analysis | `src/lib/prompt-scan/` |
| Reddit teardown tool | `src/lib/reddit-teardown/` |
| Publish kit + Codex handoff | `src/lib/publish-kit.ts`, `src/app/handoff/` |
| DB schema | `migrations/001_init.sql` |

Live experiment data: `data/tiny-lemon/visibility/`.

---

## How this memory is organized

- **Sorted by change-rate, not topic.** `status/` = living. `strategy/` + `product/` =
  stable. `research/` + `leads/packets/` = append-only data. `archive/` = dead.
- **One fact, one home.** Operational status lives only in `NOW.md`. Don't duplicate it.
- **Every file carries frontmatter:** `title`, `updated`, `type`, `status`. Trust freshness
  via `updated`; trust relevance via `status` (`current` | `superseded` | `archive`).
- **Supersession:** if a doc is still useful but overridden, keep it in place and add
  `superseded_by: <path>`. If reading it would mislead, move it to `archive/`.
