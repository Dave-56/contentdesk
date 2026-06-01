# ContentDesk

ContentDesk is a Slack-first ContentOps Agent Manager for Shopify apps.

The MVP promise:

> ContentDesk helps lean Shopify app teams publish the right search-visible content on their chosen cadence, with founder approval before publishing handoff.

Product principle:

> Sell a concrete outcome, not "AI content automation." ContentDesk helps founders get found when merchants search Google or ask AI tools what app to use, without paying for a full SEO suite or handing the blog to unchecked autopilot.

Positioning spec:

> See `CONTENTDESK_AEO_POSITIONING_SPEC.md` for the AEO market thesis, prompt coverage model, MVP focus, and long-term operator vision.

Architecture spec:

> See `ARCHITECTURE.md` for the system flow, component responsibilities, Recommendation Card layer, Citation Source Analysis layer, and trust-signal truth layer.

This is not a loose multi-agent chat room. It is a deterministic workflow with agent steps. The founder talks to one front-facing Manager Agent in Slack. Specialist agents run behind the scenes and produce structured artifacts.

## Current Scope

Build the workflow that creates a publish-ready content kit. Do not build GitHub or Codex automation yet.

Manual handoff is intentional for the MVP:

```text
Founder approves publish kit in Slack
-> ContentDesk generates Codex handoff prompt
-> Founder manually sends kit/prompt to Codex
-> Codex publishes in the website repo
```

## MVP Stack

```text
Slack App
+ Trigger.dev
+ Postgres
+ OpenAI/Claude
+ browser/search tool
+ structured specialist agents
```

Optional later:

```text
+ image generation API
+ screenshot/browser automation
+ GitHub/Codex integration
+ AI-search visibility inputs
```

## Core Agent Team

```text
Manager Agent
- user-facing Slack interface
- owns cadence, state, approvals, routing, summaries, final publish-kit QA

Research Strategist
- finds Shopify-specific content opportunities
- produces ranked topic briefs with sources

SEO Writer
- creates outline, article draft, title options, meta description, FAQ, CTA, social snippets

Editor / SEO QA
- checks quality, search intent, Shopify specificity, supported claims, AI slop, usefulness

Visual Producer
- creates a VisualPlan with recommended visuals, placement, purpose, format, alt text, and prompts/instructions
```

## Founder Checkpoints

Keep Slack interactions minimal:

```text
1. Pick topic
2. Review draft / QA issues
3. Approve publish kit
```

Everything else should be summarized by the Manager Agent.

## Important Product Principle

The hard part is not making agents talk. The hard part is defining what "good" means for a specific Shopify app.

Start with a Brand Profile before topic generation. Specificity is the product.

## Local Development

ContentDesk uses Bolt for JavaScript with Socket Mode. Local Slack development does not need ngrok or public request URLs, but some Slack workspaces are not eligible for the Slack CLI's next-generation app flow. If `slack login` says the workspace is not eligible, create the Slack app from the dashboard and run the Bolt process directly.

Install dependencies:

```bash
npm install
```

Create a local environment file:

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
including Codex handoff pages. For local development, use `http://localhost:3000`.

Optional values for live Research Strategist generation:

```text
PARALLEL_API_KEY
AI_GATEWAY_API_KEY
CONTENTDESK_AI_MODEL
```

If these are not set, Research Strategist topic generation will stop and post a clear Slack error instead of inventing fallback topics.

Run the database migration in Postgres:

```bash
npm run db:start
npm run db:create
npm run db:migrate
```

The local MVP database URL is:

```text
postgresql://contentdesk@localhost:55432/contentdesk
```

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

By default, local Slack commands execute the workflow kickoff directly with `CONTENTDESK_WORKFLOW_DRIVER=local`. Set `CONTENTDESK_WORKFLOW_DRIVER=trigger` when you want `/contentdesk` to dispatch through Trigger.dev instead.

The app exposes:

```text
/contentdesk
approve_topic button action
approve_publish_kit button action
```

The Next.js app is still available for future admin/dashboard surfaces:

```bash
npm run dev
```

The current implementation is a Phase 1 skeleton: `/contentdesk` starts a content cycle, Trigger.dev posts fake topic ideas, Slack approvals store approval records, and the final approval posts a fake Codex handoff prompt.

Optional: if your workspace is eligible for Slack CLI apps, `slack run` can use `manifest.json` and `.slack/hooks.json` to create/install/run the app. For non-eligible workspaces, use the dashboard setup above.
