---
title: ContentDesk MVP Spec
updated: 2026-05-27
type: stable
status: current
---

# ContentDesk MVP Spec

## Product

ContentDesk is a Slack-first content operating system that turns a Shopify app's positioning into founder-approved, publish-ready article kits on the founder's chosen cadence.

## Core Promise

The system helps lean Shopify app teams publish the right search-visible content without coordinating freelancers, SEO tools, docs, calendars, and publishing handoffs.

## Product Principle

Sell a concrete outcome, not "AI content automation."

For Tiny Lemon and similar Shopify apps, the outcome is:

```text
Get found when merchants search Google or ask AI tools what app to use for their problem.
```

ContentDesk should stay anchored on helping lean founders get the right content published without paying for a full SEO suite or handing the blog to unchecked autopilot.

AI-search visibility work should be organized around the buyer journey, not just around keywords or blog volume. ContentDesk should help founders map prompts and content opportunities across:

```text
Awareness -> Consideration -> Evaluation -> Decision
```

Each recommended topic should make clear which buyer-journey phase it serves:

- Awareness: buyers are naming the problem, pain, workflow, or category.
- Consideration: buyers are looking for tools, apps, workflows, or solution types.
- Evaluation: buyers are comparing vendors, alternatives, features, proof, and tradeoffs.
- Decision: buyers are checking pricing, implementation, fit, trust, reviews, and next steps.

Guiding principle:

```text
Prompts are buyer questions. ContentDesk should generate and prioritize content by asking:
"What would this ICP ask an answer engine at this phase of the journey, and what asset would make the brand findable, understandable, trustworthy, and citeable?"
```

Positioning shorthand:

```text
ContentDesk is the affordable content agent for lean founders who need search visibility but cannot justify $99/month SEO autopilot tools.
```

## Target User

Shopify app founders and small teams that need consistent content but do not want to coordinate freelancers, SEO tools, docs, calendars, and publishing handoffs.

## MVP Non-Goals

- Do not automate GitHub publishing.
- Do not build a full CMS.
- Do not build a generic AI marketing team for every business type.
- Do not run a 24/7 always-on agent process for the MVP.
- Do not build continuous market or competitor monitoring in the MVP.
- Do not start with polished AI image generation.
- Do not build AI-search visibility tracking in the MVP.

## Architecture

```text
Slack UI
-> Manager Agent
-> Trigger.dev Workflow
-> Specialist Agent Steps
-> AI SDK model/tool calls
-> Parallel Search/Extract for research grounding
-> Postgres Artifact Store
-> Approval Gates
-> Publish Kit
-> Manual Codex Handoff
```

## Agent Runtime and Cadence

The MVP should feel like a persistent marketing manager, but it should be implemented as an event-driven workflow, not as a 24/7 daemon.

The Manager Agent wakes up from:

```text
manual Slack command
Slack approval actions
scheduled Trigger.dev jobs
retry/failure handling
```

State lives in Postgres:

```text
Brand Profile
content cycle status
artifacts
approvals
agent runs
cadence settings
```

Manual `/contentdesk` kickoff is the first implementation path while the system is being scaffolded. The MVP target should add scheduled execution after the core workflow is trustworthy:

```text
manual kickoff: founder runs /contentdesk
scheduled kickoff: Manager starts a weekly cycle for a configured brand cadence
stale-cycle check: Manager nudges pending approvals or reports blockers
```

The Manager Agent owns cadence and routing. Cron only wakes the Manager; it is not itself the Research Strategist or Writer.

Use Vercel AI SDK as the agent/model layer for specialist steps:

```text
Research Strategist -> structured TopicBrief[] with Parallel Search/Extract context
SEO Writer -> structured ArticleDraft and metadata
Visual Producer -> structured VisualPlan
Editor / SEO QA -> structured QAReport
Manager Agent -> summaries, routing, approval gates, publish-kit completeness
```

Use Parallel Web Systems as the first research provider for the Research Strategist:

```text
Parallel Search -> discover relevant Shopify, competitor, and merchant-pain sources
Parallel Extract -> turn selected URLs into clean context
AI SDK -> reason over the sourced context and produce validated TopicBrief[]
```

Keep the code behind a small research-provider interface so Exa or Perplexity can be evaluated later without rewriting the Research Strategist. Exa Search/Contents is a plausible fallback for semantic source discovery and page contents. Perplexity is a plausible synthesis/sanity-check provider, but should not be the first source-of-truth for `TopicBrief.sourceLinks`.

For MVP fallback planning, prefer Exa Search/Contents over Exa Websets. Websets are better suited to async/deeper research or later monitoring flows. Perplexity can be evaluated later for synthesis or second-opinion checks, but TopicBrief source links must come from normalized source records returned by the research provider, not from model-generated URLs.

Continuous market monitoring is a post-MVP capability. If needed later, it should be introduced as a separate Market Monitor or as a Manager-owned scheduled research pass that feeds opportunities into the Research Strategist.

## Ahrefs Evidence Layer

ContentDesk should integrate Ahrefs as a pluggable evidence layer for topic strategy, not as a replacement for the Research Strategist. The Research Strategist should still create the strategic portfolio; Ahrefs should help explain which opportunities have search demand, what Google currently rewards, how competitive the SERP looks, and where competitor or AI-search opportunities exist.

Because early sites may not have enough Google Search Console data yet, Ahrefs should come first for opportunity discovery. Google Search Console becomes more valuable after published ContentDesk articles start earning impressions and clicks.

Phased scope:

```text
P0: Topic evidence for approval
- SERP shape: inspect top results for target queries and summarize page type, intent, ranking pattern, weak spots, and recommended article format.
- Search demand: use keyword metrics and related queries to label opportunity demand as low, medium, or high.
- Light difficulty: use keyword difficulty and SERP strength as a warning label, not as an absolute decision rule.
- Slack evidence summary: show founder-readable evidence such as "clear buyer intent", "specific long-tail opportunity", or "competitive SERP; narrow the angle."

P1: Competitor content gaps
- Use competitor domains and adjacent tool domains from the Brand Profile to find top pages, organic keywords, comparison terms, alternatives terms, and bottom-funnel gaps.
- Strengthen the comparison strategy lane with honest alternatives, versus, best-tools, switching, and evaluation-guide opportunities.
- Store evidence separately from normalized article sources so keyword metrics and competitor signals do not pollute sourceLinks.

P2: AI search visibility
- Evaluate Ahrefs Brand Radar / AI Visibility data for cited pages, cited domains, prompts, mentions, impressions, and share-of-voice.
- Identify pages, entities, answer formats, and citation patterns that could make ContentDesk articles more likely to be retrieved or cited by AI answer engines.
- Keep this behind the research architecture until P0/P1 prove that evidence summaries improve founder topic approval decisions.
```

The first integration should answer one Slack-level question:

```text
Of these 3 topic options, which one has the strongest evidence behind it and why?
```

## Post-MVP Research Strategy Architecture

The MVP Research Strategist should stay focused on producing 3 founder-approvable TopicBriefs. Longer term, ContentDesk should evolve into a lead strategist that coordinates specialist research capabilities instead of treating SEO strategy as one generic prompt.

Potential specialist research capabilities:

```text
Lead SEO Strategist
-> Keyword / Topic Researcher
-> SERP Analyst
-> Competitor / Comparison Researcher
-> Customer-Language Researcher
-> AI Visibility Researcher
```

Responsibilities:

- Keyword / Topic Researcher: discovers demand, keyword clusters, related queries, and topic gaps.
- SERP Analyst: inspects what Google is rewarding for target queries, including page type, intent, source quality, and ranking patterns.
- Competitor / Comparison Researcher: finds alternatives, versus, best-tools, switching, and bottom-of-funnel opportunities.
- Customer-Language Researcher: mines reviews, forums, Reddit, support notes, sales calls, and community language for real customer phrasing and objections.
- AI Visibility Researcher: identifies pages, entities, and answer formats likely to improve citation and retrieval in AI search and answer engines.

The Lead SEO Strategist should own prioritization and final recommendations so specialist outputs do not become disconnected tactics. These specialists may begin as internal modules or prompt modes and become separate agents only when they need distinct tools, prompts, data sources, or evaluation criteria.

## First-Class Brand Profile

Before topic generation, collect and store a Brand Profile:

```text
app name
target merchant
positioning
features/use cases
competitors
preferred voice
forbidden claims
CTA style
existing blog/docs URLs
```

The Brand Profile should be editable and reused across weekly content cycles.

## Data Model

Start simple:

```text
organizations
brands
content_cycles
artifacts
approvals
agent_runs
sources
```

Normalize research results before topic generation:

```text
ResearchSource
- provider
- query
- url
- title
- published_at
- excerpt
- extracted_markdown
- fetched_at
```

`TopicBrief.sourceLinks` should only reference URLs present in normalized `ResearchSource` records. This keeps citations auditable and prevents the model from inventing source links.

Use `artifacts` for typed outputs:

```text
BrandProfile
TopicBrief[]
ArticleDraft
QAReport
VisualPlan
PublishKit
```

Each artifact should include:

```text
id
organization_id
brand_id
content_cycle_id
type
status
version
json_payload
created_by_agent
created_at
updated_at
```

## Workflow

```text
Manual Slack command or weekly scheduled trigger
-> Manager starts content cycle in Slack
-> Manager confirms Brand Profile exists
-> Strategist proposes 3 ranked ideas
-> Founder approves 1 topic
-> Writer creates article draft and metadata
-> Visual Producer creates VisualPlan
-> Editor reviews draft and VisualPlan
-> Writer/Visual Producer revise once if needed
-> Manager builds final publish kit
-> Founder approves publish kit
-> Manager outputs Codex handoff prompt
```

## Slack UX

The founder should mostly interact with one Slack app/agent:

```text
@ContentDesk
```

Founder-visible checkpoints:

```text
1. Pick topic
2. Review draft / QA issues
3. Approve publish kit
```

Manager messages should be concise and action-oriented. Specialist chatter should not appear unless useful.

## Agent Job Specs

### Manager Agent

Owns:

- Slack conversation
- cadence and scheduled wakeups
- workflow state
- stale approval and blocker checks
- approval gates
- handoffs between specialist agents
- final publish-kit completeness
- blocker summaries

Forbidden:

- writing full article drafts directly
- silently skipping approval gates
- inventing brand facts not in Brand Profile or sources

### Research Strategist

Runs on demand during a content cycle. It does not continuously monitor the market in the MVP.

Inputs:

- Brand Profile
- existing blog/docs URLs
- target merchant
- competitor list
- Parallel Search results
- Parallel Extract source context

Outputs:

```text
3 ranked TopicBriefs
```

The default Research Strategist should produce strategic topic coverage, not a user-facing research mode switch:

```text
education -> pain/category understanding
workflow -> practical Shopify operating process
comparison -> buyer-intent alternatives, best-tools, switching, versus, or evaluation guide
```

Each TopicBrief should include:

```text
topic
working title
strategy type
funnel stage
merchant job
intent type
message angle
proof angle
available strategy evidence
why this strategy
target merchant pain
Shopify-specific angle
why now
search intent
content gap
suggested CTA angle
source links
score
```

Forbidden:

- drafting the full article
- proposing generic ecommerce topics without Shopify/app relevance

### SEO Writer

Inputs:

- approved TopicBrief
- Brand Profile
- sources
- existing content context

Outputs:

```text
ArticleDraft
title options
meta description
FAQ block
CTA
internal link suggestions
LinkedIn/social snippets
```

Forbidden:

- unsupported claims
- generic SEO filler
- burying the direct answer under a generic introduction
- making the app sound like an ad

### Editor / SEO QA

Inputs:

- ArticleDraft
- VisualPlan
- Brand Profile
- sources

Outputs:

```text
QAReport
pass/fail status
structured issues
revision instructions
blockers only
```

Rubric:

```text
Is this Shopify-specific?
Does it target a real merchant pain?
Is the advice actionable?
Are claims supported?
Does it avoid generic SEO filler?
Does it resolve the reader's decision, doubt, comparison, workflow, or next step instead of merely covering the keyword?
Does it naturally position the app without sounding like an ad?
Would a founder proudly publish this?
```

### Visual Producer

Inputs:

- approved topic
- ArticleDraft
- Brand Profile

Outputs:

```text
VisualPlan
```

VisualPlan fields:

```text
recommended visuals
purpose of each visual
placement in article
suggested format
alt text
generation prompt or screenshot instruction
```

Prioritize:

```text
workflow diagrams
product screenshots
annotated examples
comparison tables
checklists
template snippets
```

Avoid:

```text
generic AI stock images
decorative images that do not explain the article
```

## Publish Kit

The final Publish Kit should include:

```text
approved brief
final Markdown draft
title options
meta description
FAQ block
CTA
internal link suggestions
VisualPlan
image prompts/instructions
Editor QA summary
LinkedIn/social drafts
source links
pre-publish blockers only
Codex handoff prompt
```

## Codex Handoff

MVP should output a clean handoff prompt, not call GitHub or Codex directly.

Example:

```text
Use the Tiny Lemon repo/workspace. Publish the approved article as one plain Markdown guide in content/blog using Tiny Lemon frontmatter. Copy provided image assets into public/blog/<slug>/, rewrite Markdown image URLs to /blog/<slug>/<file>, preserve metadata, FAQ, CTA, internal links, and source links, and do not publish ContentDesk QA notes or editor instructions. Do not create MDX, custom routes, or a new content system.
```

## Visual Automation Stages

```text
Stage 1: visual plan + prompts
Stage 2: diagrams/tables/checklists in Markdown
Stage 3: screenshots from product/demo data
Stage 4: AI-generated assets
Stage 5: brand-consistent reusable visual system
```

MVP should complete Stage 1.
