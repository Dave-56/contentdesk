---
title: ADR 006 — Multi-provider applies only to prompt execution
updated: 2026-06-02
type: decision
status: current
---

# ADR 006 — Multi-provider applies only to prompt execution

## Decision
Do not call the whole visibility system a multi-provider scan. The website/profile job is
provider-neutral. Only prompt execution fans out across providers.

Current flow:

```text
visibility:profile
  -> owned-site inventory

prompt:select
  -> selected buyer prompts

visibility:run
  -> run selected prompts across Perplexity, OpenAI, Anthropic

visibility:synthesize
  -> compare provider outputs

visibility:recommend
  -> compare synthesis + owned inventory and choose next asset
```

## Why
Website inventory answers what the brand already owns. Provider runs answer where the brand
appears or gets cited in AI-search answers. Mixing those jobs makes the architecture bloated
and spreads provider-specific assumptions into crawling, inventory, and recommendations.

Keeping provider fan-out inside prompt execution lets the system add or remove AI engines
without changing owned-site inventory or recommendation inputs.

## Revisit When
- Provider-specific crawlers become necessary because an engine exposes its own searchable
  index or citation API.
- Gemini or Google AI Overviews are added and require materially different prompt/run
  semantics.
- Recommendations need provider-specific asset rules instead of shared synthesis signals.
