---
title: HubSpot AEO2 — Competition Notes
updated: 2026-06-07
type: research
status: current
---

# HubSpot AEO2 — Competition Notes

Purpose: compare HubSpot AEO2 against ContentDesk.

## Initial Frame

HubSpot likely wins on distribution, CRM context, marketing suite integration, and trust.
ContentDesk can win by being sharper for lean operators: prompt-level visibility, competitor
gaps, Slack workflow, and direct production of publish-ready fixes.

First confirmed mechanic: HubSpot creates prompts from a structured matrix:

```text
ICP x product/service x buyer journey phase x prompts per combination
```

This is simple and strong. It gives predictable prompt coverage and makes filters easy.
Risk: prompt count can balloon fast, especially if pricing/usage limits charge per prompt.

Second confirmed mechanic: HubSpot separates AEO reporting into dashboard metrics:

- brand visibility,
- sentiment score,
- share of voice,
- citation analysis.

This is a strong executive dashboard. It explains current state quickly. ContentDesk should
learn from the clarity, but compete on diagnosis and execution.

## Comparison Axes

| Axis | HubSpot AEO2 | ContentDesk |
|---|---|---|
| Target user | HubSpot users / marketers | Lean Shopify app founders |
| Main workflow | Generate prompt grid, scan answers, show citations/recommendations | Scan prompts, find gaps, produce fixes |
| Interface | Web dashboard | Slack-first |
| AI answer scanning | ChatGPT, Perplexity, Gemini shown in UI | Perplexity, OpenAI, Anthropic |
| Competitor tracking | Share-of-voice chart exists; manual competitor setup unknown | Prompt-level competitor signals |
| Owned-content inventory | Citation analysis shows owned/earned/channel views; inventory depth pending | Crawled site inventory |
| Recommendation type | Recommendations tab exists; details pending | Alternatives pages, comparisons, guides, listing fixes, community answers |
| Production path | Pending evidence | Research → write → QA → visuals → PublishKit |
| Weak spot | Prompt usage scales multiplicatively; recommendation/execution depth pending | Needs better demand evidence and off-site scoring |

## What To Watch

- If HubSpot owns reporting only, ContentDesk can win on execution.
- If HubSpot owns execution, ContentDesk needs sharper niche and faster workflow.
- If HubSpot is broad enterprise software, ContentDesk can stay vertical and opinionated.
- If HubSpot tracks mentions but not recommendations, ContentDesk's recommendation-aware scan matters.
- If HubSpot shows source/channel charts but does not say what to do next, ContentDesk can
  win by turning citation gaps into specific owned/off-site/community tasks.

## Product Lessons

- Add explicit segment math to ContentDesk prompt selection.
- Make prompt budgets obvious before generation.
- Keep buyer journey phases as first-class filters.
- Avoid runaway prompt counts by ranking segments before generation.
- ContentDesk advantage should be "best next fix", not only "more prompt reports".
- Do not conflate ICP and country in UX. Show market as its own dimension unless there is a
  strong reason to bundle it into ICP.
- Use simple formulas in UI. HubSpot's brand visibility tooltip is easy to understand.
- Treat share of voice as competitor pressure, not the same thing as brand visibility.
- Citation channel matters. Some AEO wins require Shopify marketplace, YouTube, review
  sites, earned media, or community mentions.
- One prompt can be more valuable than a whole dashboard if it reveals the buyer objection.
- Do not recommend a new asset before checking whether an existing asset already exists and
  needs proof/copy improvement.
- "Mentioned but not default winner" should become an objection-mining workflow, not a
  vanity metric.
- Citation analysis needs canonical URL grouping. Query params and locale variants should not
  create fake separate sources.
- Same prompt can produce engine-specific competitor drift and fact drift. Product should
  show cross-engine disagreement.
- Content handoff must include discovery wiring. New article/page is incomplete until
  canonical, sitemap, internal links, and `llms.txt` are handled where relevant.
- AI search is a mirror, not a magic channel. ContentDesk should use AI answers as a
  diagnostic for reputation, content clarity, source hygiene, and third-party proof.
- Prompt generation needs a standard. Seed prompts are not enough; users need business-fit
  scoring, demand evidence, and editable prompt strategy.

## ContentDesk Response Ideas

- Segment planner: show prompt count before scan.
- Segment score: prioritize segments by buying intent and revenue fit.
- Prompt cap: recommend best prompts under budget.
- Recommendation-aware scoring: mention, citation, and recommendation are separate states.
- Production bridge: every gap should become a concrete task, not only dashboard insight.
- Market coverage grid: product x ICP x market, with clear labels and budget impact.
- Citation-to-action mapper: if top cited source is off-site, recommend off-site inclusion;
  if owned content is absent, recommend page/update; if UGC dominates, recommend community
  answer path.
- Prompt answer teardown: split one AI answer into positives, objections, proof gaps,
  competitors, cited sources, and exact asset fixes.
- Existing asset audit: if Shopify App Store listing exists, inspect it against the exact
  objection before recommending create/update work.
- Citation debugger: show original cited URL, canonical URL, source type, brand mapping, and
  why the source likely appeared.
- Engine comparison view: show where ChatGPT, Gemini, Perplexity, and Claude disagree on
  pricing, competitors, citations, and recommendation.
- Fact-check queue: flag claims like "pricing appears to be $249/month" when source says
  pricing starts at $39/month.
- Publish contract: every generated fix kit includes site-specific steps for CMS publish,
  sitemap, `llms.txt`, canonical metadata, staging-domain cleanup, and prompt rerun schedule.
- Prompt standard: categorize prompts by buyer intent, product fit, competitor relevance,
  demand evidence, and expected actionability before adding them to tracking.

## Positioning Lesson

Do not sell:

```text
Rank in ChatGPT.
```

Sell:

```text
Measure how AI sees your business, then improve the evidence it can trust.
```

ContentDesk should track score over time, but always explain why score moved:

- reviews,
- mentions,
- citations,
- sentiment,
- competitor proof,
- source quality,
- listing clarity,
- third-party validation.

Action plan should be boring and useful:

- get reviews,
- fix listings,
- earn mentions,
- publish proof pages,
- answer niche buyer queries,
- clean source hygiene,
- update canonical discovery surfaces.

For new businesses:

```text
Care about AI search early, but use it as diagnostic.
If AI ignores you, it often means not enough outside-world proof exists yet.
```

## Prompt Strategy Lesson

Users may like HubSpot's generated prompts but still feel uncertain:

```text
Directionally good, but not totally accurate to our business.
```

ContentDesk should solve that gap.

Do not present prompts as magic.

Present prompts as hypotheses:

```text
This prompt tests whether AI understands your category.
This prompt tests whether AI recommends competitors.
This prompt tests whether buyers can compare your pricing.
This prompt tests whether your proof is strong enough.
```

Prompt sets should be editable and explainable. Stronger product:

- show prompt purpose,
- show buyer stage,
- show source/demand evidence,
- show expected content-calendar implication,
- let user approve/reject before tracking,
- learn from which prompts produce useful recommendations.
