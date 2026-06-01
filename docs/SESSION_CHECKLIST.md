---
title: End-of-Session Checklist
updated: 2026-06-01
type: reference
status: current
---

# End-of-Session Checklist

Canonical ritual for keeping repo memory current. **One source of truth** — `CLAUDE.md`
(Claude) and `AGENTS.md` (Codex) both point here. Edit this file, both tools follow.

Run these before ending any working session:

1. **Update `docs/status/NOW.md`** — stage, live goal, non-goals, **Last verified**,
   blockers, next 3 actions. This is the only place operational status lives.
2. **Update `docs/status/TASKLIST.md`** — tick finished boxes, add new `[ ]` for discovered
   work. Checkboxes only, no prose.
3. **Record decisions** — if we chose X over Y, add an ADR in `docs/decisions/`
   (decision / why / revisit-when).
4. **Handle stale docs** — still useful but overridden → add `superseded_by:` to its
   frontmatter. Would mislead → move to `docs/archive/`.
5. **Bump `updated:`** on every file changed this session.
6. **Fix `docs/MAP.md`** if routing changed (new doc, moved/renamed file).
7. **Commit** — `git add -A && git commit` with a clear message.

## The 80/20
If short on time, do steps **1 + 7** (update NOW.md, commit). They catch most of the value.

## Why these stop rot
| Step | Prevents |
|---|---|
| 1 | stale "where are we" — the #1 thing a fresh agent gets wrong |
| 2 | drift between "done" and reality |
| 3 | re-litigating settled decisions |
| 4 | old truths creeping back |
| 5 | can't tell fresh from rotten |
| 6 | broken navigation |
| 7 | no recoverable history |
