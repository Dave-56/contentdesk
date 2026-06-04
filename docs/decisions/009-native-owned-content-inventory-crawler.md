---
title: ADR 009 — Native Owned Content Inventory Crawler
updated: 2026-06-04
type: decision
status: current
---

# ADR 009 — Native Owned Content Inventory Crawler

## Decision

Owned-content inventory uses a native fetch crawler for the MVP: sitemap discovery, common
owned-content paths, same-domain links, canonical dedupe, bounded crawl limits, crawl status
fields, and inline AI understanding when AI Gateway is configured.

Do not use Firecrawl, Exa, Parallel, or another hosted crawler for this layer yet.

## Why

The crawler's first job is not deep web research. It is to prevent bad recommendations by
knowing which owned pages already exist. Native fetch is enough for the current contract and
keeps the system cheap, inspectable, and easy to dogfood across Tiny Lemon and lead domains.

DataJelly showed why bounds and progress matter. Full unbounded profiling can look hung
because pages are crawled first and understanding runs sequentially. The correct MVP fix is
not a bigger crawler dependency; it is explicit `--max-pages` / `--max-depth` controls,
timeouts, progress logs, and better page-type classification.

## Revisit When

Revisit external crawler providers when native fetch repeatedly misses important owned
content because of rendering, auth, bot protection, or sitemap/link discovery gaps across
multiple real lead domains.
