---
title: ADR 005 — Owned-Site Inventory Before External Asset Audit
updated: 2026-06-02
type: decision
status: current
---

# ADR 005 — Owned-Site Inventory Before External Asset Audit

## Decision

For Shopify app visibility recommendations, inspect the user's owned website content before
doing a broad external asset audit.

## Why

The first `visibility:recommend` output correctly picked a Botika alternatives page, but its
reasoning leaned on `strategy.json` saying `alternative_page` was missing. Tiny Lemon already
has a Modelia alternatives article on its blog. The actual gap is not "no alternatives assets";
it is "no Botika-specific alternatives page found."

Owned-site inventory is the cheapest evidence layer:

- sitemap and blog pages show existing content coverage
- recommendations avoid duplicating assets the user already has
- related existing assets can become reusable patterns
- external audits stay out of V1 scope

## Revisit When

Revisit after owned-site inventory can store exact article URLs and competitor/topic coverage.
Then add broader Shopify external audit surfaces: App Store listing, YouTube, reviews,
community mentions, and earned third-party citations.
