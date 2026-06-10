---
name: ship
description: Deploy ContentDesk to Vercel (preview or production) and/or push to GitHub correctly. Use when the user asks to "push to Vercel", "deploy a preview", "ship it", "push to GitHub", "open a PR", or "promote to production". Has the exact CLI steps, project IDs, and gotchas so no searching is needed.
---

# Ship ContentDesk (Vercel + GitHub)

Read this fully before acting. It encodes the project's real deploy facts so you do not
re-derive them. Confirm **preview vs production** and **push-to-GitHub yes/no** with the
user if ambiguous — production deploys and remote pushes are outward-facing.

## Project facts

- Vercel account: `dave-56` (team `team_wzZXXlEtJgVDMLw6HPp2UldD`).
- Vercel project: `contentdesk` (`prj_bXQU80BOOVV917ywfBblsQB1AtoF`).
- The `.vercel/project.json` link lives in the **main checkout root**, not in worktrees.
- Default git branch: `master`.

## Vercel deploy

**Branch pushes do NOT auto-create previews here.** You must use the `vercel` CLI.

1. Check auth: `vercel whoami` (expect `dave-56`). If not authed, ask the user to run
   `! vercel login` — do not attempt interactive login yourself.
2. **If working in a git worktree** (`.claude/worktrees/...`), the link is missing. Copy it
   in first, from the worktree dir:
   ```
   cp -R <main-checkout-root>/.vercel .vercel
   ```
   (e.g. `cp -R ../../../.vercel .vercel` when three levels deep under `.claude/worktrees/`.)
3. Deploy:
   - Preview: `vercel deploy --yes`
   - Production: `vercel deploy --prod` (outward-facing — confirm with user first)
   The CLI uploads the working tree and builds remotely, so **uncommitted changes are
   included** — good for previews before committing.
4. The CLI prints `Preview:` and a final ready URL. Build takes ~1–3 min. Run the deploy in
   the background and wait on a log marker (`Build Completed` / final URL) rather than
   foreground `sleep`.

### Expected gotcha: 401 on the preview URL
Preview deployments have **Vercel deployment protection** on. An anonymous
`curl` returns **401 — this is normal, not a deploy failure.** The owner views it in a
browser while logged into the team. Do not treat 401 as broken.

### Env vars — preview vs production scoping (important)
Check with `vercel env ls` (never print secret values). Current scoping:
- `ANTHROPIC_API_KEY` → **Preview + Production**. (Powers the prompt-lab smart-summary Haiku
  pass, so smart summaries work on previews.)
- `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY` → **Production-only**.
- `DATABASE_URL` + all Neon `DATABASE_*` vars → **Preview + Production**.

Consequence: on a **preview**, the three prompt-lab engines (ChatGPT/Perplexity/Gemini)
can't run — testing a question returns per-engine "API key required" errors. Previews only
show smart summaries on rows already stored in the DB. To exercise a fresh engine run + new
smart summary, deploy to **production** (`contentdesk-lake.vercel.app`) or add the engine
keys to Preview scope (`vercel env add <KEY> preview`).

### Required runtime files under `data/` (build trap)
The whole `data/` tree is gitignored ("customer content artifacts"), but prompt-lab needs
`data/tinylemon-xyz/visibility/prompts.selected.json` at runtime. A runtime `fs.readFile`
of it **500s in prod (ENOENT)** — gitignored files aren't in the build, and Next doesn't
trace fs reads into the function bundle. Fix pattern: static-`import` the JSON so the
compiler bundles it (see `src/lib/prompt-lab-config.ts`) and force-track it (`git add -f`).
Any new required file under `data/` needs the same treatment.

## GitHub push

- **Only commit/push when the user explicitly asks.** Previewing on Vercel does NOT require
  a commit.
- If on `master`, branch first (e.g. `git switch -c <feature>`); never commit straight to
  the default branch.
- End commit messages with:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- **No `gh` CLI installed.** Push the branch, then give the user the GitHub compare/PR web
  link (`https://github.com/<owner>/<repo>/compare/<branch>?expand=1`) — do not assume `gh`.
- A worktree branch (`worktree-*`) carries the uncommitted feature changes; commit there,
  then push that branch.

### Hitting a protection-gated preview from the CLI
`vercel curl /path --deployment <url> --yes -- --request POST --data '...'` — raw curl args
go **after `--`**. Top-level `-d` means debug, not data.

## Order when asked to "ship everything"
1. Confirm preview vs prod, and whether to push to GitHub.
2. Deploy preview → give the user the URL to eyeball.
3. On their OK: commit (branch-first) → push → open PR (if requested).
4. Production deploy only after explicit go-ahead.
