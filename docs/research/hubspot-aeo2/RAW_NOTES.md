---
title: HubSpot AEO2 — Raw Notes
updated: 2026-06-07
type: research
status: current
---

# HubSpot AEO2 — Raw Notes

Paste source data here. Keep raw evidence separate from interpretation.

## Sources

### Source 1 — User screenshot and copied help text

Date captured in thread: 2026-06-07.

Copied text:

```text
How they calculate prompt generation
Prompts are automatically created based on the combinations you choose across three dimensions: ICP, Product, and Buyer Journey Phase. Each unique combination represents a segment.

The number you enter is applied per combination, not as a total.

For example, if you select 2 ICPs, 3 products, and 2 buyer journey phases, that creates:

2 x 3 x 2 = 12 combinations

If you enter 2 prompts per combination, the system will generate:

12 x 2 = 24 total prompts

If the total feels too high, reduce selections in any category, lower the number of prompts per combination or purchase additional prompts.
```

### Source 2 — Prompt coverage screenshot

Date captured in thread: 2026-06-07.

Copied text:

```text
You have blind spots in your AI visibility

You're only tracking 2 of 5 ICPs and 1 of 1 products. AI engines give different answers based on who's asking, so gaps in coverage mean gaps in your data.
```

Visible modal text:

```text
Prompt coverage

Each cell is a product/ICP combination you could be tracking. Empty cells are blind spots in your AI visibility.
```

### Source 3 — Dashboard metric screenshots

Date captured in thread: 2026-06-07.

Brand visibility tooltip:

```text
How often your brand is mentioned in AI answers for your tracked prompts. If your brand name is mentioned in 7 out of 10 answers, your Brand Visibility will be 70%.
```

Sentiment tooltip:

```text
An NLP-based measure of how positively or negatively your brand is described in AI responses.
```

Citation analysis copy:

```text
The websites AI engines reference when generating answers. Tracking which sites get cited most, and whether your brand is mentioned in them, is key to understanding and improving your visibility.
```

### Source 4 — Prompt answer page screenshot

Date captured in thread: 2026-06-07.

Visible selected prompt:

```text
TinyLemon vs other Shopify AI model photo apps for apparel brands
```

Visible tabs:

```text
Answers
Prompt Analysis
Recommendations
```

### Source 5 — Answer weakness / fix-loop screenshot

Date captured in thread: 2026-06-07.

Visible answer section:

```text
It may be weaker if you need:

- lots of proven Shopify reviews and a long track record,
- deep bulk controls,
- a mature credit/pricing structure that's easy to benchmark,
- shopper-facing virtual try-on rather than just merchant-side image generation.
```

### Source 6 — One-prompt objection mining note

Date captured in thread: 2026-06-07.

User-provided AI answer excerpt:

```text
TinyLemon looks differentiated but not yet the obvious default winner. It stands out for brand consistency and flat-lay/supplier-photo-to-model-photo workflow, which is exactly the pain many fashion Shopify stores have. But compared with competitors, it currently seems to have less visible public proof than stronger App Store incumbents like ST, Attired, Picjam, or StyleScan.
```

### Source 7 — Citation list for comparison prompt

Date captured in thread: 2026-06-07.

Prompt:

```text
TinyLemon vs other Shopify AI model photo apps for apparel brands
```

Observed citations:

```text
https://tinylemon.xyz
https://apps.shopify.com/tiny-lemon?locale=zh-TW&surface_detail=store-design-images-and-media-image-editor&surface_inter_position=1&surface_intra_position=20&surface_type=category&surface_version=redesign
https://apps.shopify.com/ai-models-and-product-photos
https://apps.shopify.com/attired
https://apps.shopify.com/picjam
https://apps.shopify.com/stylescan-studio
https://apps.shopify.com/ayna-studio
https://apps.shopify.com/huhu-ai-virtual-try-on
```

### Source 8 — Gemini answer for comparison prompt

Date captured in thread: 2026-06-07.

Prompt:

```text
TinyLemon vs other Shopify AI model photo apps for apparel brands
```

Gemini summary:

```text
TinyLemon is a Shopify AI model photo app designed specifically for apparel brands, enabling them to transform flat-lay or supplier photos into professional, on-model product images and short videos. It integrates directly with Shopify, allowing users to generate and add images to product listings without leaving the platform.
```

Gemini competitor set:

```text
Botika
Rewarx Studio AI
BetterStudio
Ayna
FASHN AI
Mocky AI
Claid
SellerPic
Modelia
Pikes AI
Photoroom
Pixa
```

Gemini pricing claim:

```text
Pricing for TinyLemon appears to be around $249 per month.
```

Gemini conclusion:

```text
TinyLemon offers a robust solution for Shopify apparel brands seeking to generate on-model product photos and videos efficiently and with brand consistency.
```

### Source 9 — Tiny Lemon source hygiene / publish contract learning

Date captured in thread: 2026-06-07.

User-provided Tiny Lemon agent summary:

```text
Live finding as of June 7, 2026: https://tinylemon.vercel.app/ is still public and returns 200. It has a canonical tag to https://tinylemon.xyz/, but its homepage JSON-LD was leaking tinylemon.vercel.app in @id and url, which is a very plausible AI-citation contaminant.
```

Validated fixes from Tiny Lemon workspace:

```text
- Redirect tinylemon.vercel.app to tinylemon.xyz.
- Add host-level permanent redirect for old Vercel domain.
- Ensure homepage structured data uses canonical SITE_URL.
- Keep sitemap/blog URL generation canonical.
- Update stale internal Shopify listing docs from tinylemon.vercel.app to tinylemon.xyz.
- Fix SEO audit by adding latest blog seoTitle and listing it in public/llms.txt.
```

Validation passed in Tiny Lemon workspace:

```text
npm run check:seo
npm run typecheck
npm run build
```

### Source 10 — Positioning correction

Date captured in thread: 2026-06-07.

User-provided note:

```text
Not "ignore AI search." Better lesson: AI search is mirror, not magic channel.

For ContentDesk, build around this:

1. Track score over time, but also show why score moved: reviews, mentions, citations, sentiment, competitor proof.
2. Teach customers that "AI visibility" is outcome of reputation work, content clarity, and third-party validation.
3. Make action plan boring and useful: get reviews, fix listings, earn mentions, publish proof pages, answer niche queries.
4. Don't sell "rank in ChatGPT." Sell "measure how AI sees your business, then improve evidence it can trust."

For new businesses: care about AI search early, but use it as diagnostic. If AI ignores you, that is signal: not enough outside-world proof yet.
```

### Source 11 — Prompt selection standard note

Date captured in thread: 2026-06-07.

User-provided note:

```text
I got a walk through of the tool yesterday and prior to that I had just been trying to figure it out on my own. I'm actually really impressed and I'm planning to build my content calendar around it. I have some questions about the prompts though like what are the best practices in even knowing 100% what your prompts should be? I know HubSpot "gives" them to you but I felt like they were directionally good but not accurate totally to our business. I think it's worth a try though!!
```

## Observations

- AEO product is labeled Beta.
- Top nav includes Dashboard, Prompts, Citations, Recommendations.
- Prompt filters include Product/Services, Ideal customer profile, Location, Buyer journey
  phase, Engine, Group, and Date.
- Buyer journey phases visible in dropdown: Awareness, Consideration, Evaluation, Decision.
- Engines visible in cards/dropdown: ChatGPT, Perplexity, Gemini.
- Free trial usage visible: `11/25 prompts`.
- Prompt list contains Shopify/apparel/on-model product photography questions.
- Answer panel shows "Brand not mentioned in this run."
- ChatGPT answer cites third-party sources such as Shopify App Store and ecommerce/AI photo
  sites.
- Prompt coverage grid shows one product row: Tiny Lemon.
- Grid columns appear to represent ICP variants by country/market.
- Visible country labels include United States, Canada, Australia, and United Arab Emirates.
- Two cells are tracked: United States has 11 prompts; Canada has 4 prompts.
- Other country cells show "Track".
- Coverage says `2 of 5 combinations tracked`.
- Brand visibility metric shows `0.6%` for May 28, 2026 - Jun 6, 2026, weekly.
- Sentiment score shows `36.25%` for same period.
- Competitor landscape shows share of voice: Botika 85%, PixUp AI 8%, Snaproom 5%,
  TinyLemon 2%.
- Citation analysis top domains: shopify.com 654, wearview.co 137, youtube.com 113,
  claid.ai 111, rewarx.com 62.
- Citations by channel categories visible: Competitor, Earned, Owned, Peer, UGC, Review
  Site.
- Citation chart compares brand mention rate versus competitors.
- Prompt page uses split layout: prompt list on left, selected prompt detail on right.
- Selected prompt detail shows engine cards for ChatGPT, Perplexity, and Gemini.
- Each engine card shows mention count, e.g. "Mentioned 1 out of 1 times."
- Answer viewer has engine dropdown and run count, e.g. "Run 1 of 1."
- Answer viewer shows run timestamp, e.g. Jun 6, 2026 07:15 PM.
- Answer text highlights TinyLemon and cited domain `tinylemon.xyz`.
- User wants a manual rerun option for one prompt, including one-test or two-test runs.
- AI answer contains actionable weakness around pricing/credits and benchmarkability.
- User wants to feed this weakness to an AI assistant/blogger/repo agent to investigate,
  draft improvements, then rerun prompt after changes.
- One AI answer can reveal both positive positioning and buyer objections.
- User already has an App Store listing, so recommendation should not assume asset is
  missing. It should inspect whether existing listing answers exact proof gap.
- "Less visible public proof" may mean listing/reviews/examples/copy are insufficient,
  unclear, uncited, or weaker than competitor evidence.
- Citation list includes Tiny Lemon first-party site and Shopify App Store listing.
- Tiny Lemon Shopify listing appears with locale and surface query parameters.
- Competitor citations are mostly Shopify App Store pages.
- For scoring, Shopify query params should be normalized away while original URL remains
  available for audit/debug.
- Gemini answer broadens competitor set beyond Shopify App Store-only alternatives.
- Gemini appears to over-index Tiny Lemon's highest visible tier by saying pricing is around
  `$249/month`; Shopify listing also shows Starter `$39/month` and Growth `$99/month`.
- Gemini answer creates another fix opportunity: pricing/credit tiers should be easier for
  AI engines to parse and summarize.
- Tiny Lemon source-hygiene fix shows ContentDesk handoffs need publish discovery wiring, not
  only content generation.
- New blog/guide should be added to relevant discovery surfaces such as sitemap, internal
  links, canonical metadata, and `llms.txt` when the target site uses it.
- `llms.txt` should be treated as an experimental AI-readable map, not guaranteed ranking
  magic.
- AI visibility should be positioned as evidence/reputation diagnostic, not "rank in
  ChatGPT" promise.
- User pain: prompt generation is useful but lacks an obvious standard for correctness.
- ContentDesk opportunity: explain why each prompt exists, score business fit, and let users
  calibrate prompts before building content calendar around them.

## Quotes

- "Each unique combination represents a segment."
- "The number you enter is applied per combination, not as a total."
- "AI engines give different answers based on who's asking."
- "Each cell is a product/ICP combination you could be tracking."
- "How often your brand is mentioned in AI answers for your tracked prompts."
- "An NLP-based measure of how positively or negatively your brand is described in AI responses."
- "The websites AI engines reference when generating answers."
- "Mentioned 1 out of 1 times."
- "Run 1 of 1."
- "a mature credit/pricing structure that's easy to benchmark"
- "TinyLemon looks differentiated but not yet the obvious default winner."
- "less visible public proof than stronger App Store incumbents"

## Claims To Verify

- Whether prompt generation also uses location when selected, or location is only a filter.
- Whether HubSpot lets user manually add competitors or auto-detects competitors from AI
  answers.
- Whether HubSpot tracks competitors per prompt or only in aggregate share-of-voice views.
- Whether "Recommendations" produce content tasks or generic advice.
- Whether citations are grouped by source domain, prompt, engine, or buyer segment.
- Whether usage count means generated prompts, prompt runs, or unique saved prompts.
- Whether HubSpot supports manual rerun from prompt answer page.
- Whether HubSpot supports sending answer excerpts/recommendations into an assistant or task
  workflow.
- Whether HubSpot breaks one prompt answer into positives, objections, proof gaps, and
  existing-asset fixes.
- Whether HubSpot normalizes cited URLs before grouping/scoring citations.
- Whether HubSpot flags cross-engine answer drift and potential fact errors.
- Whether HubSpot tracks content publish readiness across sitemap, canonical, structured
  data, `llms.txt`, and post-fix rerun prompts.
- Whether HubSpot provides prompt-selection best practices or a confidence score for prompt
  fit.
