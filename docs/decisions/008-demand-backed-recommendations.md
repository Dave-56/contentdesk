---
title: ADR 008 — Demand-Backed Recommendation Work Orders
updated: 2026-06-03
type: decision
status: current
---

# ADR 008 — Demand-Backed Recommendation Work Orders

## Decision

Visibility recommendations must start from owned-content inventory and demand-backed buyer
questions, then classify the gap before recommending work.

## Why

Lead teardowns showed scan data alone is not enough. DataJelly and Coolie already had
content, so "write a new guide" was often wrong. Google SERPs, competitor titles, AI cited
sources, and blog inventories changed the recommendation from generic content creation to
specific page updates.

Ahrefs AI-search research adds an important constraint: AI citation opportunities are not
only owned-page edits. "Best X" listicles, off-site review/listing pages, homepages, app
stores, and YouTube/video presence can drive visibility. Some cited pages also have little
or no Google organic visibility, so SEO ranking evidence is useful but incomplete.

The product should not stop at "competitor mentioned, you absent." It should produce a work
order:

- which buyer question matters
- which competitor/source page is winning
- whether the customer already has a relevant page
- what gap type exists
- which exact page to create or update
- whether the fix is owned content, off-site inclusion, or video/proof
- which sections/examples/comparisons/proof to add
- which prompts to re-run after the change

## Gap Types

- Missing page: create guide, comparison, alternative, use-case, FAQ, or integration page.
- Weak existing page: update title, H2s, examples, comparison, proof, and buyer-question
  framing.
- Off-site citation gap: customer absent from cited third-party/list/ranking pages.
- Off-site inclusion gap: customer needs inclusion in third-party listicles, reviews,
  directories, app stores, or partner/resource pages.
- Comparison gap: competitor comparison exists in buyer journey but customer has no strong
  owned comparison.
- Proof gap: answer needs case studies, benchmarks, examples, reviews, or data.
- Video gap: product/category needs demo or explainer video presence, especially where
  YouTube mentions appear to influence AI brand visibility.
- Retrieval/citation gap: model may retrieve a page without citing it, or cite a source
  without naming the brand; each state needs different diagnosis.
- Prompt-set gap: prompts are generic or not backed by buyer-demand evidence.

## Revisit When

Revisit after owned-content inventory, buyer-question discovery, cited-source analysis, and
gap-classified recommendations work for three different lead domains without manual patching.
