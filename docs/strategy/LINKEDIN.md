---
title: ContentDesk LinkedIn GTM
updated: 2026-06-10
type: stable
status: current
---

# ContentDesk LinkedIn GTM

Goal: build faceless ContentDesk brand on LinkedIn that funnels leads (free visibility
scans → waitlist/early access → $19/mo) to the website.

## Why LinkedIn = ContentDesk's channel (not Tiny Lemon's)

- LinkedIn ICP = founders, marketers, growth people → ContentDesk's buyer.
- Tiny Lemon's buyer (Shopify fashion merchants) lives on Instagram/TikTok/Facebook
  groups/App Store search, barely on LinkedIn.
- One brand, one narrative on LinkedIn: ContentDesk. Tiny Lemon appears **inside** the
  narrative as the live case study, never as a second brand.

## The narrative

> "We built a Shopify app (Tiny Lemon). Instead of ads or SEO, we're using our own AI
> agent to get it cited by ChatGPT and Perplexity. Enterprise AEO tools cost $500–3k/mo;
> we're doing it for $19. Documenting everything — weekly receipts."

Why it works pre-product:

- **The experiment is the content, not the product output.** No need for finished radar
  or polished results — the journey toward citation lift is the feed.
- Built-in stakes (will it work?), villain (expensive enterprise AEO tools), and
  scoreboard (citation/mention counts from visibility scans).
- Faceless-compatible: story carries the account, not a face.

## Account setup

- Brand-named account ("ContentDesk"), posting like an operator in first person
  ("we ran a scan on 40 buyer prompts this week..."), never like a press release.
- Avoid a bare company page as the primary surface — LinkedIn throttles page reach to
  ~1–2% of followers. Personal-style account earns reach through posts + comments.
- New account warm-up: 2 weeks of posting + commenting before any DM-heavy plays
  (restriction risk).

## Content pillars (4)

1. **Experiment log (weekly).** Visibility scan receipts from
   `data/tiny-lemon/visibility/runs/`. Format: "Week N: Tiny Lemon went from 0 mentions
   to appearing in 2 of 15 buyer prompts. Here's what we changed." Competitor-only
   answers turning into mixed answers = chart/screenshot content.
2. **AEO education.** One underrated stat per post, with explanation. Source:
   `docs/research/` (AEO 2026 research). Hooks: Reddit feeds AI citations; domain
   authority is irrelevant to AI search; AI-search traffic converts 4–23x better.
3. **Price villain.** "Enterprise AEO tools quoted $X/mo. Solo founders can't pay that.
   So we built the $19 version." Repeat often — pricing is the wedge
   (see [`PRICING.md`](PRICING.md), [`POSITIONING.md`](POSITIONING.md)).
4. **Teardowns.** Ask Perplexity/ChatGPT "best Shopify app for fashion product photos"
   (or another niche's buyer prompt) — screenshot who gets cited, explain why. Founders
   in that niche self-identify in comments.

## Lead magnet: free AI-search visibility scan

**Buildable today** — `npm run prompt:infer -- --url <site>` already exists
(`src/lib/prompt-scan/`).

- Offer: "Drop your URL, we'll tell you if ChatGPT/Perplexity recommends you or your
  competitor — free."
- Run manually per request early on. Send a short report (mentions yes/no, who gets
  cited instead, 2–3 fix suggestions). Capture email → waitlist/early access.
- Each scan = a lead **and** material for a future teardown post. One loop:
  scan Tiny Lemon → post receipts → followers request scans → scans become leads +
  next posts → product matures against real demand.

## Cadence

| Day | Activity |
|-----|----------|
| Mon | Experiment log post (weekly scan receipts) |
| Tue | Commenting only (30 min) |
| Wed | AEO stat post |
| Thu | Teardown OR price-villain post (alternate weeks) |
| Fri | Lead-magnet post (free scan CTA) every 1–2 weeks; otherwise commenting |
| Daily | 30 min commenting on build-in-public / indie hacker / founder posts |

- 3–4 posts/week total. Don't exceed — comment time compounds faster than extra posts
  for a new account.
- Expect 4–6 weeks cold-start before traction. Don't judge before week 6.

## Funnel mechanics

1. Post → soft CTA: "comment SCAN" or "link in comments" (never links in post body —
   kills reach).
2. DM every commenter their actual scan result — the DM **is** the product demo.
3. Scan report email → waitlist/early-access page → $19/mo.

## Rules

- No links in post body. Comments or DM only.
- "Drop your URL" posts: make the value explicit, or it reads as engagement bait.
- Don't post Tiny Lemon as its own brand here; it's evidence, not the pitch.
- Every claim gets a receipt (screenshot of scan run, citation, chart). No vibes-only
  posts.

## Metrics (weekly review)

- Leading: impressions, profile views, comment replies received.
- Funnel: scan requests, scan reports delivered, emails captured, waitlist signups.
- North star: scan requests/week. Everything else feeds it.
