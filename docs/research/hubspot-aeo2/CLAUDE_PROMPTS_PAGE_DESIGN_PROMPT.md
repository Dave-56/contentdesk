---
title: HubSpot AEO2 — Claude Prompts Page Design Prompt
updated: 2026-06-07
type: research
status: current
---

# Claude Design Prompt — ContentDesk Prompts Page

Use this prompt in Claude Design to create a high-fidelity Prompts page for the AEO tool.

```text
Design a high-fidelity "Prompts" page for ContentDesk's AEO tool.

This page is one tab inside the AEO product. Main horizontal navigation:
- Dashboard
- Prompts
- Citations
- Recommendations

The active tab is Prompts.

Goal:
Create a prompt investigation workspace. User should be able to select a buyer prompt, inspect AI answers by engine, understand why the prompt exists, and see prompt-specific recommendations.

Inspiration:
Use HubSpot's AEO Prompts page as structural inspiration:
- Left prompt list
- Right selected prompt panel
- Top filters
- Tabs inside selected prompt: Answers, Prompt Analysis, Recommendations
- Engine cards for ChatGPT, Perplexity, Gemini

But ContentDesk should be more useful than HubSpot:
- Let user rerun a prompt.
- Break answer into claims, objections, proof gaps, citations, and competitors.
- Let user highlight text and send it to an AI assistant.
- Turn each prompt into concrete next actions.

Design style:
- Professional SaaS operator UI.
- Dense but clean.
- No landing page.
- No decorative hero.
- Mostly neutral background.
- Use restrained color: green for wins, red for gaps, amber for caution, teal/blue for links/actions.
- Use compact tables, segmented controls, dropdowns, icon buttons, and drawers.
- Cards only for repeated prompt rows, engine summary cards, recommendation cards, and drawers.

Top area:
- AEO label with beta badge.
- Horizontal nav: Dashboard | Prompts | Citations | Recommendations.
- Right side: Add prompts button, prompt usage counter, settings icon.
- Example usage counter: "15 / 25 prompts".

Filter bar:
Include compact filters:
- Date
- Engine
- Group
- Products/Services
- Ideal customer profile
- Location / Market
- Buyer journey phase
- All filters
- Search box

Main layout:
Split page into two panes.

Left pane: Prompt list
- Search input at top.
- Checkbox column for selecting prompts.
- Prompt rows with active row highlight.
- Show prompt text as link-style text.
- Optional metadata chips per row: engine count, status, journey phase, market, gap type.
- Example prompts:
  - "TinyLemon vs other Shopify AI model photo apps for apparel brands"
  - "Does TinyLemon support bulk AI model photos from existing product images?"
  - "Which Shopify apps create AI model photos and videos for clothing?"
  - "What causes Shopify fashion stores to have low-converting product visuals?"
  - "Why do Shopify apparel brands struggle with model product photography?"
  - "Which Shopify apps generate on-model photos from product images?"
  - "How do fashion brands automate on-model photos from flat-lay images?"
  - "What Shopify tools turn flat-lay shots into on-model photos?"

Right pane: Selected prompt detail
Header:
- Selected prompt title.
- Previous / next prompt icon buttons.
- Close detail icon button.
- Optional "Rerun prompt" button.

Selected prompt tabs:
- Answers
- Prompt Analysis
- Recommendations
- Run History

Answers tab:
Show engine summary cards across top:
- ChatGPT
- Perplexity
- Gemini
- Claude

Each engine card should show:
- Engine logo/icon.
- Mention state: "Mentioned 1 out of 1 times" or "No mentions".
- Cited state: "Cited owned site" / "No citation".
- Recommendation state: "Recommended" / "Mentioned only" / "Competitor recommended".
- Latest run timestamp.

Below engine cards:
Answer viewer panel.

Answer viewer controls:
- Engine dropdown: ChatGPT, Perplexity, Gemini, Claude.
- Run selector: Run 1 of 1, Run 2 of 3, etc.
- Status badge: Brand mentioned / Brand not mentioned.
- Citation count.
- Rerun button.
- Previous / next run buttons.

Answer content:
Show realistic answer text with highlighted brand mentions and citation chips.
Example selected answer:

"Tiny Lemon looks differentiated but not yet the obvious default winner. It stands out for brand consistency and flat-lay/supplier-photo-to-model-photo workflow, which is exactly the pain many fashion Shopify stores have. But compared with competitors, it currently seems to have less visible public proof than stronger App Store incumbents like ST, Attired, Picjam, or StyleScan."

Highlight:
- "Tiny Lemon" in yellow.
- "differentiated" as positive signal.
- "less visible public proof" as objection.
- cited domains as small chips:
  - tinylemon.xyz
  - apps.shopify.com/tiny-lemon
  - apps.shopify.com/attired
  - apps.shopify.com/picjam

Add text-selection interaction:
When user selects or hovers over "less visible public proof", show small action menu:
- Investigate this
- Create fix brief
- Send to assistant
- Add to recommendation

Prompt Analysis tab:
Purpose: explain why this prompt exists and what it tests.

Sections:
1. Prompt strategy
   - ICP: Shopify apparel founder
   - Product: Tiny Lemon
   - Market: United States
   - Buyer journey phase: Evaluation
   - Prompt type: competitor comparison
   - Intent: buyer is shortlisting tools before purchase

2. What this prompt tests
   - Can AI explain Tiny Lemon's differentiation?
   - Does AI compare Tiny Lemon against App Store incumbents?
   - Does AI recommend Tiny Lemon or only mention it?
   - Which sources shape the answer?

3. Answer teardown
   Use a table:
   - Claim
   - Signal type
   - Evidence
   - Action

   Example rows:
   - "Tiny Lemon looks differentiated" | Positive | tinylemon.xyz cited | Preserve positioning
   - "Brand consistency and flat-lay workflow" | Positive | owned site cited | Reinforce in listing
   - "Not obvious default winner" | Objection | competitor listings cited | Add proof/comparison content
   - "Less visible public proof" | Proof gap | App Store competitors have reviews/ratings | Improve public proof section

4. Citation breakdown
   - Owned site: tinylemon.xyz
   - Owned marketplace: apps.shopify.com/tiny-lemon
   - Competitor marketplace: ST, Attired, Picjam, StyleScan
   - Normalize URLs by removing Shopify query params.
   - Show original cited URL in expandable audit view.

5. Competitor signals
   - ST: stronger App Store rating/reviews.
   - Attired: bulk workflow language.
   - Picjam: fashion model positioning.
   - StyleScan: virtual try-on credibility.

6. Cross-engine drift
   Show where engines disagree.
   Table columns:
   - Topic
   - ChatGPT
   - Perplexity
   - Gemini
   - Claude
   - Action

   Example rows:
   - Competitor set | ST, Attired, Picjam | Botika, Claid | Botika, Rewarx, Modelia, FASHN | Pending | Review competitor mapping
   - Pricing claim | Starts at $39/mo | Not mentioned | "around $249/month" | Pending | Fix pricing clarity
   - Recommendation | Shortlist | Compare SKUs | Strong contender but high price | Pending | Create proof/pricing brief

7. Fact-check queue
   Show AI claims that may be incomplete or wrong.
   Example:
   Claim: "Tiny Lemon pricing appears to be around $249/month."
   Source truth: "Shopify listing shows Starter $39/month, Growth $99/month, Scale $249/month."
   Issue: "AI over-indexed highest tier."
   Suggested fix: "Make pricing tiers and credits easier to parse on site/listing."

Recommendations tab:
Purpose: actions tied to this exact prompt.

Show recommendation cards.

Card 1:
Title: "Strengthen Tiny Lemon App Store proof"
Diagnosis: "AI says Tiny Lemon is differentiated, but less proven than incumbents."
Evidence: "Tiny Lemon listing has 0 reviews while ST has stronger App Store proof."
Fix: "Add clearer proof section, benchmark examples, pricing/credit clarity, and customer evidence."
CTA buttons:
- Generate listing update brief
- Send to assistant
- Mark as planned

Card 2:
Title: "Create comparison-ready proof page"
Diagnosis: "AI recommends users shortlist Tiny Lemon, Attired, Picjam, and ST."
Fix: "Create page showing same 10 SKUs run through Tiny Lemon, with output quality, speed, and pricing notes."
CTA buttons:
- Generate brief
- Create task

Card 3:
Title: "Rerun after proof update"
Diagnosis: "This prompt should be used as validation after listing/page changes."
Fix: "Schedule rerun now, 3 days, 7 days, and 30 days."
CTA buttons:
- Rerun now
- Schedule validation

Card 4:
Title: "Clarify pricing for AI answers"
Diagnosis: "Gemini framed Tiny Lemon pricing as around $249/month, even though listing starts at $39/month."
Fix: "Update pricing copy and FAQ so AI can summarize tiers correctly."
CTA buttons:
- Generate pricing FAQ copy
- Send to assistant
- Rerun Gemini

Card 5:
Title: "Complete publish discovery wiring"
Diagnosis: "A fix is not complete until the canonical page is discoverable by search and AI tools."
Fix: "After publishing, update sitemap, internal links, llms.txt/llms-full.txt if present, canonical metadata, and rerun target prompts."
CTA buttons:
- Generate publish checklist
- Create repo task
- Schedule verification

Run History tab:
Show table:
- Date
- Engine
- Mentioned
- Recommended
- Cited Tiny Lemon
- Top competitor
- Objection detected
- Source count
- View answer

Show compare state:
- Latest vs previous.
- Example diffs:
  - "Mention stayed Yes"
  - "Recommendation changed: Mentioned only -> Recommended"
  - "Objection removed: less visible public proof"
  - "New citation: apps.shopify.com/tiny-lemon"

Manual rerun:
Design a rerun workflow.

Rerun button opens popover/drawer:
- Rerun selected engine
- Rerun all engines
- Run once as manual smoke test
- Run twice as manual test
- Schedule 3-day validation
- Schedule 7-day validation
- Schedule 30-day validation

Show budget copy:
- "Rerun all engines uses 4 prompt runs."
- "Same-day reruns are smoke tests. Citation and recommendation shifts may need crawl/index/retrieval time."

Assistant handoff drawer:
Design right-side drawer after user clicks "Investigate this."

Drawer content:
- Selected quote: "less visible public proof"
- Prompt: "TinyLemon vs other Shopify AI model photo apps for apparel brands"
- Engine: ChatGPT
- Run date
- Cited sources
- Competitors mentioned
- Suggested assistant task:
  "Investigate why AI describes Tiny Lemon as having less visible public proof. Compare Tiny Lemon's site and Shopify listing against ST, Attired, Picjam, and StyleScan. Recommend exact copy, proof assets, and listing updates."

Drawer actions:
- Send to assistant
- Generate fix brief
- Create repo task
- Draft listing update
- Close

Empty state:
For Recommendations tab when no gaps exist, show:
"No recommendations for this prompt because performance is strong."
But also include a secondary action:
"Rerun later" and "View run history."

Required high-fidelity states:
1. Prompts page with Answers tab active.
2. Engine dropdown open.
3. Prompt Analysis tab with answer teardown.
4. Recommendations tab with prompt-specific action cards.
5. Rerun prompt popover/drawer.
6. Assistant handoff drawer from highlighted answer text.
7. Empty recommendations state.

Output:
Create polished high-fidelity UI mockups for the Prompts page only. Use realistic Tiny Lemon data. Prioritize interaction clarity, information hierarchy, and actionability.
```
