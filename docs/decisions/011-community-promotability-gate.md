---
title: ADR 011 — Community Promotability Gate
updated: 2026-06-05
type: decision
status: current
---

# 011 — Community Promotability Gate

**Decision:** Reddit/forum visibility recommendations must score promotability separately
from AI-search citation presence. A cited thread can produce a `community_answer`
candidate, but it should not become a comment recommendation until the system decides
whether the brand can be mentioned naturally.

**Why:** ContentDesk's goal is not to comment on every cited Reddit thread. For Tiny Lemon,
the useful opportunities are threads where the buyer pain maps to Shopify apparel,
product photography, flat-lays, on-model photos, product-page media, supplier photos,
catalog consistency, or short-form product visuals. Replies should help first, disclose
affiliation, and mention Tiny Lemon only when the mention fits the thread. Promo-sensitive,
founder-feedback, generic advice, or unrelated ecommerce threads may be acceptable for
community reputation, but they are weak or no-fit for AEO-driven Tiny Lemon visibility.

**Revisit when:** Visibility recommendations preserve exact thread URL/title/comment
context, Reddit/forum reply kits ship in Slack, or community reputation becomes a separate
goal from product visibility.
