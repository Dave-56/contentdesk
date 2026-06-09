---
title: HubSpot AEO2 — Claude Design Prompt
updated: 2026-06-07
type: research
status: current
---

# Claude Design Prompt — ContentDesk AEO Dashboard

Use this prompt in Claude Design to create a high-fidelity dashboard concept.

```text
Design a high-fidelity web dashboard for ContentDesk, an AEO visibility and content-action platform.

The dashboard should be inspired by HubSpot's AEO dashboard structure, but clearly better for action. HubSpot shows useful metrics like brand visibility, sentiment, competitor landscape, and citation analysis. ContentDesk should go one step further: explain why the brand is losing, who is winning, which sources caused the gap, and what action the user should take next.

Product context:
- ContentDesk helps lean Shopify app founders understand how often AI answer engines mention, cite, and recommend their brand.
- It scans buyer prompts across AI engines such as ChatGPT, Perplexity, Claude, and Gemini.
- It compares the user's brand against competitors.
- It looks at citations and source types, including owned pages, competitor pages, review sites, marketplaces, YouTube, Reddit/community, and earned media.
- It turns visibility gaps into concrete next actions: create a comparison page, update an existing guide, improve Shopify App Store listing, get listed on a review page, make a YouTube/demo asset, or draft a community answer.

Design direction:
- Professional SaaS dashboard, dense but clean.
- Not a landing page.
- First screen should be actual product UI.
- Use a quiet, operational design. No huge hero, no decorative gradient blobs.
- Make it feel more modern and sharper than HubSpot, but familiar enough that marketers understand it instantly.
- Prioritize scanning, comparison, and next actions.
- Use cards only for individual metric modules, alerts, recommendations, and repeated list items.
- Avoid nesting cards inside cards.
- Use compact tables, segmented controls, filters, dropdowns, tabs, and clear status badges.

Page title:
AI Visibility Dashboard

Primary navigation:
- Overview
- Prompts
- Competitors
- Citations
- Recommendations
- Content Inventory

Top filter bar:
- Date range dropdown
- AI engine multi-select: ChatGPT, Perplexity, Claude, Gemini
- Product/service dropdown
- ICP dropdown
- Market/location dropdown
- Buyer journey phase dropdown: Awareness, Consideration, Evaluation, Decision
- Competitor selector dropdown
- Button: Add competitor

Important competitor feature:
The user should be able to manually add competitors and also review AI-discovered competitors.

Design a competitor control with:
- Dropdown showing tracked competitors
- "Add competitor" button
- Small section or modal for "Discovered competitors"
- Each discovered competitor has actions: Track, Ignore
- Example competitors: Botika, PixUp AI, Snaproom, Claid.ai

Hero-level summary band:
Show a concise status summary, not marketing text.

Example copy:
"Tiny Lemon appears in 0.6% of tracked AI answers. Botika owns 85% share of voice. Biggest reason: AI engines cite Shopify, YouTube, and competitor pages more than Tiny Lemon-owned assets."

Include 4 top metric cards:
1. Brand Visibility
   - Value: 0.6%
   - Formula tooltip: answers mentioning brand / total tracked answers
   - Small trend line
   - Label: "Mention rate"

2. Recommendation Rate
   - Value: 0.2%
   - Explain: how often AI recommends the brand as a solution, not merely mentions it
   - This is a ContentDesk improvement over HubSpot

3. Sentiment Score
   - Value: 36.25%
   - Explain: positive or negative language around the brand when mentioned
   - Add warning: low sample size if brand visibility is low

4. Share of Voice
   - Tiny Lemon: 2%
   - Botika: 85%
   - PixUp AI: 8%
   - Snaproom: 5%

Main layout:
Use two-column dashboard after summary:

Left column:
1. Competitor Landscape
   - Table or horizontal bars
   - Columns: Competitor, Share of voice, Recommendation rate, Top cited source, Trend
   - Include Tiny Lemon highlighted
   - Include "Add competitor" control near header

2. Prompt Coverage
   - Matrix/table showing Product x ICP x Market coverage
   - Do not confuse ICP with country
   - Make Market a separate dimension
   - Empty cells show "Track"
   - Tracked cells show prompt count
   - Include budget preview: "Tracking these 4 new cells adds 32 prompts"

Right column:
1. Next Best Actions
   - This is the most important module
   - Each action card should explain the diagnosis and the fix
   - Example action:
     Title: "Create Botika alternatives page"
     Diagnosis: "Botika is recommended in 8 prompts where Tiny Lemon is absent."
     Source evidence: "AI cites Shopify App Store and Botika-owned pages."
     Fix: "Publish comparison page targeting Shopify apparel founders."
     CTA: "Generate brief"
   - Other actions:
     "Improve Shopify App Store listing"
     "Create YouTube demo for flat-lay to on-model workflow"
     "Pitch inclusion on Shopify app roundup"
     "Draft Reddit answer for apparel product-photo thread"

2. Why You Are Losing
   - Short ranked explanation list
   - Example:
     1. "Competitors are cited on Shopify and review pages."
     2. "Tiny Lemon has no page answering 'Botika alternatives for Shopify'."
     3. "AI engines mention Tiny Lemon but rarely recommend it."
     4. "YouTube appears in citations, but Tiny Lemon has no cited demo video."

Citation Analysis section:
Create full-width section lower on page.

Include:
1. Top cited domains table
   - shopify.com: 654
   - wearview.co: 137
   - youtube.com: 113
   - claid.ai: 111
   - rewarx.com: 62

2. Citations by channel stacked bar
   - Channels: Owned, Competitor, Earned, Peer, UGC, Review Site, Marketplace, YouTube

3. Citation Opportunity Map
   - This is ContentDesk's improvement over HubSpot
   - Show source, why it matters, gap type, recommended action
   - Example rows:
     Source: shopify.com
     Why it matters: "Most-cited marketplace source"
     Gap: "Tiny Lemon listing not positioned for on-model photo prompts"
     Action: "Update listing copy and screenshots"

     Source: youtube.com
     Why it matters: "AI engines cite demos and walkthroughs"
     Gap: "No Tiny Lemon demo cited"
     Action: "Create 90-second product workflow video"

     Source: competitor-owned page
     Why it matters: "Botika comparison pages support recommendations"
     Gap: "No Tiny Lemon alternative page"
     Action: "Generate comparison brief"

Recommendations page preview:
Design a module or tab preview where recommendations are grouped by task type:
- Owned content
- Marketplace/listing
- Off-site inclusion
- Community answer
- Video/demo
- Manual inspection

Each recommendation should show:
- Priority
- Expected impact
- Prompt gaps affected
- Competitors involved
- Sources involved
- CTA: Generate brief, Draft update, Create task, Ignore

AI assistant handoff:
Design a feature where the user can send any answer insight, recommendation, or highlighted weakness to an AI assistant.

Purpose:
The dashboard should not only show that AI said something negative or cautious. It should help the user investigate and fix the underlying business/content issue.

Example from prompt answer:
AI says Tiny Lemon may be weaker if buyer needs "a mature credit/pricing structure that's easy to benchmark."

The UI should let the user click that sentence and create a fix brief.

Actions:
- "Send to assistant"
- "Create fix brief"
- "Ask why this matters"
- "Find evidence"
- "Draft website update"
- "Draft pricing page update"
- "Create repo task"

Assistant handoff panel:
- Shows selected quote from AI answer.
- Shows prompt that produced it.
- Shows engine and run date.
- Shows cited sources.
- Shows competitor context.
- Asks user to choose task type:
  - Explain insight
  - Investigate competitor proof
  - Draft content update
  - Draft pricing/packaging recommendation
  - Create implementation task
  - Rerun after changes

Example assistant brief:
Title: "Investigate Tiny Lemon pricing maturity gap"
Source quote: "It may be weaker if you need a mature credit/pricing structure that's easy to benchmark."
Context: "ChatGPT mentioned Tiny Lemon but positioned competitors as safer for pricing/track record."
Questions for assistant:
1. Why would AI describe Tiny Lemon pricing as less mature?
2. What public evidence is missing from Tiny Lemon's site or Shopify listing?
3. How do Botika, ST, Attired, and PixUp AI present pricing/credits?
4. What pricing page or FAQ changes would make Tiny Lemon easier to benchmark?
5. What exact copy should be added?
6. After changes ship, which prompts should be rerun?

Output from assistant:
- Diagnosis
- Evidence found
- Recommended pricing/FAQ structure
- Suggested copy
- Follow-up prompt rerun checklist

Design detail:
Show this as a right-side drawer from the answer viewer. It should feel like turning an AI answer into work, not exporting a report.

Prompts page:
Design a high-fidelity Prompts page inspired by HubSpot's prompt view, but more useful.

Layout:
- Left side: searchable prompt list.
- Right side: selected prompt detail.
- The prompt detail has tabs: Answers, Prompt Analysis, Recommendations, Run History.
- Show engine cards across the top: ChatGPT, Perplexity, Claude, Gemini.
- Each engine card shows mention state, citation state, recommendation state, and latest run time.
- User can click an engine card to see that engine's answer.

Manual rerun feature:
Add a prominent "Rerun prompt" control on the selected prompt detail.

Rerun options:
- Rerun selected engine
- Rerun all engines
- Run once as manual test
- Run twice as manual test

Show cost/budget impact before running:
- Example: "Rerun all engines will use 4 prompt runs."
- Example: "Manual 2-test run on ChatGPT will use 2 prompt runs."
- Show remaining credits or prompt budget.

Rerun button states:
- Default: "Rerun"
- Confirmation popover with engine selection and budget impact
- Loading: "Running..."
- Complete: "New answer ready"
- Error: "Run failed - retry"

Manual rerun should not silently overwrite old data. Show run history.

Run History tab:
- Table columns: Run date, Engine, Mentioned, Recommended, Cited, Sentiment, Top competitor, Source count, View answer
- Let user compare latest run to previous run.
- Show a small diff state:
  - "Brand mention changed: No -> Yes"
  - "Top competitor changed: Botika -> Claid.ai"
  - "New cited domain: youtube.com"

Prompt Analysis tab:
- Explain why this prompt matters.
- Show ICP, product, market, buyer journey phase.
- Show gap type: mention gap, recommendation gap, citation gap, competitor-recommended gap.
- Show competitors appearing in answers.
- Show top cited sources for this prompt.
- Add "Answer teardown" section that breaks one AI answer into:
  - Positive claims
  - Buyer objections
  - Missing proof
  - Competitors used as safer alternatives
  - Cited sources
  - Existing assets to inspect
- Example:
  Positive claim: "Tiny Lemon looks differentiated."
  Objection: "Less visible public proof than stronger App Store incumbents."
  Existing asset to inspect: "Shopify App Store listing."
  Fix: "Update listing proof section with real examples, pricing clarity, and comparison-ready evidence."

Recommendations tab inside prompt detail:
- Show action tied to this exact prompt.
- Example:
  Title: "Update Tiny Lemon Shopify App Store listing"
  Reason: "ChatGPT cites Shopify pages but does not strongly associate Tiny Lemon with bulk on-model photo generation."
  CTA: "Generate listing update brief"
- Recommendation logic should distinguish:
  - Missing asset
  - Existing asset needs stronger proof
  - Existing asset is not cited
  - Existing asset is cited but does not answer objection
- Let user highlight a sentence in the AI answer and convert it into an assistant-ready fix brief.
- Example highlighted weakness: "a mature credit/pricing structure that's easy to benchmark."
- CTA beside highlight: "Investigate this"

Important UX opinion:
Manual rerun is not the same as scheduled tracking. Scheduled tracking builds weekly/monthly trend data. Manual rerun is for spot-checking, debugging, and seeing if a content change had immediate impact.

Closed-loop workflow:
1. AI answer identifies weakness.
2. User sends weakness to assistant.
3. Assistant investigates source/competitor evidence.
4. Assistant drafts website/listing/content/product update.
5. User ships change.
6. User reruns the exact prompt.
7. Dashboard shows whether mention, citation, recommendation, or sentiment improved.

Post-fix verification timing:
Design the rerun workflow so same-day rerun is framed as an early smoke test, not final proof.

Add verification options:
- Rerun now
- Schedule 3-day verification
- Schedule 7-day verification
- Schedule 30-day verification

Show helper copy:
"Same-day reruns can catch fast changes, but AI citation and recommendation shifts often need crawl/index/retrieval time. Use 7-day and 30-day checks for stronger proof."

In run history, label runs:
- Manual smoke test
- 3-day validation
- Weekly validation
- 30-day trend check

Visual style:
- Use clear typography and strong hierarchy.
- Mostly neutral background with restrained color.
- Use green for wins, red for gaps, amber for caution, blue/teal for actionable links.
- Tables should be easy to scan.
- Buttons should use icons where helpful.
- Use small tooltips for formulas.
- Make dashboard feel like an operator cockpit, not a marketing analytics toy.

Required high-fidelity screens:
1. Overview dashboard
2. Add competitor / discovered competitors modal
3. Citation opportunity map
4. Recommendation detail drawer
5. Prompts page with answer viewer and rerun prompt controls
6. Run history / answer comparison state
7. Assistant handoff drawer created from highlighted answer text

Output:
Create polished high-fidelity UI mockups with realistic data. Prioritize layout, hierarchy, and interaction states.
```
