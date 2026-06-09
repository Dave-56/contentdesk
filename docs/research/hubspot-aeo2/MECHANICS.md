---
title: HubSpot AEO2 — Mechanics
updated: 2026-06-07
type: research
status: current
---

# HubSpot AEO2 — Mechanics

This doc explains how HubSpot AEO2 works in simple English.

## Simple Model

HubSpot AEO2 builds a prompt grid.

User picks values across three dimensions:

1. ICP
2. Product or service
3. Buyer journey phase

Each unique combination becomes one segment. HubSpot then generates a fixed number of
prompts per segment.

Formula:

```text
segments = ICP count x product count x buyer journey phase count
total prompts = segments x prompts per segment
```

Example from source:

```text
2 ICPs x 3 products x 2 buyer journey phases = 12 segments
12 segments x 2 prompts per segment = 24 total prompts
```

## Plain-English Explanation

HubSpot asks: "Who is buying, what are they buying, and where are they in the buying
process?"

Then it mixes those answers together.

Each mix becomes a small audience/use-case bucket. For each bucket, HubSpot writes buyer
questions that people might ask ChatGPT, Gemini, or Perplexity.

The prompt number is not one shared total. It is a multiplier. If user chooses many ICPs,
many products, and many buyer stages, prompt count grows fast.

Simple version:

```text
More audience choices = more segments.
More prompts per segment = more generated prompts.
Total prompt count grows by multiplication, not addition.
```

## Observed UI Flow

Screenshot shows:

- Product is in "AEO Beta".
- Main tabs: Dashboard, Prompts, Citations, Recommendations.
- Prompt filters include Date, Engine, Group, Products/Services, Ideal customer profile,
  Location, and Buyer journey phase.
- Buyer journey phase options shown: Awareness, Consideration, Evaluation, Decision.
- Engines shown: ChatGPT, Perplexity, Gemini.
- Prompt answer view shows whether brand was mentioned in each run.
- Free trial prompt usage shown as `11/25 prompts`.
- Dashboard warns about prompt coverage blind spots.
- Prompt coverage grid says each cell is a product/ICP combination.
- Coverage example: `2 of 5 combinations tracked`.
- Product row shown: Tiny Lemon.
- Columns appear to be same ICP/category with different countries: United States, Canada,
  Australia, United Arab Emirates, and another off-screen market.

## What This Means

HubSpot is treating AEO like controlled prompt coverage.

It does not start with random prompts. It creates prompts from structured business context:

- who buyer is,
- what product/service buyer cares about,
- how close buyer is to purchase.

That gives HubSpot a clean reporting structure. User can filter prompts by segment and see
where brand appears or disappears.

## Dashboard Metrics

HubSpot's dashboard appears to measure four major AEO outcomes.

### Brand Visibility

Definition from tooltip:

```text
How often your brand is mentioned in AI answers for your tracked prompts.
If your brand name is mentioned in 7 out of 10 answers, your Brand Visibility will be 70%.
```

Plain English:

```text
Brand visibility = answers mentioning brand / total tracked answers
```

Example:

```text
7 brand mentions / 10 AI answers = 70% brand visibility
```

Observed Tiny Lemon value: `0.6%`.

This is mention rate only. It does not prove brand was recommended, preferred, or cited.

### Sentiment Score

Definition from tooltip:

```text
An NLP-based measure of how positively or negatively your brand is described in AI responses.
```

Plain English:

HubSpot reads AI answer text and scores whether brand language is positive or negative.

Observed Tiny Lemon value: `36.25%`.

This likely means Tiny Lemon is described somewhat positively when mentioned, but it is still
barely mentioned overall.

### Share Of Voice

Share of voice compares brand visibility against competitors.

Observed competitor landscape:

| Company | Share of voice |
|---|---:|
| Botika | 85% |
| PixUp AI | 8% |
| Snaproom | 5% |
| TinyLemon | 2% |

Plain English:

HubSpot counts which brands show up most across tracked AI answers. If competitors are named
far more often, they own the answer space.

This is useful because brand visibility alone misses relative position. Tiny Lemon can rise
from 0% to 2%, but if Botika has 85%, market visibility is still dominated by Botika.

Open detail: screenshot proves HubSpot tracks competitors in reporting, but does not prove
whether user can manually add competitors, HubSpot auto-detects them from AI answers, or both.

### Citation Analysis

Citation analysis tracks websites AI engines reference when generating answers.

Observed modules:

- Top domains: most cited websites.
- Citations by channel: citation categories such as competitor, earned, owned, peer, UGC,
  and review site.
- Citations with brand mention rate vs. competitors: how much of citation landscape
  references each brand.

Observed top domains:

| Domain | Citations |
|---|---:|
| shopify.com | 654 |
| wearview.co | 137 |
| youtube.com | 113 |
| claid.ai | 111 |
| rewarx.com | 62 |

Plain English:

HubSpot is not only asking "did AI mention us?" It also asks "what sources did AI rely on?"

This matters because source control is different from answer control. If AI keeps citing
Shopify, YouTube, review sites, or competitor pages, the fix may be off-site inclusion, not
another owned blog post.

## ICP Versus Country Confusion

HubSpot's UI seems to treat location as part of ICP setup.

In screenshot, columns look like same customer type repeated by country:

```text
Shopify fashion/apparel buyer - United States
Shopify fashion/apparel buyer - Canada
Shopify fashion/apparel buyer - Australia
Shopify fashion/apparel buyer - United Arab Emirates
```

So "5 ICPs" may not mean five totally different personas. It may mean five ICP variants,
where each variant includes country/market.

Plain English:

```text
HubSpot is not only asking "who is buyer?"
It is also asking "where is buyer?"
Then it treats each country-specific buyer as a separate coverage cell.
```

Reason: AI engines can answer differently by market. A Shopify apparel founder in Canada may
get different recommendations than one in the United States because app availability,
examples, currency, search results, and local phrasing can differ.

But terminology is muddy. Calling every country variant a separate ICP can make the product
feel confusing.

## Prompt Page Workflow

HubSpot's prompt page is useful because user can click one prompt and inspect answers by
engine.

Observed flow:

1. User selects prompt from left list.
2. Right panel shows selected prompt.
3. Engine cards show ChatGPT, Perplexity, and Gemini.
4. User clicks engine/run dropdown to view answer.
5. Panel shows whether brand was mentioned in that run.

Missing product opportunity: manual rerun.

Plain English:

```text
Scheduled runs show trend.
Manual reruns help test right now.
```

Good AEO product should let user rerun one prompt on one engine or all engines, with clear
budget impact and run history. Reruns should not overwrite old data; they should append a new
run so user can compare before/after.

Manual rerun use cases:

- Spot-check if AI answer changed.
- Test after publishing/updating asset.
- Debug weird result.
- Compare ChatGPT vs Perplexity vs Gemini/Claude on same prompt.
- Run one or two manual tests without starting full tracking job.

## Assistant Handoff / Fix Brief Workflow

Important product opportunity: turn AI answer text into work.

Example from screenshot:

```text
It may be weaker if you need a mature credit/pricing structure that's easy to benchmark.
```

Plain English:

AI is not only giving visibility score. It is telling user why buyer might not choose the
brand. Product should let user capture that sentence and send it to an assistant/repo task.

Best workflow:

1. User highlights weakness in AI answer.
2. User clicks "Investigate this" or "Send to assistant."
3. ContentDesk creates a fix brief with prompt, engine, run date, quote, citations, and
   competitor context.
4. Assistant investigates why AI said it.
5. Assistant proposes website/listing/pricing/content changes.
6. User ships change.
7. User reruns same prompt to see if answer changes.

This is stronger than dashboard reporting because it closes loop from diagnosis to action to
verification.

## One-Prompt Breakdown / Objection Mining

Important learning: one prompt can contain multiple product and proof gaps.

Example answer:

```text
TinyLemon looks differentiated but not yet the obvious default winner.
It stands out for brand consistency and flat-lay/supplier-photo-to-model-photo workflow.
But compared with competitors, it currently seems to have less visible public proof.
```

Plain English:

AI is giving a buyer-style objection. It is not only saying whether brand appeared. It is
saying:

```text
Positioning is clear.
Proof is weak.
Buyer should compare before choosing.
```

This creates a deeper workflow:

1. Break answer into claims.
2. Mark each claim as positive, negative, neutral, or action-needed.
3. Connect each claim to public evidence.
4. Check existing assets before recommending new work.
5. Decide whether asset needs update, stronger proof, or external citation.

Key rule:

```text
Existing asset does not mean solved.
Asset must answer the exact objection AI raised.
```

Example: user may already have a Shopify App Store listing. ContentDesk should not blindly
recommend "create listing." It should inspect whether the listing makes proof visible:

- Does listing show enough real examples?
- Does listing explain pricing/credits clearly?
- Does listing show review/social proof?
- Does listing prove flat-lay/supplier-photo workflow?
- Does listing position Tiny Lemon against alternatives?
- Does listing contain language AI engines can retrieve and repeat?

Better recommendation:

```text
Update Shopify App Store listing proof section because AI sees differentiation but doubts
public proof versus incumbents.
```

This is different from generic AEO reporting. It turns one prompt into a proof-gap audit.

## Citation URL Normalization

Citation analysis needs URL cleanup before scoring.

Example from prompt:

```text
TinyLemon vs other Shopify AI model photo apps for apparel brands
```

Observed citations include:

- `https://tinylemon.xyz`
- `https://apps.shopify.com/tiny-lemon?locale=zh-TW&surface_detail=...`
- competitor Shopify App Store pages such as ST, Attired, Picjam, StyleScan, Ayna, and Huhu.

Plain English:

AI cited two Tiny Lemon source types:

1. First-party site: `tinylemon.xyz`
2. Marketplace listing: `apps.shopify.com/tiny-lemon`

The Shopify URL looks different because it carries query parameters:

```text
locale=zh-TW
surface_detail=...
surface_inter_position=...
surface_intra_position=...
surface_type=...
surface_version=...
```

These parameters are Shopify navigation/tracking/localization context. For citation scoring,
they should usually be stripped so the canonical URL becomes:

```text
https://apps.shopify.com/tiny-lemon
```

Product rule:

```text
Normalize URL for scoring.
Keep original URL for audit/debug.
```

Why AI cited these sources:

- Prompt asks for Shopify AI model photo apps.
- Shopify App Store pages are high-authority, category-relevant pages.
- Competitor app pages contain pricing, ratings, reviews, launch dates, screenshots,
  features, and app descriptions.
- Tiny Lemon homepage and listing explain flat-lay/supplier-photo-to-model-photo workflow.

ContentDesk should group citations by:

- domain,
- canonical URL,
- source type,
- brand,
- role in answer.

Example source types:

- owned site,
- owned marketplace listing,
- competitor marketplace listing,
- competitor site,
- review/listicle,
- community/UGC,
- video.

This prevents bad analysis like treating `apps.shopify.com/tiny-lemon?locale=zh-TW...` as a
separate source from `apps.shopify.com/tiny-lemon`.

## Cross-Engine Answer Drift

Different AI engines may answer the same prompt with different competitor sets, facts, and
emphasis.

Gemini example for:

```text
TinyLemon vs other Shopify AI model photo apps for apparel brands
```

Gemini positioned Tiny Lemon positively:

```text
TinyLemon's strengths lie in its direct Shopify integration and its focus on converting
existing flat-lay/supplier photos into a range of on-model visuals and videos, with an
emphasis on brand-specific styling.
```

But Gemini also expanded the competitor set beyond Shopify App Store incumbents:

- Botika
- Rewarx Studio AI
- BetterStudio
- Ayna
- FASHN AI
- Mocky AI
- Claid
- SellerPic
- Modelia
- Pikes AI
- Photoroom
- Pixa

Product lesson:

```text
Same prompt should have engine comparison, not only per-engine answer text.
```

ContentDesk should flag:

- competitors unique to one engine,
- facts that differ by engine,
- pricing claims,
- uncited claims,
- category drift where AI compares against tools outside exact Shopify app set.

Example fact-check issue:

Gemini says Tiny Lemon pricing "appears to be around $249 per month." Public Shopify listing
shows pricing starts at `$39/month`, with higher tiers including `$99/month` and `$249/month`.
So Gemini likely over-indexed the highest tier or missed "starts at" framing.

This matters because buyer perception can be distorted by one wrong or incomplete fact.
Recommendation should become:

```text
Make pricing tiers easier for AI to parse and benchmark: starts at $39/month, Growth $99/month,
Scale $249/month, with clear credit/output counts.
```

## Rerun Timing After A Fix

Short answer: user can rerun same day, but same-day result is only a smoke test. Stronger
validation needs repeated runs over days/weeks.

Why:

```text
Fix shipped does not mean AI answer updates immediately.
AI answer update depends on crawl, index, retrieval, ranking, and answer generation.
```

Timing model:

| Window | What it means |
|---|---|
| Same day | Useful for spot-checking if live/web retrieval can see the changed page. Not reliable proof. |
| 24-72 hours | Good first validation window after submitting URLs, updating sitemap, or using IndexNow/Bing tools. |
| 7 days | Better signal for weekly AEO tracking and prompt trend comparison. |
| 14-30 days | Better for source/citation behavior, competitor comparison, and recommendation changes. |

Different fixes move at different speeds:

- Existing page copy update: can show fastest if engine fetches page directly.
- New owned page: slower because search engines must discover, crawl, index, and trust it.
- Shopify App Store listing update: depends on Shopify page update plus search/AI retrieval.
- YouTube/demo asset: can take longer because AI engine must decide video/source is relevant.
- Third-party listicle/review/community mention: often slowest but may be strongest for
  citations.

Product implication:

ContentDesk should support:

1. "Rerun now" for manual spot-check.
2. "Schedule verification" for 3-day, 7-day, and 30-day follow-up.
3. Run comparison that labels results as early signal versus stable signal.
4. A fix brief that stores which prompts should be rerun after shipping.

## Publish Discovery Contract

Important learning from Tiny Lemon source-hygiene fix:

```text
Publishing content is not enough.
Content must be wired into discovery surfaces.
```

Example: a new Tiny Lemon blog/guide existed, but SEO validation failed because it was not
added to `llms.txt`. That means the publish handoff was incomplete.

ContentDesk should treat every generated page, guide, comparison, listing update, or blog
post as two jobs:

1. Create the content.
2. Register the content so search/AI systems and agents can find the canonical version.

Discovery checklist:

- Add or update internal links.
- Add canonical URL.
- Add/update sitemap entry.
- Add to `llms.txt` when the site uses it.
- Add to `llms-full.txt` when the site uses it.
- Keep JSON-LD on canonical domain.
- Remove or redirect staging/preview URLs.
- Avoid stale translated/mirrored source leaks.
- Submit/request recrawl where possible.
- Store target prompts for post-publish rerun.

CMS integration lesson:

```text
ContentDesk needs a publish contract per site/CMS.
```

Examples:

- Shopify blog: publish article, check canonical, add internal links, ensure sitemap updates.
- Markdown repo: add file, update index/nav, update `llms.txt`, rebuild sitemap.
- Headless CMS: publish entry, rebuild site, regenerate sitemap/LLM files.
- Docs site: update sidebar/nav, search index, `llms.txt`, and canonical metadata.

`llms.txt` caveat: useful as a clean AI-readable content map, but not guaranteed citation or
ranking magic. It should complement canonical URLs, sitemap, internal links, structured data,
and source quality.

## AI Search As Diagnostic

ContentDesk should treat AI search as a mirror, not magic channel.

Plain English:

```text
AI answers reflect available evidence.
If evidence is weak, stale, unclear, or mostly competitor-owned, AI visibility will be weak.
```

That means score tracking is only useful when paired with explanation.

Good visibility report should say:

- score changed,
- which prompts changed,
- which sources changed,
- which competitors gained/lost,
- which citations appeared/disappeared,
- which proof gaps remain,
- which boring action should happen next.

Better product promise:

```text
Measure how AI sees your business, then improve the evidence it can trust.
```

Worse product promise:

```text
Rank in ChatGPT.
```

## Prompt Selection Standard

Important learning: AI-generated prompts are seed prompts, not guaranteed truth.

HubSpot can "give" prompts, but users still need to know:

```text
Are these the right buyer questions for my business?
```

Prompt quality problem:

- Generated prompts can be directionally good.
- They may not match exact business model, product nuance, ICP, or buying motion.
- Users do not know what "good coverage" means.
- Without standard, prompt tracking feels arbitrary.

ContentDesk should create a prompt-selection standard.

Good prompt set should include:

1. Category prompts: "best Shopify app for on-model product photos"
2. Problem prompts: "how do apparel brands turn flat-lays into model photos?"
3. Alternative prompts: "Tiny Lemon alternatives"
4. Competitor comparison prompts: "Tiny Lemon vs Botika"
5. Feature prompts: "Shopify app for bulk AI model photos"
6. Buyer-stage prompts:
   - Awareness: problem education
   - Consideration: tool options
   - Evaluation: comparisons/proof/pricing
   - Decision: shortlist/final recommendation
7. Objection prompts:
   - pricing,
   - reviews,
   - trust,
   - quality,
   - workflow fit.

Prompt validation loop:

1. Generate seed prompts.
2. Let user edit/reject.
3. Score prompts for business fit.
4. Compare against real demand evidence: SERP, forums, reviews, competitor pages, Search
   Console when available.
5. Run small test batch.
6. Review whether answers reveal useful action.
7. Promote best prompts into tracked set.

Product implication:

```text
Don't ask user to trust generated prompts blindly.
Show why each prompt exists and what decision it tests.
```

This turns prompt tracking from "AI made questions" into a content-calendar strategy layer.

## Terms To Define

- AEO: optimizing so AI answer engines mention, cite, or recommend brand.
- AI visibility: how often brand appears in AI answers.
- Citations: source links AI engine uses or shows.
- Mentions: brand appears in answer text.
- Recommendations: AI engine positions brand as a suggested solution.
- Sentiment: positive or negative language around brand in AI answer text.
- Share of voice: brand's share of total brand mentions versus competitors.
- Prompt coverage: set of buyer questions being tested.
- Content gaps: questions where competitors show up and brand does not.
- Segment: one ICP/product/buyer-stage combination.

## Open Questions

- Does AEO2 scan AI answers directly, or infer opportunity from SEO/content data? Screenshot
  suggests direct AI answer scanning.
- Does it track competitors per prompt?
- Can user manually add competitors to track, or are competitors auto-detected from AI
  answers?
- Does it separate "brand cited" from "brand recommended"?
- Does it recommend owned-content work, off-site work, or both?
- Does it close loop after content ships?
- Is location always part of ICP setup, or can location be tracked independently?
- Does HubSpot support manual reruns for one prompt/engine, or only scheduled/tracked runs?
- Does HubSpot let users convert answer-level weaknesses into tasks or assistant prompts?
- Does HubSpot distinguish same-day spot-checks from stable post-fix validation windows?
- Does HubSpot break one answer into positive claims, objections, proof gaps, and asset-level
  fixes?
- Does HubSpot normalize cited URLs and separate canonical source from original cited URL?
- Does HubSpot compare answers across engines and flag fact drift, competitor drift, and
  unsupported claims?
- Does HubSpot include publish/discovery wiring such as sitemap, canonical, `llms.txt`,
  source hygiene, and rerun prompts after a content fix?
- Does HubSpot explain why each generated prompt belongs in tracking, or only generate
  directionally useful prompts?
