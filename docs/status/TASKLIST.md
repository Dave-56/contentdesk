---
title: ContentDesk MVP Tasklist
updated: 2026-06-04
type: living
status: current
---

# ContentDesk MVP Tasklist

This file is **only** the build log: checkboxes grouped by phase. `[x]` = done, `[ ]` = left.
It answers one question — *what is built and what's left?* Nothing else lives here:
- Current focus / stage / blockers → [`NOW.md`](NOW.md)
- Why we chose things → [`../decisions/`](../decisions/)
- How it works → [`../product/ARCHITECTURE.md`](../product/ARCHITECTURE.md)

Don't add background, strategy, or rationale below. If a line isn't a checkbox, it belongs in
one of the files above.

## Phase 0: Product Shape

- [x] Confirm name: ContentDesk or alternative.
- [x] Confirm first ICP: Shopify app founders.
- [x] Confirm MVP output: publish kit only, no GitHub automation.
- [x] Confirm first manual publishing target: Codex handoff.
- [x] Confirm product principle: sell the concrete outcome of search/AI visibility for lean founders, not generic "AI content automation."
- [x] Confirm buyer-journey principle: prompts are buyer questions and content opportunities should map to Awareness, Consideration, Evaluation, and Decision.
- [x] Add shared end-of-session checklist and agent invocation through `AGENTS.md`.

## Phase 1: Workflow Skeleton

- [x] Create Slack app.
- [x] Add `/contentdesk` command or `@ContentDesk` mention handler.
- [x] Add Slack interactive buttons for approvals.
- [x] Create Trigger.dev project.
- [x] Create `content_cycle` workflow.
- [x] Add Postgres connection.
- [x] Store content cycle state.
- [x] Store artifacts as typed JSON records.
- [x] Post manager status updates back to Slack thread.

Acceptance:

- [x] User can start a content cycle from Slack.
- [x] System creates a content cycle in Postgres.
- [x] System posts fake topic ideas.
- [x] User can approve a fake topic.
- [x] System posts fake publish kit.
- [x] User can approve final publish kit.

## Phase 2: Brand Profile MVP

- [x] Create Brand Profile schema.
- [x] Add Slack onboarding flow to collect profile fields.
- [x] Store Brand Profile as an artifact or brand record.
- [x] Add command to view current Brand Profile.
- [x] Add command/button to edit Brand Profile.

Brand Profile fields:

- [x] app name
- [x] target merchant
- [x] positioning
- [x] features/use cases
- [x] competitors
- [x] preferred voice
- [x] forbidden claims
- [x] CTA style
- [x] existing blog/docs URLs

Acceptance:

- [x] A content cycle cannot generate topics until a Brand Profile exists.
- [x] Fake topic ideas reference Brand Profile details.

## Phase 3: Research Strategist

- [x] Define TopicBrief JSON schema.
- [x] Install/configure AI SDK and model provider env.
- [x] Add AI SDK structured generation for TopicBriefs.
- [x] Add research provider interface.
- [x] Add Parallel Web Systems Search provider.
- [x] Add Parallel Extract for selected source URLs.
- [x] Normalize Parallel results into ResearchSource records.
- [x] Fetch and summarize relevant sources from normalized records.
- [x] Generate 3 ranked TopicBriefs.
- [x] Constrain TopicBrief source links to normalized source URLs.
- [x] Store source links and source metadata.
- [x] Post concise topic picker in Slack.
- [x] Add strategic topic coverage fields to TopicBrief: strategy type, funnel stage, and strategy rationale.
- [x] Add intent-matched strategy fields to TopicBrief: merchant job, intent type, message angle, proof angle, and available strategy evidence.
- [x] Add buyer-intent / comparison research objective using competitors when available and category/use-case patterns when not.
- [x] Prompt the Research Strategist to return education, workflow, and comparison topic coverage where credible.
- [x] Show compact strategy labels in Slack topic picker and rationale in topic preview.

Acceptance:

- [x] Each topic includes merchant pain, Shopify angle, content gap, source links, and score.
- [x] Topic options expose their strategic lane without adding a new founder-facing research mode.
- [x] User can approve 1 topic.

## Future Phase: Research Strategy Specialists

- [ ] Add Ahrefs as the first SEO evidence provider for topic opportunity discovery, especially before Google Search Console has meaningful site traffic data.
- [ ] Add a Lead SEO Strategist architecture that coordinates specialist research capabilities.
- [ ] Add Keyword / Topic Researcher capability for demand, clusters, related queries, and topic gaps.
- [ ] Add SERP Analyst capability for page type, intent, ranking pattern, and source-quality inspection.
- [ ] Add Competitor / Comparison Researcher capability for alternatives, versus, best-tools, switching, and bottom-of-funnel opportunities.
- [ ] Add Customer-Language Researcher capability for reviews, forums, Reddit, support notes, sales-call language, and customer objections.
- [ ] Add AI Visibility Researcher capability for AI-search citation opportunities, entity coverage, answer formats, and retrieval-friendly content gaps.
- [ ] Add buyer-journey prompt mapping so AI visibility research separates Awareness, Consideration, Evaluation, and Decision opportunities.
- [ ] Use the Tiny Lemon HubSpot AEO backlog in `AEO_RECOMMENDATIONS.md` as the reference example for turning recommendations into video scripts, owned content briefs, outreach packets, and community replies.
- [ ] Decide when each capability should remain a module/prompt mode versus becoming a separate specialist agent.

## Phase: Shopify App Visibility Recommendations

- [x] Add `visibility:recommend` to turn latest scan + strategy inventory into one execution task.
- [x] Write `data/tiny-lemon/visibility/recommendations.json` from `strategy.json` and latest run file.
- [x] Recheck recommended asset against the exact prompt ids after publish.
- [x] Use `site-profile.json` to distinguish target-specific missing assets from existing related assets.
- [x] Refactor visibility scan schemas from Tiny Lemon-specific fields to brand-neutral fields.
- [x] Add `visibility:profile` to retrieve raw owned-site inventory without classification.
- [x] Add provider interface while keeping Perplexity behavior unchanged.
- [x] Add OpenAI prompt runner.
- [x] Add Claude prompt runner.
- [x] Add cross-provider synthesis grouped by prompt id.
- [x] Update recommender to read synthesis plus owned inventory.
- [x] Add `visibility:run` to orchestrate Perplexity, OpenAI, Anthropic, synthesis, and optional recommendation.
- [x] Make `visibility:run` fail-soft per provider and record partial synthesis provider errors.
- [x] Add answer-level recommendation signals to prompt scan records and summaries.
- [x] Add recommendation-aware cross-provider synthesis states and gap types.
- [x] Add `promptGaps` to visibility recommendation outputs.
- [x] Add Slack visibility recommendation card behind `CONTENTDESK_SLACK_DEFAULT`.
- [x] Add stale-click, duplicate-click, and unsupported-task guards for Slack visibility recommendation approval.
- [x] Convert approved page/guide visibility recommendations into evidence-preserving TopicBriefs for the existing production runner.
- [x] Add AI Gateway buyer-language classification to `prompt:infer`.
- [x] Make `prompt:select` require reviewed `buyerLanguage` before generating prompts.
- [x] Add brand-neutral prompt builders that assemble from `buyerLanguage` instead of raw strategy clauses.
- [x] Add `scripts/prompt-workflow.sh` for infer-review-select commands.
- [ ] Add request timeout per provider prompt call.
- [ ] Add bounded prompt concurrency for `visibility:run`.
- [ ] Add skip-existing provider files by default plus `--force` rerun control.
- [ ] Tighten `prompt:infer` competitor filtering for broad SaaS categories.
- [ ] Add buyerLanguage quality checks for too-generic product/comparison nouns.
- [ ] Add clearer prompt-infer failure output when AI classification fails.
- [x] Store exact blog/article URLs from sitemap or blog index in `owned-content-inventory.json`.
- [x] Use owned-site content inventory before recommending new owned assets.
- [x] Add owned-content inventory crawler for arbitrary lead domains: homepage, blog, guides, docs, comparisons, integrations, case studies, pricing, and FAQ.
- [x] Add `visibility:profile` crawl bounds and progress logs for larger lead-domain crawls.
- [x] Add owned-content understanding layer with summary, topic, role, audience, and key claims.
- [ ] Store owned-content page fields: URL, title, H1, meta description, summary, page type, topic, inferred buyer question, freshness, and matched prompts.
- [ ] Strip repeated nav/footer boilerplate from owned-content excerpts before excerpt matching.
- [ ] Add concurrency/timeout controls for full-site owned-content understanding runs.
- [ ] Add buyer-question discovery from Google SERP, autocomplete/PAA, competitor titles, forums/reviews, AI answers, and Search Console when available.
- [ ] Score buyer-question evidence by demand signal, pain signal, competitive signal, product fit, content gap, and AEO gap.
- [ ] Add cited-source analysis that records which pages/models cited, which competitors were named, and why the source won.
- [ ] Separate retrieved, cited, and brand-mentioned states in visibility outputs and recommendations.
- [ ] Add recommendation gap classifier: missing page, weak existing page, off-site citation gap, comparison gap, proof/case-study gap, and prompt-set gap.
- [ ] Add off-site inclusion recommendations for third-party listicles, reviews, directories, app stores, and partner/resource pages.
- [ ] Add "Best X for Y" listicle opportunity detection for buyer-intent prompt sets and recommendations.
- [ ] Add YouTube/video asset audit and recommendation path for demo/explainer videos when video presence is likely to help AI visibility.
- [ ] De-prioritize schema/meta-tag-only AEO recommendations unless tied to a concrete crawl/indexing issue.
- [ ] Track repeated scan trends and semantic answer stability so citation churn does not trigger noisy recommendations.
- [ ] Generate page-level work orders: exact page to create/update, H2s to add, examples/proof to include, competitor comparisons to cover, and prompts to re-run.
- [ ] Add `shopify_app_store_listing` fix-kit production runner for Slack visibility approvals.
- [ ] Add `community_answer` and `manual_inspection` production paths for Slack visibility approvals.
- [ ] Mark provider runs invalid/partial when prompt-level API failures dominate, especially Anthropic low-credit errors.
- [ ] V2: Add Shopify app entity profile before strategy generation.
- [ ] V2: Add Shopify asset audit for homepage, App Store listing, docs, blog, alternatives pages, demos, reviews, and community mentions.
- [ ] V2: Feed asset audit into `strategy.json` instead of using guessed `assetInventory`.

### P0: Ahrefs Topic Evidence

- [ ] Add Ahrefs API env/config and a small provider wrapper with unit-aware request limits.
- [ ] Add a `TopicEvidence[]` artifact or equivalent storage separate from `ResearchSource[]`.
- [ ] Enrich each generated TopicBrief with SERP shape: page types, intent pattern, ranking pattern, weak spots, and recommended article format.
- [ ] Enrich each generated TopicBrief with search demand from keyword metrics and related queries.
- [ ] Add light ranking difficulty as a warning label, not a hard topic selector.
- [ ] Show compact founder-readable evidence in Slack topic previews: demand, SERP shape, difficulty warning, and "why this topic has evidence."
- [ ] Keep raw Ahrefs tables out of Slack; summarize as approval-decision evidence.

### P1: Ahrefs Competitor Content Gaps

- [ ] Use Brand Profile competitors and adjacent tool domains to inspect top pages and organic keywords.
- [ ] Identify comparison, alternatives, best-tools, switching, and evaluation-guide opportunities.
- [ ] Use competitor signals to strengthen the bottom-funnel comparison strategy lane.
- [ ] Add safeguards so competitor research remains honest and useful instead of becoming thin attack/comparison content.

### P2: Ahrefs AI Search Visibility

- [ ] Evaluate Ahrefs Brand Radar / AI Visibility endpoints for cited pages, cited domains, prompts, mentions, impressions, and share-of-voice.
- [ ] Identify citation-friendly page patterns, entity gaps, answer formats, and retrieval-friendly content opportunities.
- [ ] Decide how AI visibility evidence should influence TopicBrief strategy without overwhelming the Slack approval flow.
- [ ] Revisit Google Search Console integration after published articles have enough impressions/clicks to provide useful first-party performance data.

Acceptance:

- [ ] Research output explains which specialist lenses informed the recommended strategy.
- [ ] Ahrefs evidence helps founders answer: "Which topic has the strongest evidence behind it and why?"
- [ ] The Lead SEO Strategist still owns prioritization, portfolio balance, and final topic recommendations.
- [ ] Specialist outputs improve strategy quality without adding founder-facing complexity to the Slack workflow.

## Phase 4: SEO Writer

- [x] Define ArticleDraft JSON schema.
- [x] Generate outline from approved TopicBrief.
- [x] Generate Markdown article draft.
- [x] Require an answer-first opening paragraph after the H1 before background context.
- [x] Generate title options.
- [x] Generate meta description.
- [x] Generate FAQ block.
- [x] Generate CTA.
- [x] Generate internal link suggestions.
- [x] Generate LinkedIn/social snippets.

Acceptance:

- [x] Draft is Shopify-specific and uses Brand Profile.
- [x] Draft includes metadata and social derivatives.
- [x] Draft is stored as an artifact.

## Phase 5A: VisualPlan MVP

- [x] Define first-class `visualPlanItemSchema` and `visualPlanSchema` exports.
- [x] Include stable visual labels/titles and Markdown placeholder text.
- [x] Implement Visual Producer agent with AI SDK structured output.
- [x] Add deterministic fallback VisualPlan generation.
- [x] Identify 1-3 useful visuals for the article.
- [x] Recommend placement by section heading.
- [x] Write purpose for each visual.
- [x] Write alt text.
- [x] Write generation prompt or screenshot instruction.
- [x] Insert visual placeholders into Markdown.
- [x] Store VisualPlan as an artifact.
- [x] Include VisualPlan in PublishKit.
- [x] Include visual instructions in Codex handoff prompt.
- [x] Add compact VisualPlan summary to Slack publish-kit preview.

Acceptance:

- [x] Visuals are useful and specific, not decorative.
- [x] Article includes visual placeholders.
- [x] VisualPlan is included in final publish kit.
- [x] Codex handoff includes placement, purpose, alt text, and generation/screenshot instructions.
- [x] Phase 5 does not require generated image assets.

Implementation notes:

- [x] Keep Phase 5 focused on visual editorial intelligence: what visual should exist, where it belongs, why it helps, and how it should be made.
- [x] Do not add `@google/genai`, `GEMINI_API_KEY`, image asset storage, or public image hosting in Phase 5A.
- [x] If no matching Markdown heading is found for a placement, append a compact visual notes block near the end instead of forcing an unsafe insertion.

## Phase 5B: Product Screenshot Asset Workflow

- [ ] Decide whether screenshots are created by Codex during publishing or by ContentDesk before handoff.
- [ ] Define screenshot asset metadata fields on VisualPlan items or a related asset artifact.
- [ ] Add screenshot instructions for product/admin visuals that are more useful than generated illustrations.
- [ ] Decide local/static/public path strategy for screenshot assets.
- [ ] Add manual asset attachment path for founders or Codex-created screenshots.
- [ ] Update Codex handoff to distinguish screenshot tasks from generated-image tasks.

Acceptance:

- [ ] Screenshot-heavy visuals have clear ownership: Codex/manual publishing step or ContentDesk automation.
- [ ] VisualPlan can describe real product screenshots without requiring AI image generation.
- [ ] PublishKit handoff tells the publisher exactly which screenshots to capture or attach.

## Phase 5C: Nano Banana Generated Assets

- [x] Add AI SDK image-generation integration through AI Gateway.
- [ ] Add direct `@google/genai` / `GEMINI_API_KEY` support if ContentDesk needs to bypass AI Gateway.
- [x] Add `CONTENTDESK_IMAGE_MODEL` configuration.
- [x] Default image model to Nano Banana only after confirming current Google model naming.
- [x] Generate image assets from approved VisualPlan generation prompts.
- [x] Store generated image metadata, provider, prompt, and model used.
- [x] Decide local generated asset storage/public path strategy.
- [x] Decide production generated asset storage/public path strategy: use Vercel Blob for public generated image URLs.
- [x] Define `VisualAsset[]` metadata with source VisualPlan placeholder, status, asset URL/path, alt text, caption, provider, model, prompt, and error details.
- [x] Include generated asset paths or URLs in PublishKit.
- [x] Insert generated image Markdown into the article at the matching VisualPlan placement when an asset exists.
- [x] Preserve visual instruction blocks for visuals that are skipped, screenshot-only, manual, or failed.
- [x] Add failure behavior that preserves the VisualPlan if image generation fails.

Acceptance:

- [x] Generated assets are optional and do not block publish-kit creation.
- [x] Nano Banana is used only for visuals that benefit from generated imagery, not product screenshots.
- [x] PublishKit includes usable image paths/URLs when generation succeeds.
- [x] PublishKit Markdown is compiled with generated images already placed under the correct article headings when possible.

## Phase 6: Editor / SEO QA

- [x] Define `QAReport` JSON schema with structured issue and fixed rubric score types.
- [x] Add `usedFallback` to `QAReport` instead of multiplying artifact statuses.
- [x] Derive or enforce publish approval consistency from `status` and blocker count.
- [x] Implement deterministic QA fallback before AI QA.
- [x] Implement AI Editor / SEO QA agent with structured output.
- [x] Check `ArticleDraft` and `VisualPlan` together before PublishKit creation.
- [x] Store a `QAReport` artifact after VisualPlan generation.
- [x] Gate PublishKit creation on final QA pass.
- [x] Prevent Slack publish-kit approval modal when final QA still has blockers.
- [x] Change topic approval status progression so the cycle is not marked `awaiting_publish_kit_approval` until a QA-passed PublishKit exists.
- [x] Add revision-aware inputs to SEO Writer: `revisionInstructions`, `previousDraft`, and `qaReport`.
- [x] Add revision-aware inputs to Visual Producer for visual blockers only.
- [x] Allow exactly one targeted revision pass.
- [x] Re-run QA after the revision pass.
- [x] Make the single revision pass stricter by giving the Writer source notes, full QA blockers, and an explicit blocker-resolution checklist.
- [x] Convert QA blockers into structured `RevisionTask[]` checklist items before the single revision pass.
- [x] Store `RevisionTaskResult[]` evidence from the Writer so missed fixes are debuggable.
- [x] Persist SEO Writer fallback errors to `agent_runs` with phase, error message, stack, validation issues, and output preview when available.
- [x] Stop the revision flow immediately if the Writer revision falls back, instead of running QA against an unchanged fallback draft.
- [x] Split QA behavior into initial full-review mode and post-revision verification mode so the second QA checks original blockers instead of reopening a fresh review.
- [x] If blockers remain after revision, post blocker summary and do not create a PublishKit artifact.
- [x] Add QA summary and blockers to PublishKit.
- [x] Include QA summary, blockers, and non-blocking notes in Codex handoff prompt.
- [x] Show QA summary in Slack publish-kit review modal.

QA rubric:

- [x] `shopifySpecificity`
- [x] `merchantPain`
- [x] `actionability`
- [x] `claimSupport`
- [x] `genericFillerAvoidance`
- [x] `thinkingGapResolution`
- [x] `appPositioning`
- [x] `founderPublishConfidence`
- [x] `visualUsefulness`

Structured QA issue fields:

- [x] `area`: `article`, `visual_plan`, `sources`, `metadata`, or `brand_positioning`
- [x] `severity`: `blocker` or `nice_to_have`
- [x] `finding`
- [x] `evidence`
- [x] `instruction`

Deterministic QA checks:

- [x] Source URLs in draft exist in normalized research sources.
- [x] Internal links exist only in Brand Profile `existingBlogDocsUrls`.
- [x] Forbidden claims from Brand Profile do not appear in draft or metadata.
- [x] Markdown has exactly one H1 and useful H2 sections.
- [x] First body paragraph answers the topic directly instead of using generic scene-setting.
- [x] Draft includes enough Shopify-specific concepts to pass a basic specificity check.
- [x] CTA and app positioning are present without overstuffing.
- [x] Visual placements match actual H2 headings or are intentionally handled as unplaced visual notes.
- [x] Visual placeholders are unique and valid.
- [x] Fallback drafts receive at least a nice-to-have and may receive a blocker if too skeletal.

Acceptance:

- [x] QAReport clearly says pass or needs revision.
- [x] Blockers are separated from nice-to-haves as structured issues.
- [x] Revision instructions are actionable and grouped enough for Writer vs Visual Producer routing.
- [x] PublishKit is created only after QA passes.
- [x] Blocked kits never show founder approval controls.
- [x] One stronger revision pass is attempted for blockers, then the workflow stops with a clear blocker summary if still blocked.

## Phase 7: Publish Kit MVP

- [x] Define PublishKit JSON schema.
- [x] Package approved brief.
- [x] Package final Markdown.
- [x] Include metadata.
- [x] Include FAQ.
- [x] Include CTA.
- [x] Include internal link suggestions.
- [x] Include VisualPlan.
- [x] Include generated VisualAsset references when image generation is enabled.
- [x] Include QA summary.
- [x] Include social drafts.
- [x] Include sources.
- [x] Include blockers only.
- [x] Generate Codex handoff prompt.
- [x] Post final approval checkpoint in Slack.

Acceptance:

- [x] Founder can approve final Publish Kit.
- [x] Publish Kit is complete enough to manually paste into Codex.
- [x] No GitHub integration is required.

Implementation notes:

- [x] Keep the Slack approval modal focused on article review only: title/meta, Markdown draft, FAQ, and sources.
- [x] Preserve agent-facing fields in the PublishKit artifact even when they are hidden from Slack review.
- [x] CTA lives at `PublishKit.cta` and should be used by publishing/editor agents when placing the final product CTA.
- [x] Internal links live at `PublishKit.internalLinkSuggestions` and should be used by publishing/editor agents to add approved site links.
- [x] Social drafts live at `PublishKit.socialDrafts` and should be used by future distribution agents, not the article approval modal.
- [x] Visual plan lives at `PublishKit.visualPlan` and should be populated by the Phase 5A Visual Producer before final handoff.
- [x] Generated image assets are reviewed by Visual Asset QA after Blob upload and before PublishKit creation; rejected images are marked failed instead of being handed to Tiny Lemon as publish-ready.
- [x] Publishing-agent handoffs should be lean Tiny Lemon Markdown publishing packets: final title/excerpt/slug, final Markdown, Blob image URLs to copy, alt text, clean captions, CTA, FAQ, internal links, and sources.
- [x] When generated assets are present, Codex handoff should tell the publisher to copy them into `public/blog/<slug>/` and rewrite Markdown image URLs to `/blog/<slug>/<file>`.
- [x] Codex handoff is exposed at `/handoff/[artifactId]`; Slack should link there instead of rendering long prompts inside Slack modals.

## Phase 8: Polish and Reliability

- [ ] Add agent run logs.
- [ ] Add retry behavior for failed agent steps.
- [ ] Add artifact versioning.
- [ ] Add Markdown structure and formatting QA for publish-ready drafts: enforce scannable sections, proper bullet and numbered lists where useful, valid Markdown syntax, and no wall-of-text article output.
- [ ] Add weekly scheduled Manager kickoff.
- [ ] Add stale approval/blocker check.
- [ ] Store basic brand cadence setting.
- [ ] Add Slack error messages that are understandable.
- [ ] Add basic admin commands.
- [ ] Add seed/demo Brand Profile.
- [ ] Add tests for workflow state transitions.
- [ ] Add tests for artifact schema validation.
- [ ] Add tests for Markdown formatting QA cases, including malformed lists, missing numbered steps, overly long paragraphs, and unstructured drafts.

## Visibility Layer MVP

- [x] Add website-first strategy inference command for buyer prompt strategy drafts.
- [x] Keep one editable strategy file at `data/<brand>/visibility/strategy.json`.
- [x] Keep `prompt:select` limited to reviewed strategy files and reject URL input.
- [x] Load `.env.local` in prompt scan commands before reading `PERPLEXITY_API_KEY`.
- [x] Add exact env example/docs entry for `PERPLEXITY_API_KEY`.
- [x] Run selected Tiny Lemon Perplexity scan after `PERPLEXITY_API_KEY` is visible.
- [ ] Review inferred Tiny Lemon competitors and buyer jobs before treating prompt selection as baseline-ready.
- [ ] Reduce `unknown` source-format and citation-quality classifications.

## Later

- [ ] Market Monitor Agent or scheduled market research pass.
- [ ] Evaluate Exa Search/Contents as an alternate research provider.
- [ ] Evaluate Exa Websets for async/deeper research.
- [ ] Evaluate Perplexity as a synthesis/sanity-check provider.
- [ ] Add a technical SEO/AEO hygiene recommendation branch for crawlability, previews, canonical links, `/llms.txt`, metadata, schema, and AI-readable page structure.
- [ ] Make technical hygiene recommendations repo-aware so ContentDesk validates the issue, maps it to the actual framework, and generates implementation-ready Codex handoff tasks instead of generic SEO instructions.
- [ ] GitHub issue/PR automation.
- [ ] Direct Codex integration.
- [ ] AI-search visibility integrations.
- [ ] Content calendar view.
- [ ] Multi-brand support.
- [ ] Team permissions.
