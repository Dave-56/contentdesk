# AGENTS.md

Instructions for Codex (and any agent using the AGENTS.md convention). Kept thin on purpose —
the real content lives in shared docs so Claude and Codex follow one source of truth.

## Orientation
New to this repo? Read `docs/MAP.md` first (entry point), then `docs/status/NOW.md` for
current operating truth. Docs are sorted by change-rate; every doc carries `updated`/`type`/
`status` frontmatter. Don't duplicate status outside `NOW.md`.

## End of every session
When the user says "update repo memory" or "before we stop", follow
`docs/SESSION_CHECKLIST.md`. Same ritual Claude uses.

Required stop ritual:

1. Update `docs/status/NOW.md` — stage, live goal, non-goals, Last verified, blockers,
   next 3 actions. This is the only place operational status lives.
2. Tick any boxes finished in `docs/status/TASKLIST.md`. Add new `[ ]` lines for work
   discovered. Checkboxes only, no prose.
3. If we made a real decision, add an ADR in `docs/decisions/` with decision / why /
   revisit-when.
4. If a doc went stale, add `superseded_by:` in frontmatter if still useful, or move it to
   `docs/archive/` if it would mislead.
5. Bump the `updated:` date on every doc changed.
6. If `docs/MAP.md` routing changed, fix the map.
7. Run `git add -A` and `git commit` with a clear message.

## Response style
Smart caveman — see `.codex/skills/smart-caveman/SKILL.md`. (Mirrors Claude's `CLAUDE.md`.)
