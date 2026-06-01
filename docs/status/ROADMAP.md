---
title: ContentDesk Visibility Roadmap
updated: 2026-06-01
type: living
status: current
---# ContentDesk Visibility Roadmap

## Why This Exists

ContentDesk has two connected systems:

```text
Visibility engine -> finds what buyers ask, who gets cited, what gaps exist
Content engine -> builds the next asset or fix to improve those odds
```

The visibility engine should answer one practical question every week:

```text
What should Tiny Lemon ship or fix next to become more visible and citable in AI answers?
```

The first test case is intentionally narrow:

```text
Brand: Tiny Lemon
Provider: Perplexity
Window: 30-60 days
Goal: move Tiny Lemon from absent/uncited to mentioned/cited in buyer prompts
```

## Core Loop

```text
run buyer prompts
-> capture Perplexity answers and citations
-> score Tiny Lemon visibility
-> identify cited sources and winning competitors
-> detect competitor asset gaps
-> detect unanswered buyer questions
-> recommend/build the next asset
-> re-run prompts later
-> measure what changed
```

## Phase 1: Perplexity Visibility Baseline

Build the first automated measurement loop for Tiny Lemon using Perplexity only.

### What It Does

- Runs a fixed set of buyer prompts.
- Captures Perplexity answer text.
- Captures cited URLs and cited domains.
- Detects whether Tiny Lemon is mentioned.
- Detects whether Tiny Lemon is cited.
- Detects which competitors are mentioned or cited.
- Classifies citation source formats.
- Classifies citation quality.
- Produces a baseline visibility score.
- Writes a dated run file for future comparison.

### Current Shape

```text
Input:  data/tiny-lemon-prompts.json
Runner: npm run prompt:scan
Output: data/prompt-runs/YYYY-MM-DD-tiny-lemon.json
Provider: Perplexity
```

### Required Data

- Tiny Lemon brand profile.
- Prompt list.
- Prompt groups.
- Competitor registry.
- Tiny Lemon asset inventory.
- Perplexity API key.

### Output Metrics

- Prompt count.
- Tiny Lemon mention rate.
- Tiny Lemon citation rate.
- Average visibility score.
- Competitor-only answers.
- Cited source formats.
- Citation quality mix.
- Recommended next action per prompt.
- Recheck date.

### Done When

- The scan can run without manual research.
- Each result has answer text, citations, competitor data, source classifications, and a score.
- The output is stable enough to compare one run against a later run.

## Phase 2: Automated Competitor Asset Scanner

Once Perplexity shows which competitors are winning, ContentDesk should scan those competitors automatically to understand what they have that Tiny Lemon does not.

This is not manual research. The only manual input should be the initial competitor names/domains if Perplexity has not discovered enough yet.

### What It Does

- Takes competitors from the registry and/or Perplexity prompt results.
- Crawls each competitor's public web presence.
- Finds important pages and assets.
- Classifies each asset by type and buyer question.
- Compares competitor assets against Tiny Lemon's asset inventory.
- Identifies repeatable patterns across winning competitors.

### Asset Types To Detect

- Homepage positioning.
- Shopify App Store listing.
- Feature pages.
- Use-case pages.
- Category pages.
- Comparison pages.
- Alternative pages.
- Pricing page.
- Blog guides.
- Docs/help center.
- FAQ pages.
- Case studies.
- Review profiles.
- Integration pages.
- YouTube/demo pages.
- Community or Reddit mentions.
- Third-party listicle placements.

### Core Question

```text
What do Botika, Photoroom, Pebblely, Modelia, or other winners have that Tiny Lemon does not?
```

### Output Examples

```text
Pattern: comparison pages
Competitors with this: Botika, Photoroom, Pebblely
Perplexity citation frequency: high
Tiny Lemon has it: no
Priority: high
Recommended asset: Best Shopify AI Product Photo Apps for Fashion Brands
```

```text
Pattern: apparel-specific guide
Competitors with this: Botika, WearView, Claid
Perplexity citation frequency: medium
Tiny Lemon has it: weak
Priority: medium
Recommended asset: How Shopify fashion brands turn flat lays into on-model photos
```

### Done When

- ContentDesk can scan 3-5 known competitors automatically.
- Competitor assets are normalized into a structured inventory.
- Tiny Lemon gaps are visible by asset type and buyer question.
- Recommendations can reference concrete competitor evidence.

## Phase 3: Question Opportunity Detector

This phase finds buyer questions that keep appearing but are not answered well by anyone.

This matters because the best opportunities are not always competitor gaps. Sometimes the open lane is a question the whole category is failing to answer clearly.

### What It Does

- Clusters repeated buyer questions across prompt answers.
- Extracts sub-questions from Perplexity answers.
- Detects vague, weak, or incomplete answers.
- Checks whether citations actually answer the buyer question.
- Identifies prompts where competitors appear but the answer still feels unsatisfying.
- Scores whether Tiny Lemon is a good fit to own the answer.

### Signals To Track

- Repeated question across prompts.
- Poor answer quality.
- Weak or irrelevant citations.
- No clear category owner.
- High buyer intent.
- Strong Tiny Lemon product fit.
- Low competitor ownership.

### Question Opportunity Score

```text
Repeated across prompts: high / medium / low
Current answer quality: poor / okay / good
Buyer intent: high / medium / low
Competitor ownership: strong / weak / none
Tiny Lemon fit: strong / weak
Priority: high / medium / low
```

### Output Examples

```text
Question: Which Shopify AI photo app works best for fashion brands?
Current answer quality: okay
Competitor ownership: weak
Tiny Lemon fit: strong
Recommended asset: category comparison page
```

```text
Question: Can AI product photo tools generate on-model images from flat lays?
Current answer quality: poor
Competitor ownership: weak
Tiny Lemon fit: strong
Recommended asset: workflow guide plus demo video
```

### Done When

- ContentDesk can surface "questions nobody owns" from prompt and citation data.
- Each opportunity maps to a recommended asset or fix.
- Recommendations explain why the question is open territory, not just another content idea.

## Phase 4: Recommendation And Build Loop

This phase connects visibility findings to ContentDesk's content generation system.

The visibility engine should not stop at analysis. It should hand the content engine a clear brief for the next asset or fix.

### What It Does

- Turns prompt gaps, competitor gaps, citation gaps, and question opportunities into recommendation cards.
- Prioritizes which action is most likely to improve Tiny Lemon visibility.
- Generates a structured brief for the content engine.
- Tracks what asset was built or fixed.
- Links the asset back to the prompts it is meant to improve.
- Schedules the recheck.

### Recommendation Types

- Competitor asset gap.
- Citation gap.
- Unanswered question.
- Asset refresh.
- App Store listing rewrite.
- Comparison page.
- Alternative page.
- Category guide.
- FAQ section.
- Demo video script.
- Reddit/community reply strategy.
- Third-party outreach packet.

### Recommendation Card Fields

```text
opportunity type
buyer question
prompt group
what Perplexity said
who/what got cited
winning competitors
Tiny Lemon gap
recommended asset/fix
why this move
suggested structure
confidence level
prompts to recheck
recheck date
```

### Done When

- Every recommendation is tied to evidence from prompt runs, citations, or competitor assets.
- The content engine can use the recommendation as an implementation brief.
- Each shipped asset has a recheck plan.

## Phase 5: Visibility Dashboard

The dashboard is the product surface for understanding the loop quickly.

It should not be the first thing built before the data is useful, but it is the natural final surface once the visibility loop is producing reliable runs, gaps, and recommendations.

### Dashboard Questions

- Are we more visible than before?
- Which prompt groups are improving?
- Who is beating us?
- What sources does Perplexity trust?
- What do competitors have that Tiny Lemon does not?
- What questions does nobody answer well?
- What should we build or fix next?
- Did visibility change after we published?

### Dashboard Sections

1. Visibility Overview
2. Prompt Group Performance
3. Competitor Share of Answers
4. Citation Source Mix
5. Citation Quality Mix
6. Competitor Asset Gap Matrix
7. Questions Nobody Owns
8. Recommendation Cards
9. Recheck History
10. Shipped Assets And Impact

### Key Views

#### Visibility Overview

```text
Baseline score
Current score
Weekly change
Tiny Lemon mention rate
Tiny Lemon citation rate
Competitor-only answer rate
```

#### Competitor Asset Gap Matrix

```text
Asset type | Competitors have it? | Tiny Lemon has it? | Cited by Perplexity? | Priority | Next move
```

#### Questions Nobody Owns

```text
Question | Prompt groups | Current answer quality | Competitors mentioned | Cited sources | Recommended asset | Priority
```

#### Shipped Assets And Impact

```text
Asset shipped
Target prompts
Publish date
Recheck date
Before score
After score
Mention/citation change
Next recommendation
```

### Done When

- A founder can understand the current visibility state in under two minutes.
- The dashboard makes the next action obvious.
- The dashboard shows whether previous actions changed Perplexity visibility.

## Practical Build Order

```text
1. Finish Perplexity prompt scan baseline.
2. Add run-to-run comparison.
3. Add simple Markdown/JSON report generation.
4. Build automated competitor asset scanner for known competitors.
5. Add competitor asset gap matrix.
6. Add question opportunity detector.
7. Connect recommendation cards to content generation.
8. Add weekly recheck scheduling.
9. Build internal dashboard.
10. Generalize beyond Tiny Lemon only after the loop works.
```

## Success Criteria

The visibility engine is working if, over 30-60 days:

- Tiny Lemon appears in more buyer answers.
- Tiny Lemon gets cited directly.
- Competitor-only answers become mixed answers.
- Tiny Lemon-owned or earned assets enter citations.
- Recommendations become more specific over time.
- Shipped assets can be connected to prompt-level visibility changes.

## Strategic Framing

```text
Tiny Lemon is the test subject.
Perplexity is the measurement surface.
ContentDesk is the intervention engine.
The dashboard is the operating surface.
```

The product is not just a visibility dashboard and not just a content generator. It is a loop:

```text
measure visibility
-> understand gaps
-> build the next asset
-> remeasure
-> learn what moved
```
