---
title: Manual Codex handoff, no publish automation
updated: 2026-06-01
type: decision
status: current
---

# 002 — Manual Codex handoff

**Decision:** ContentDesk produces a publish-ready kit and a Codex handoff prompt. The
founder manually sends the kit to Codex, which publishes in the website repo. ContentDesk
does **not** push to GitHub or publish on its own for the MVP.

**Why:** Keeps a founder approval gate before anything goes live, avoids the trust and
safety surface of autonomous publishing, and removes the need to build/maintain repo
integrations before the core value (visibility) is proven.

**Revisit when:** The visibility loop is proven and trusted, and manual handoff becomes the
bottleneck — then evaluate GitHub/Codex automation.
