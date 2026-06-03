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

The product should not stop at "competitor mentioned, you absent." It should produce a work
order:

- which buyer question matters
- which competitor/source page is winning
- whether the customer already has a relevant page
- what gap type exists
- which exact page to create or update
- which sections/examples/comparisons/proof to add
- which prompts to re-run after the change

## Gap Types

- Missing page: create guide, comparison, alternative, use-case, FAQ, or integration page.
- Weak existing page: update title, H2s, examples, comparison, proof, and buyer-question
  framing.
- Off-site citation gap: customer absent from cited third-party/list/ranking pages.
- Comparison gap: competitor comparison exists in buyer journey but customer has no strong
  owned comparison.
- Proof gap: answer needs case studies, benchmarks, examples, reviews, or data.
- Prompt-set gap: prompts are generic or not backed by buyer-demand evidence.

## Revisit When

Revisit after owned-content inventory, buyer-question discovery, cited-source analysis, and
gap-classified recommendations work for three different lead domains without manual patching.
