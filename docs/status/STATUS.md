---
title: ContentDesk Status
updated: 2026-05-31
type: living
status: current
---

# ContentDesk Status

Last updated: 2026-05-30

## Current Thesis

ContentDesk is evolving from a generic content workflow into an AI-search / SEO execution layer for lean founders.

Core promise:

```text
From prompt gap to publish-ready page.
```

Customer-language version:

```text
Stop wasting weeks in keyword tools. Find the one high-intent buyer question, comparison page, or guide worth publishing next.
```

Longer version:

```text
ContentDesk helps lean founders identify the buyer questions where competitors show up and they do not, then turns those gaps into founder-approved, crawlable, answer-first content designed to improve their odds of being cited or recommended by AI search.
```

The product should not promise guaranteed rankings, traffic, or AI citations. It should promise a trustworthy operating loop:

```text
track prompts
-> find gaps
-> diagnose why competitors/sources are winning
-> recommend the next asset
-> create the publish kit
-> get founder approval
-> publish or hand off
-> recheck later
```

## Phase 1: Problem Discovery

We posted a Reddit problem-discovery question asking whether teams use citation data or prompt-gap data to decide what content to create next.

The story used:

- We recently launched a Shopify app.
- We are a lean team without time to become SEO/AEO specialists.
- We want organic traffic and AI-search visibility.
- We are trying to understand whether prompt/citation tracking actually changes what teams publish.

### What We Learned

The market is early, skeptical, but not dismissive.

Common Reddit signal:

```text
Prompt/citation data is useful.
Visibility scores alone are not enough.
The real value is deciding what to publish or update next.
The hard part is turning gap data into execution.
Attribution is imperfect, but directional movement is observable.
```

Working attribution model:

```text
ContentDesk should track AI-influenced demand, not pretend AI attribution is solved.
The evidence stack should include AI referral traffic, branded search growth, direct traffic growth, self-reported attribution, demo/signup notes mentioning AI tools, session recordings from tools like Microsoft Clarity or PostHog, and prompt/citation movement after assets are shipped.
```

The clearest validated pain:

```text
How do we turn prompt gaps, citation gaps, competitors, and visibility data into an actual publishing workflow?
```

Execution specifically means:

```text
1. Decide whether the prompt matters commercially.
2. Inspect which sources and page types AI systems are citing.
3. Understand why the competitor or third-party source is winning.
4. Classify the gap: comparison, FAQ, guide, product page, technical crawlability, offsite citation, or market segment.
5. Choose the right asset type.
6. Write the brief.
7. Draft the page, post, FAQ, comparison, or update.
8. Make it answer-first, structured, crawlable, and citeable.
9. Package it for founder approval.
10. Publish or hand off.
11. Recheck visibility after a realistic window.
```

Important doc:

- `LEARNINGS_FROM_REDDIT.md`

## Phase 2: Concierge Teardown

We then tested whether founders would submit their websites for a free "what should I publish next?" teardown.

The offer asked for only a website. We intentionally did not ask for competitors, keywords, analytics access, or long forms.

What we promised each teardown would cover:

1. What category we think the site is competing in.
2. The buyer questions people are likely asking before choosing a product like theirs.
3. Who or what seems to show up for those questions.
4. What kinds of pages are getting surfaced: comparisons, FAQs, guides, directories, Reddit threads, etc.
5. The one page, FAQ, guide, or comparison asset they should publish next.
6. Why that page is likely worth publishing.
7. How to structure it so it is useful, crawlable, and easy for search/AI tools to understand and cite.

### Intake Signal

The post received meaningful interest in `r/SideProject`:

- 690+ views at the time observed.
- Multiple website submissions.
- At least one explicit "this sounds useful" response.
- Roughly 15 collected leads in `REDDIT_TEARDOWN_LEADS.md`.

This validates that founders respond more to:

```text
Drop your website and I will tell you what page to publish next.
```

than to:

```text
Try another AEO tracker.
```

### Current Leads

Tracked in:

- `REDDIT_TEARDOWN_LEADS.md`

Example submitted sites include:

- `saasniche.com`
- `getsounth.com`
- `tableai.org`
- `cartoart.net`
- `microlaunch.net/premium`
- `nordicrealestateservices.com`
- `verydrm.com`
- `edititdown.com`
- `saaswall.co`
- `everylastmile.app`
- PillNudge App Store listing

### Teardown Packets Started

Detailed teardown/research packets exist for:

- `saasniche.com.md`
- `getsounth.com.md`
- `nordicrealestateservices.com.md`
- `verydrm.com.md`
- `everylastmile.app.md`

These packets are long internal strategy audits. They are useful for learning and product design, but too long for Reddit replies.

Current lesson:

```text
Separate the internal research packet from the public founder reply.
```

The public reply should be much shorter and focus on:

```text
category
buyer questions
what shows up
one page to publish
why
structure
```

## Phase 2 Learnings

### 1. Founders Submit Sites When The Offer Is Concrete

The core hook worked:

```text
What page should your startup publish next for SEO / AI search?
```

This is stronger than AEO jargon.

### 2. Blogs Are A Good Filter

We began prioritizing sites that already have blogs or content libraries.

Reason:

```text
They already believe in content. The problem is not convincing them to start content; it is showing that their current content does not map cleanly to high-intent buyer questions.
```

### 3. The Common Gap Is Often Query-Match / Hub Gap

Many recommendations are not "you have no content."

They are:

```text
You have pieces, but not the exact page or hub that answers the buyer-intent prompt directly.
```

Examples:

- SaasNiche: `How to Find Validated SaaS Ideas from Reddit Pain Points`
- Sounth: `Best App to Remind You When to Water Plants`
- Nordic/Solsten: `How to Underwrite a Commercial Real Estate Deal from a T-12 and Rent Roll`
- VeryDRM: pain-led PDF protection / DRM page clarifying password protection vs secure sharing vs true DRM
- EveryLastMile: mileage tracker / gig-driver tax prompt clusters

### 4. The Manual Workflow Is Heavy

The manual teardown process is tiring and does not scale.

It requires:

```text
read site
infer category
infer buyer
inspect existing content
generate buyer prompts
validate prompts in search/AI
identify competitors and surfaced source types
classify gap
recommend one asset
write founder-ready reply
```

This validates the product need internally: ContentDesk should automate the research packet and help a human approve the final recommendation.

## Important Workflow Docs

- `workflow.md`: step-by-step Reddit teardown workflow.
- `questions.md`: detailed question checklist for the teardown agent.
- `REDDIT_TEARDOWN_LEADS.md`: lead tracker.
- `LEARNINGS_FROM_REDDIT.md`: synthesized market learnings from Reddit comments.
- `CONTENTDESK_AEO_POSITIONING_SPEC.md`: positioning and product thesis.

## Competitor Context

The space is crowded and moving fast. Two clusters have formed: **trackers/dashboards** (show you the gap) and **execution agents** (close the gap). ContentDesk is being pulled toward the execution side, where the field is thinner but the trust bar is higher.

### Cluster A: Trackers and dashboards (visibility-first)

These tell you how often your brand appears in ChatGPT/Perplexity/Gemini/etc., which sources are cited, and where share of voice is moving. They mostly do **not** ship the asset that closes the gap.

- **HubSpot AEO** — Visibility score, prompt tracking, citation analysis, prioritized recommendations across ChatGPT, Perplexity, Gemini. Bundled with Marketing Hub Pro/Enterprise, or standalone at $50/mo for 25 prompts. Lowest-friction on-ramp because of HubSpot's existing footprint. Threat: when the buyer already has HubSpot, marginal cost to add AEO is near zero.
- **Otterly.ai** — Brand Visibility Index, domain/URL citation tracking, GEO audits, multi-brand workspaces. Tiered prompt-based: $29 (10 prompts) → $189 (100) → $989 (1,000). Strong prosumer pricing; thin on execution.
- **Peec.ai** — Daily prompt tracking across ChatGPT/Perplexity/Gemini, mentions-vs-citations split, sentiment, Looker Studio connector. Notable "Actions" feature splits opportunities into **Owned Media** (pages to create) and **Earned Media** (citations to earn). $95 Starter / $245 Pro / custom Enterprise. The Owned/Earned split is a directional cue for ContentDesk's recommendation framing.
- **Profound** — Enterprise-tier tracker across 10+ AI platforms (ChatGPT, Perplexity, Claude, Gemini, Grok, Copilot, Meta AI, DeepSeek, Google AIO, ChatGPT Shopping). Unique **prompt volume data** by topic/demographic, plus GA integration for AI-crawler and conversion data. $99 Starter (ChatGPT only, funnel tier) → effective entry $399–$499/mo Growth → custom Enterprise. Has an "Agents" feature generating briefs/drafts — pushing into ContentDesk's territory at the high end.
- **Semrush AI Visibility Toolkit** — Add-on to Semrush, launched Sep 2025. Visibility tracking, Prompt Research with AI Topic Volume, competitor gap analysis, sentiment. Wins on distribution: anyone already paying for Semrush gets it as an upsell, not a separate purchase decision.

### Cluster B: Execution agents (gap → asset → ship)

These promise to **do the work**, not just show the gap. This is where ContentDesk is heading and where competition is sharper.

- **Bonemeal** — "AI growth engineer" monitoring search, social, and the site, then shipping the next growth action. Tracks 7 AI engines with mention/citation/sentiment data. Notable: ships an **open-source GEO toolkit for Claude Code / Cursor / Gemini / Codex** that audits sites and spawns pages from query fan-out inside the editor. Plus/Pro/Max tiers, 7-day trial. Closest broad-vision competitor on the autonomous-growth-agent path.
- **Leapd.ai (Alex)** — "An AI agent that tracks, analyzes, and **acts**." Autonomous playbooks audit the site, analyze competitors, generate full articles with images/citations/schema, and deliver weekly reports. Tracks 7 engines (ChatGPT, Gemini, Perplexity, Google AIO, AI Mode, Claude, Grok). Most explicit "agent, not dashboard" framing in the category — the exact narrative ContentDesk must differentiate from.
- **RankPrompt** — Generates 6 content types (comparison articles, ranked lists, location pages, case studies, product deep-dives, FAQs) with images and schema. Has **automated off-page outreach** for earning external citations and **neighborhood-level local tracking**. Agency plan $149/mo. The outreach + local angles are sharper wedges than ContentDesk currently has.
- **Averi.ai** — Positions as "the Cursor for marketing." All-in-one AI marketing workspace: Brand Core for voice/positioning, AI topic recommendations from keyword + market trend analysis, AI drafting with GEO built in, direct publishing to **Webflow, Framer, and WordPress**, plus a marketplace of vetted US-based marketing experts inside the workspace. Solo $99/mo; Team and Agency tiers listed as coming soon. Reports 3–5x content output and 6-week → 6-day campaign timelines. Closest to the **content supply chain for lean companies** path. Notable: the human-expert marketplace is a trust layer none of the pure-software competitors have.

### Read of the landscape

```text
Trackers (HubSpot, Otterly, Peec, Profound, Semrush) are commoditizing fast.
Pricing has cratered at the entry tier ($29-$99).
Execution agents (Bonemeal, Leapd, RankPrompt, Averi) are where defensibility lives.
Distribution incumbents (HubSpot, Semrush) win on bundling, not product.
```

Implications:

```text
Generic "AI growth agent" is crowded - Bonemeal, Leapd, Averi all there.
Generic "AEO dashboard" is crowded and commoditized.
Generic "AI content engine for startups" is crowded.
The thin slice is: trustworthy, founder-approved, one-asset-at-a-time execution
  for sites that already publish content but have hub/query-match gaps.
```

Current recommended wedge:

```text
The content strategist for founders who need one high-confidence SEO/AEO page at a time.
```

Or:

```text
Rigorous prompt-gap -> founder-approved content kit workflow.
```

Sharper sub-wedges worth testing against this competitor set:

- **Founder-in-the-loop approval gate.** Bonemeal, Leapd, and RankPrompt are tilting toward auto-ship. ContentDesk's "founder approves the kit before publish" reads as a trust differentiator for buyers who got burned by autonomous content.
- **One-page-at-a-time cadence.** Everyone else sells throughput (3-5x output, X articles/mo). ContentDesk can sell *confidence per page* — the inverse positioning.
- **Vertical depth over horizontal coverage.** Averi and Leapd are horizontal. Picking one vertical (Shopify apps, indie SaaS, local services) and out-knowing the field is still open.
- **Owned + Earned split as the recommendation frame** (borrowed from Peec) — but with the **execution** layer attached, which Peec lacks.

Avoid competing head-on as a broad AI growth engineer.

## Product Direction

The user-facing UX should be simple:

```text
Here is the next page to publish.
Here is why it matters.
Here is the publish-ready kit.
Here is when we will recheck it.
```

Behind the scenes, ContentDesk needs a serious prompt intelligence engine:

```text
Brand understanding
Buyer persona modeling
Prompt generation
Prompt clustering
Journey mapping
AI/search answer testing
Competitor/entity extraction
Citation/source analysis
Existing content inspection
Gap classification
Asset prioritization
Content generation
QA/citeability checks
Recheck scheduling
```

Do not frame MVP as a 24/7 always-on agent.

Better framing:

```text
cadence-based checks
living market memory
alerts only for meaningful changes
```

The founder should set cadence:

- weekly
- biweekly
- monthly
- ad hoc

Future branch: technical SEO/AEO hygiene recommendations.

The MVP remains content-first, but the broader product can later handle technical hygiene recs such as `/llms.txt`, page titles, canonical links, Open Graph images, schema, crawlability, and AI-readable page structure.

The same loop applies:

```text
recommendation -> validation -> implementation-ready fix/kit -> Codex handoff -> recheck
```

Important distinction:

```text
Crawl-aware tools can find the issue.
Repo-aware tools know how to fix it correctly in the actual codebase.
```

The desired future is Slack + Codex collaboration:

```text
ContentDesk identifies and validates the SEO/AEO recommendation in Slack.
ContentDesk creates a repo-aware handoff task.
Codex applies the fix in the Tiny Lemon repo or another connected workspace.
ContentDesk rechecks the affected pages later.
```

## Long-Term Vision Paths

The market is crowded, so the most interesting paths pull away from dashboards and toward execution.

- **AI-search content OS**
  - Own the loop from prompt gap -> asset recommendation -> draft -> publish -> recheck.
  - Start with pages, then expand to FAQs, comparisons, docs, videos, listings, and refreshes.
- **Autonomous growth agent for SMBs**
  - A founder gives the agent their site, product, and goals; the agent keeps finding and shipping growth work.
  - SEO/AEO can be the first wedge, then expand to email, lifecycle, ads, landing pages, and community replies.
  - Currently exciting to the founder.
- **Verticalized agent for one market**
  - Go deep in one market, such as Shopify apps, local service businesses, B2B SaaS, medical practices, or law firms.
  - Win by knowing the buyer questions, page types, proof points, compliance needs, and publishing patterns better than generic agents.
  - Currently exciting to the founder.
- **AI visibility execution layer for existing tools**
  - HubSpot, Semrush, Ahrefs, or AEO dashboards show the gap; ContentDesk becomes the "create the fix" layer.
  - Potential API/infrastructure path, but harder to own the customer relationship.
- **Agentic CMS / publishing layer**
  - Move from recommending content to directly creating, updating, and refreshing pages on the site.
  - Includes service pages, comparison pages, FAQs, schema, internal links, and content refreshes.
  - This should be a publishing execution layer, not a Framer/Webflow/WordPress replacement.
  - Early integration paths:
    - WordPress sites via REST API/Application Passwords, creating drafts for human review.
    - GitHub-backed websites, such as the Tiny Lemon workspace, by opening content changes as draft commits/PRs or Codex handoff tasks.
    - Framer, Webflow, Shopify, and custom sites later through their CMS APIs or manual handoff.
  - Currently exciting to the founder.
- **Answer-engine reputation platform**
  - Help brands manage how AI systems understand them across owned content, third-party citations, reviews, listings, and community surfaces.
  - Bigger than content, but broader and more trust-sensitive.
- **Content supply chain for lean companies**
  - Replace the freelancer/content-agency workflow with agentic strategy, research, writing, QA, visuals, publishing, refreshes, and measurement.
  - Currently exciting to the founder.
- **Local business AI-search operator**
  - Help local businesses show up when buyers ask AI/search for "best X near me" or "who should I use for X in [city]?"
  - Work includes service pages, local citations, reviews, Google Business Profile, directories, and local FAQs.
  - Massive market, but operationally messy.
- **B2B category intelligence + execution**
  - Track buyer prompts, competitors, cited sources, objections, and category shifts, then turn them into pages, sales enablement, battlecards, and comparison assets.
  - More enterprise and higher ACV, but a longer sales cycle.
- **Full-stack agentic marketing department**
  - The largest vision: strategy, content, SEO, AEO, email, social, ads, analytics, and experimentation.
  - Hardest path because it requires trust, integrations, approvals, memory, measurement, and strong taste.

Current founder excitement clusters around:

```text
Autonomous growth agent for SMBs
Verticalized agent for one market
Agentic CMS / publishing layer
Content supply chain for lean companies
```

The most believable sequencing is:

```text
Start as a content supply chain for one vertical
-> add agentic CMS/publishing execution
-> become the verticalized growth agent
-> expand toward the autonomous SMB growth agent
```

## Current Validation State

Validated:

- Founders will submit websites for a concrete "what should I publish next?" teardown.
- Reddit practitioners agree dashboards are not enough.
- Prompt/citation gaps are useful when they lead to content decisions.
- The execution chain is real and painful.
- Existing blogs often have query-match or hub gaps.

Not yet validated:

- Whether teardown recipients reply after receiving the recommendation.
- Whether they ask for a full content brief/draft.
- Whether they will pay for one publish-ready kit.
- Whether they will pay for a recurring cadence.

## Next Phase

Phase 3 should test conversion from teardown to deeper workflow.

After each completed teardown, use a light follow-up:

```text
Was this useful enough that you would want the full brief or draft for the recommended page?
```

Or:

```text
Is the harder part for you figuring out what to publish next, or actually getting the page written and shipped?
```

Potential paid pilot:

```text
$49-$99 for one full content kit
```

What the kit includes:

- title / H1
- answer-first intro
- outline
- full draft
- FAQ
- meta description
- CTA angle
- internal link suggestions
- publish checklist
- recheck prompts

The next validation question:

```text
After seeing the gap, do founders care enough to get the asset created?
```

## Immediate Guidance For Next Agent

1. Do not restart discovery from scratch. Read the docs listed above.
2. Treat long `.com.md` teardown files as internal packets, not public replies.
3. For new Reddit teardowns, prioritize sites with existing blogs/content systems.
4. Keep public replies concise: category, buyer questions, surfaced page types, one asset, why, structure.
5. Track follow-up signals in `REDDIT_TEARDOWN_LEADS.md`.
6. The goal is now Phase 3: find whether anyone wants a full brief/draft or recurring workflow.
