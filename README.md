# ContentDesk

> **New here (human or agent)? Start at [`docs/MAP.md`](docs/MAP.md).** It routes to current
> status, decisions, strategy, architecture, and code. Current operating truth lives in
> [`docs/status/NOW.md`](docs/status/NOW.md).

ContentDesk is a Slack-first SEO/AEO operator for lean Shopify app founders.

It finds buyer prompts where competitors get cited by AI/search and the founder does not,
then turns those gaps into founder-approved, publish-ready content or fix kits.

## Current Focus

ContentDesk has two connected loops:

```text
Visibility loop
-> infer/review buyer strategy
-> select buyer prompts
-> run AI/search visibility scans
-> synthesize citation + recommendation gaps
-> recommend next asset or fix

Production loop
-> founder approves recommendation in Slack
-> ContentDesk creates content kit or fix kit
-> QA gate runs
-> founder approves publish kit
-> Codex handoff stays manual
```

Current dogfood target: **Tiny Lemon**, our own Shopify app. Goal is to prove ContentDesk
lifts Tiny Lemon's AI-search mentions/citations over a 30-60 day window before selling the
loop to anyone else.

Operational truth changes often. Read [`docs/status/NOW.md`](docs/status/NOW.md) before
making product or build decisions.

## What Is Built

- Slack app with `/contentdesk`, profile/setup flows, topic approval, publish-kit approval,
  and visibility recommendation cards.
- Durable content-production workflow: research, write, visual plan, editor QA, visual QA,
  PublishKit, and Codex handoff page.
- Website-first visibility workflow: infer strategy from a URL, review strategy, generate
  buyer prompts, run prompt scans, synthesize provider results, and recommend next work.
- Provider-based prompt execution for Perplexity, OpenAI, Anthropic, and Gemini. Current
  experiments should still follow [`docs/status/NOW.md`](docs/status/NOW.md).
- Owned-content inventory crawler for matching recommendations against existing site assets.
- Postgres artifact/state storage for content cycles and approvals.

## What Is Not Built

- GitHub/Codex publish automation. Manual handoff is intentional for MVP.
- Dashboard/web UI. Slack is the control surface.
- Pricing/billing.
- Google AI Overviews direct scans.
- Production runners for every recommendation type. Page/guide-like tasks are supported;
  app-store listing fixes, community answers, and manual-inspection paths are still work in
  progress.

## Product Shape

This is not a loose multi-agent chat room. It is a deterministic workflow with agent steps.
The founder talks to one front-facing Manager Agent in Slack. Specialist agents run behind
the scenes and produce structured artifacts.

Core principle:

> Sell a concrete outcome, not "AI content automation." ContentDesk helps founders get found
> when merchants search Google or ask AI tools what app to use, without paying for a full SEO
> suite or handing the blog to unchecked autopilot.

Key specs:

- Positioning: [`docs/strategy/POSITIONING.md`](docs/strategy/POSITIONING.md)
- Architecture: [`docs/product/ARCHITECTURE.md`](docs/product/ARCHITECTURE.md)
- Roadmap/task log: [`docs/status/TASKLIST.md`](docs/status/TASKLIST.md)
- Tiny Lemon dogfood: [`docs/dogfood/README.md`](docs/dogfood/README.md)

## Local Setup

Install dependencies:

```bash
npm install
```

Create local env:

```bash
cp .env.example .env.local
```

Required local values:

```text
DATABASE_URL
SLACK_BOT_TOKEN
SLACK_APP_TOKEN
CONTENTDESK_APP_URL
TRIGGER_SECRET_KEY
TRIGGER_PROJECT_REF
```

`CONTENTDESK_APP_URL` is used for Slack links back into the local ContentDesk app,
including Codex handoff pages. For local development, use:

```text
http://localhost:3000
```

Optional values for live AI/search work:

```text
AI_GATEWAY_API_KEY
CONTENTDESK_AI_MODEL
PERPLEXITY_API_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
```

Older research flows may also use:

```text
PARALLEL_API_KEY
```

Start Postgres and run migrations:

```bash
npm run db:start
npm run db:create
npm run db:migrate
```

Local MVP database URL:

```text
postgresql://contentdesk@localhost:55432/contentdesk
```

## Slack Development

ContentDesk uses Bolt for JavaScript with Socket Mode. Local Slack development does not need
ngrok or public request URLs.

Create the Slack app:

1. Go to `https://api.slack.com/apps`.
2. Choose **Create New App**.
3. Choose **From an app manifest**.
4. Select your workspace.
5. Paste the contents of `manifest.json`.
6. Create an app-level token with `connections:write` and save it as `SLACK_APP_TOKEN`.
7. Install the app to the workspace and save the bot token as `SLACK_BOT_TOKEN`.

Start Trigger.dev locally in one terminal:

```bash
npm run trigger:dev
```

Start the Slack app locally in another terminal:

```bash
npm run slack:start
```

Default local workflow driver:

```text
CONTENTDESK_WORKFLOW_DRIVER=local
```

Use Trigger.dev dispatch when needed:

```text
CONTENTDESK_WORKFLOW_DRIVER=trigger
```

Slack routing flag:

```text
CONTENTDESK_SLACK_DEFAULT=topics      # old topic-picker flow
CONTENTDESK_SLACK_DEFAULT=visibility  # latest visibility recommendation card
```

## Visibility Commands

Infer a website strategy draft:

```bash
npm run prompt:infer -- --url https://example.com
```

Review the generated `data/<slug>/visibility/strategy.json`, then select prompts:

```bash
npm run prompt:select -- data/<slug>/visibility/strategy.json --out data/<slug>/visibility
```

Profile owned content:

```bash
npm run visibility:profile -- --url https://example.com --out data/<slug>/visibility
```

Run the multi-provider visibility job:

```bash
npm run visibility:run -- --recommend
```

Common Tiny Lemon shortcuts:

```bash
npm run prompt:scan:selected
npm run visibility:synthesize
npm run visibility:recommend
```

Data lands under:

```text
data/<slug>/visibility/
data/tiny-lemon/visibility/
```

## Verification

Run core checks:

```bash
npm run typecheck
npm test
```

Use targeted tests while working in one area:

```bash
npm test -- src/lib/visibility/site-inventory.test.ts
```
