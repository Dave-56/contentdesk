---
title: Reddit Teardown Leads — Index
updated: 2026-06-01
type: reference
status: current
---

# Leads — Reddit Teardowns

Teardown **packets** under `packets/` are generated `data`, not docs. Don't read them all to
find the relevant one — use this table. Note: per [`NOW.md`](../status/NOW.md), new lead
generation is currently a **non-goal**; these are reference.

## Packet index

| Packet | Company | Category | Date | Maturity |
|---|---|---|---|---|
| [everylastmile](packets/everylastmile.md) | EveryLastMile | iPhone mileage tracking for work drivers | 2026-05-29 | early draft |
| [getsounth](packets/getsounth.md) | Sounth | plant-watering reminder app | 2026-05-29 | in progress (2 prompts validated) |
| [nordic](packets/nordic.md) | Nordic Real Estate Services / Solsten | real estate services | 2026-05-29 | in progress (4 prompt checks + blog review) |
| [saasniche](packets/saasniche.md) | SaasNiche | SaaS niche directory | 2026-05-29 | summary recommendation drafted |
| [verydrm](packets/verydrm.md) | VeryDRM | DRM / content protection | 2026-05-29 | early draft |

## How teardowns are produced

- Process: [`workflow.md`](workflow.md) — the Reddit teardown workflow.
- Distribution / finding app makers: [`distro.md`](distro.md).
- Original lead notes: [`LEADS.md`](LEADS.md).
- Code: `src/lib/reddit-teardown/`.

When a packet's maturity or next action changes, update the row above.
