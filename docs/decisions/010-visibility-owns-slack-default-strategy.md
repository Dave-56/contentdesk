---
title: ADR 010 — Visibility Owns Slack Default Strategy
updated: 2026-06-04
type: decision
status: current
---

# 010 — Visibility Owns Slack Default Strategy

**Decision:** `/contentdesk` should be able to default to the latest visibility recommendation
instead of generating fresh topic ideas inside the Slack workflow, with
`CONTENTDESK_SLACK_DEFAULT=topics|visibility` as the rollback switch.

**Why:** The visibility layer has the evidence needed to decide what work matters: buyer
prompts, provider answers, citation/source patterns, competitor recommendation state, owned
content inventory, and gap classification. Keeping Research Strategist topic ideation as the
default Slack brain duplicates that logic and can produce work without current visibility
evidence. Slack should stay the founder control surface and production runner: show the
visibility-backed task, guard stale/duplicate clicks, and execute approved work through the
existing pipeline.

**Revisit when:** Slack needs to trigger expensive scans itself, recommendations move from
JSON files to Postgres, or non-article fix kits become the dominant approved work type.
