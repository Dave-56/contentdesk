---
title: HubSpot AEO2 — Claude Simple Dashboard Design Prompt
updated: 2026-06-07
type: research
status: current
---

# Claude Design Prompt — Simple ContentDesk Dashboard

Use this prompt in Claude Design when designing the **Dashboard** tab only.

```text
Design a simple high-fidelity dashboard page for ContentDesk's AEO tool.

Important:
Do not copy HubSpot exactly.
Do not make a busy enterprise analytics dashboard.
Do not add lots of filters.
Do not add ICP, location, product, buyer journey, prompt coverage, or next-best-action modules on this dashboard.
This is a simple founder-facing dashboard for one brand.

Context:
ContentDesk helps a founder understand how their brand appears in AI answers.
The user wants a quiet, simple dashboard that answers:
1. Are we visible?
2. Is AI describing us positively?
3. Who is beating us?
4. Which websites are AI engines citing?

Main navigation:
Horizontal nav at top:
- Dashboard
- Prompts
- Citations
- Recommendations

Active tab:
Dashboard

Page title:
AI Visibility Dashboard

No sidebar.
No large filter bar.
No prompt coverage grid.
No recommendations feed on this page.
No "Why you're losing" list on this page.
No dense cockpit layout.

Design feeling:
The dashboard should feel serene, peaceful, and spacious. Think calm product workspace, not
analytics war room.

Reference mood:
- Retell-style restraint.
- Large white/off-white space.
- Soft neutral background.
- Muted black/charcoal text.
- Minimal color.
- Gentle borders.
- Calm typography.
- Editorial spacing.

Words to design toward:
- serene
- quiet
- peaceful
- airy
- focused
- minimal
- premium
- soft
- composed

Words to avoid:
- busy
- loud
- colorful
- gamified
- enterprise cockpit
- dense
- flashy
- dashboard overload

Top controls:
Keep only:
- Date range dropdown: Last 30 days
- Engine dropdown: All engines
- Small settings icon

Dashboard layout:
Use a clean single-page layout with four sections:

1. Brand Metrics
2. Competitor Landscape
3. Citation Analysis
4. Add / Manage Competitors

Section 1: Brand Metrics
Show two large gauge-style metric cards side by side.

Card A: Brand Visibility
- Big pressure gauge or semicircle gauge.
- Value: 0.6%
- Label: Brand visibility
- Helper text: "How often Tiny Lemon is mentioned in tracked AI answers."
- Formula tooltip: "Brand visibility = answers mentioning Tiny Lemon / total tracked answers."
- Small subtext: "37 of 6,140 answers"
- Keep visual calm. One big number. No sparkline.

Card B: Sentiment Score
- Big pressure gauge or semicircle gauge.
- Value: 36.25%
- Label: Sentiment score
- Helper text: "How positively or negatively AI describes Tiny Lemon when mentioned."
- Small caution badge: "Low sample size"
- Explanation: "Low visibility means sentiment is based on few mentions."

Optional small note under Brand Metrics:
"Visibility tells you if AI mentions the brand. Sentiment tells you how AI talks about the brand when it appears."

Section 2: Competitor Landscape
Simple table. No charts unless very simple horizontal bars.

Header:
Competitor Landscape
Subtitle:
"Share of voice across tracked AI answers."

Include Add competitor button in section header.

Table columns:
- Company
- Share of voice
- Mention count
- Status

Rows:
- Botika | 85% | 5220 | Leading
- PixUp AI | 8% | 491 | Tracked
- Snaproom | 5% | 307 | Tracked
- Tiny Lemon | 2% | 122 | You

Tiny Lemon row should be softly highlighted.

Manual competitor control:
Add a simple "Add competitor" button.
Click opens a small modal:
- Competitor name input
- Website URL input
- Optional notes
- Buttons: Cancel, Track competitor

Also include a small "Discovered competitors" area inside the modal:
- Botika
- Claid.ai
- Lensia
Each has Track / Ignore.

Section 3: Citation Analysis
Simple. Focus on top domains.

Header:
Citation Analysis
Subtitle:
"Websites AI engines cite when answering your tracked prompts."

Card/table: Top cited domains
Columns:
- Domain
- Source type
- Citations
- Tiny Lemon present?

Rows:
- shopify.com | Marketplace | 654 | Yes, but low
- wearview.co | Review site | 137 | No
- youtube.com | YouTube | 113 | No
- claid.ai | Competitor | 111 | No
- rewarx.com | Review site | 62 | No

Add one small insight callout under table:
"AI engines cite Shopify most often. Make sure Tiny Lemon's Shopify listing clearly explains flat-lay to on-model workflow, pricing, proof, and examples."

Section 4: Source Hygiene
Small checklist card.

Title:
Source Hygiene

Purpose:
Show if AI is citing correct canonical sources.

Checklist rows:
- Canonical site: tinylemon.xyz — OK
- Shopify listing: apps.shopify.com/tiny-lemon — OK
- Staging domain: tinylemon.vercel.app — Redirected
- llms.txt includes priority guides — Needs check

This section should be small and practical, not scary.

Visual style:
- Overall page should be mostly off-white / warm white.
- Use charcoal text, not pure black everywhere.
- Use soft gray borders and very light gray fills.
- Use one restrained accent color only, preferably deep navy, muted teal, or soft blue.
- Use red/green only sparingly for semantic status, never as dominant visual theme.
- Lots of whitespace. Let sections breathe.
- Keep density low. Fewer elements, larger spacing.
- Use large quiet typography for metric numbers.
- Use calm table rows with generous padding.
- 8px border radius maximum for cards and controls.
- Cards should feel like soft surfaces, not heavy boxes.
- Avoid strong shadows; use subtle border instead.
- No nested cards.
- No decorative gradient blobs.
- No huge colored alert banners.
- No dense recommendation cards.
- No side navigation.
- Use readable tables and two big gauges.
- Keep page understandable in 10 seconds.

Typography:
- Use a clean modern sans-serif.
- Metric numbers can be large and elegant.
- Headings should be calm and confident, not oversized hero text.
- Labels should be small, muted, and readable.
- Avoid all-caps except tiny table labels if needed.

Spacing:
- Give top nav and page sections generous breathing room.
- Avoid cramming all modules above the fold.
- It is okay if user scrolls.
- Prefer fewer modules visible at once over squeezing everything into one screen.

Color guidance:
- Background: #FAFAF7 or similar warm off-white.
- Surface: #FFFFFF or very soft gray.
- Text: #1F2428 / charcoal.
- Muted text: #6E7378.
- Border: #E5E2DC.
- Accent: one deep navy/teal/blue.
- Warning: soft amber only.
- Success: muted green only.
- Error: muted red only.

Do not use:
- rainbow charts,
- many badges,
- neon colors,
- bright red/green dominance,
- heavy sidebars,
- thick borders,
- dense grids,
- aggressive shadows,
- marketing hero layout.

Responsive layout:
Desktop:
- Brand Metrics: two columns.
- Competitor and Citation sections stacked below.
- Source Hygiene small full-width card at bottom.

Mobile:
- Stack everything vertically.
- Gauges remain readable.
- Tables can become compact rows.

Required high-fidelity screens:
1. Simple Dashboard page.
2. Add competitor modal.

Output:
Create a polished high-fidelity mockup for the Dashboard tab only. Keep it simple. The dashboard should feel calm, focused, and founder-friendly.
```
