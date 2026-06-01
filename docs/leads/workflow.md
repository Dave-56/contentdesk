---
title: Reddit Teardown Workflow
updated: 2026-05-29
type: reference
status: current
---

# Reddit Teardown Workflow

## Purpose

This workflow turns a submitted website into a simple teardown that answers:

```text
What page should this startup publish next for SEO / AI search?
```

The goal is not to produce a full SEO audit. The goal is to quickly give a founder one useful, concrete publishing recommendation.

## What We Promised

For each website, the teardown should cover:

1. What category we think the site is competing in.
2. The buyer questions people are likely asking before choosing a product like theirs.
3. Who or what seems to show up for those questions.
4. What kinds of pages are getting surfaced: comparisons, FAQs, guides, directories, Reddit threads, etc.
5. The one page, FAQ, guide, or comparison asset they should publish next.
6. Why that page is likely worth publishing.
7. How to structure it so it is useful, crawlable, and easy for search/AI tools to understand and cite.

## Principle

Automate the research packet. Do not fully automate the final judgment yet.

The automation should make it easy to respond quickly, but a human should still review the recommendation before replying on Reddit.

## Six-Step Strategist Workflow

Use this order before making the final asset recommendation:

1. **Product/category read**
   - Understand what the product helps someone do.
   - Identify the primary buyer.
   - Name the painful job they are trying to solve.
   - Infer the category a buyer would compare it against.

2. **Existing content check**
   - Check for `/blog`, `/resources`, `/learn`, `/glossary`, `/compare`, `/docs`, `/faq`, calculators, tools, and sitemap-linked pages.
   - Ask whether the company already has the asset we are about to recommend.
   - Distinguish between missing content, component content, buried content, weak positioning, and a missing hub page.

3. **Buyer prompt generation**
   - Generate seed prompts from the product job, not just keywords.
   - Prioritize questions that happen before signup, purchase, trial, or product evaluation.
   - Keep the output to 5-8 prompts to test first.

4. **AI/search validation**
   - Run the strongest prompts in Google, ChatGPT, and optionally Perplexity or another answer engine.
   - Capture who shows up, which page types surface, whether the submitted site appears, and whether the prompt is actually answerable buyer intent.

5. **Gap analysis**
   - Compare validated prompts against the existing content check.
   - Decide whether the gap is a missing page, a comparison gap, a workflow guide gap, a structure/extractability gap, a consolidation/hub gap, or an offsite citation gap.

6. **Asset recommendation**
   - Recommend one page, FAQ, guide, comparison page, or hub.
   - Explain why it is worth publishing based on validated prompts, surfaced page types, and the actual current content library.
   - If related content already exists, recommend updating, consolidating, or building a hub rather than pretending the topic is absent.

Key guardrail:

```text
Before recommending an asset, always inspect existing content.
```

The goal is to avoid saying "publish X" when the better recommendation is really:

```text
You already have pieces of X. Create a query-matched hub, improve the title/structure, or link the existing pieces together.
```

## Inputs

Required:

```text
website_url
```

Optional internal notes:

```text
reddit_username
submission_thread
notes
```

Do not ask the founder for competitors, keywords, analytics access, logins, or a long form. The value is that we infer enough from the website.

## Step 1: Website Intake

Automatable now.

Given a website URL, inspect the public site and capture:

- company/product name
- homepage headline and subheadline
- what the product appears to do
- who it appears to be for
- main use cases
- main features
- pricing clues, if visible
- integrations or platforms mentioned
- existing content assets such as blog, resources, docs, FAQ, comparison pages, or guides

Output:

```text
Site summary:
Audience guess:
Problem solved:
Existing content found:
```

## Step 2: Category Inference

Automatable now, with human review.

Infer the category the company competes in.

Good category labels are specific enough to create buyer questions:

```text
Shopify returns management app
AI meeting notes for sales teams
Customer support helpdesk for ecommerce brands
Compliance automation for fintech startups
AI product photography tool for Shopify apparel brands
```

Avoid categories that are too broad:

```text
SaaS
AI tool
Marketing software
Productivity app
```

Output:

```text
I would classify this as: [category]
```

## Step 3: Competitor and Source Discovery

Automatable now, with human review.

Use the inferred category to search for likely competitors and source types.

Suggested search patterns:

```text
best [category]
[category] software
[category] tools for [audience]
[category] alternatives
[known product] alternatives
[category] comparison
[category] reddit
```

Capture:

- likely direct competitors
- adjacent competitors
- directories and listicles
- marketplaces
- review sites
- Reddit/forum threads
- guides and educational pages
- comparison pages

Be careful with wording. In the teardown, say:

```text
Likely competitors/sources I would inspect include...
```

Do not say:

```text
Your definite competitors are...
```

## Step 4: Buyer Question Generation

Mostly automatable.

Generate buyer questions from the category, audience, product use cases, and competitor/source discovery.

Use these question buckets:

### Best Tools

```text
What are the best [category] tools for [audience]?
```

### Use Case

```text
How can [audience] solve [problem]?
```

### Alternatives

```text
What are the best alternatives to [competitor/category]?
```

### Comparison

```text
[Product/category] vs [alternative]
```

### Fit

```text
Is [category] worth it for [audience/use case]?
```

### Pricing

```text
How much does [category] software cost?
```

### Implementation

```text
How do I set up [workflow]?
```

### Trust / Evaluation

```text
What should I look for in a [category] tool?
```

Output 5-8 buyer questions to test. Phrase them as:

```text
The buyer questions I would test first are:
```

This keeps the teardown honest. We are not claiming these are proven search-volume keywords.

## Step 5: Manual Prompt and Search Check

Manual for now.

Run the strongest 3-5 buyer questions in:

- Google
- ChatGPT
- Perplexity, if useful

Optional:

- Claude
- Gemini
- Grok

For each question, note:

- which competitors appear
- whether the submitted site appears
- what source/page types show up
- whether results are mostly guides, comparisons, directories, app listings, Reddit threads, docs, or product pages
- any recurring angle or missing asset

Use quick notes. This is not a full visibility tracking workflow.

Example:

```text
Prompt: best Shopify returns apps for small stores
Shows up: Loop Returns, AfterShip, ReturnGO, Shopify App Store pages
Source types: app marketplace pages, listicles, comparison guides
Observation: comparison/listicle intent is strong; buyer likely wants tradeoffs and fit.
```

## Step 6: Source Type Classification

Partly automatable, manually corrected.

Classify surfaced pages into:

- competitor homepage
- competitor product page
- comparison page
- alternatives page
- buying guide
- FAQ page
- docs/help page
- directory/listicle
- review site
- marketplace listing
- Reddit/forum thread
- YouTube/video
- partner or industry page

This supports the promised bullet:

```text
what kind of pages are getting surfaced
```

## Step 7: Gap Diagnosis

Automatable first pass, human approves.

Classify the main gap:

- Owned content gap: they do not have a page that answers the buyer question.
- Comparison gap: buyers are comparing options, but the site lacks comparison content.
- FAQ gap: buyers need clear answers to recurring objections or setup questions.
- Guide gap: buyers need help understanding the workflow or problem.
- Product/category page gap: the site does not clearly explain its category or use case.
- Structure gap: content exists, but the answer is buried, vague, or hard to extract.
- Technical crawlability gap: useful information appears hidden in scripts, tabs, widgets, or non-crawlable surfaces.
- Offsite citation gap: third-party pages are surfaced, but the brand is absent.

For the free Reddit teardown, prefer recommending a controllable owned asset unless the offsite or technical issue is obviously the main blocker.

## Step 8: Pick One Recommended Asset

Human-approved.

Choose one next asset:

- page
- FAQ
- guide
- comparison page
- alternatives page
- product/use-case page

Score mentally against:

- Does this map to a real buyer decision?
- Did search/AI/source checks show this type of page being surfaced?
- Is it realistic for the founder to publish?
- Would it make the product easier to understand?
- Would it be useful and citeable rather than purely promotional?

Avoid generic blog topics. Prefer specific assets such as:

```text
Best [category] tools for [specific audience]
[Product/category] vs [alternative]: which is better for [use case]?
How to [solve workflow problem] with [category]
[Category] buyer's guide for [audience]
[Use case] FAQ for [audience]
```

## Step 9: Structure the Recommended Page

Mostly automatable, human edits.

The suggested structure should make the page:

- answer-first
- specific
- easy to scan
- useful to the buyer
- clear about tradeoffs
- crawlable in normal HTML
- easy for search/AI tools to understand and cite

Default structure:

```text
1. Answer-first summary
2. Who this page is for
3. The problem or decision the buyer is trying to make
4. Evaluation criteria or comparison points
5. Recommended approach
6. Product-specific proof, examples, screenshots, or workflows
7. FAQ section
8. Clear next step or CTA
```

For comparison pages:

```text
1. Short verdict
2. Who each option is best for
3. Feature / use-case comparison
4. Pricing or implementation differences
5. Limitations and tradeoffs
6. FAQ
7. CTA
```

For FAQ pages:

```text
1. Short intro naming the buyer problem
2. 6-10 direct questions
3. Concise, factual answers
4. Links to relevant product/docs pages
5. CTA
```

## Step 10: Write the Reddit Reply

Manual final edit.

Use this template:

```text
Took a quick look. I would classify you as competing in [category].

The buyer questions I would test first are:
- [question 1]
- [question 2]
- [question 3]
- [question 4]

For questions like these, the pages/sources I would inspect are mostly:
- [source type]
- [source type]
- [source type]

The content gap I would look at first:
[gap diagnosis]

If I were choosing one thing to publish next, I would publish:
[recommended asset/title]

Why:
[short rationale]

How I would structure it:
- [section 1]
- [section 2]
- [section 3]
- [section 4]
- [section 5]

Caveat: this is directional, not a ranking guarantee. The goal is to give you a concrete next page to publish instead of another abstract visibility score.
```

Keep it useful, concise, and founder-readable. Do not make it sound like an agency audit.

## What To Automate First

Build the first internal command around research prep:

```text
npm run reddit-teardown -- https://example.com
```

It should generate:

```text
teardowns/example-com/research-packet.md
teardowns/example-com/reddit-reply-draft.md
```

### research-packet.md

Should include:

- website summary
- inferred category
- audience guess
- likely use cases
- existing content found
- likely competitors/sources
- 5-8 buyer questions to test
- suggested search queries
- first-pass gap diagnosis
- recommended next asset
- suggested page structure

### reddit-reply-draft.md

Should include:

- a concise reply using the Reddit template
- careful language
- no unsupported visibility claims
- placeholders for manual prompt/search notes where needed

## What Not To Automate Yet

Do not fully automate:

- final recommendation judgment
- AI visibility claims
- long-term visibility tracking
- publishing content
- paid-pilot reporting
- outreach to third-party sites
- claims about guaranteed ranking, citations, traffic, or revenue

Do not say:

```text
You are not showing up in ChatGPT.
Competitor X dominates AI search.
This page will rank.
This will get cited.
```

Say:

```text
The buyer questions I would test first are...
The source types I would inspect are...
The likely content gap is...
This page is worth publishing because...
This is directional, not a guarantee.
```

## Operating Loop For Each Reddit Comment

1. Copy the submitted website URL.
2. Run the teardown automation.
3. Review the inferred category, audience, competitors, and buyer questions.
4. Manually run the strongest 3-5 prompts in Google, ChatGPT, and optionally Perplexity.
5. Add quick notes about who shows up and what source types appear.
6. Approve or adjust the recommended asset.
7. Edit the Reddit reply draft.
8. Post the reply.
9. Save the final teardown for later follow-up.

## Validation Signals

Track whether people:

- comment their site
- reply positively to the teardown
- ask follow-up questions
- ask for the full brief or draft
- ask if this can be done monthly
- share another site
- DM after the teardown

The paid pilot signal is not:

```text
Cool idea.
```

The paid pilot signal is:

```text
Can you keep doing this and help us ship the pages?
```
