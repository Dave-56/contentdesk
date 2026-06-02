---
title: ADR 007 — LLM owns buyer language for prompt inference
updated: 2026-06-02
type: decision
status: current
---

# ADR 007 — LLM owns buyer language for prompt inference

## Decision
`prompt:infer` uses AI Gateway structured classification to produce market context and
buyer-language nouns. `prompt:select` requires `buyerLanguage` and refuses to assemble
prompts without it.

Current contract:

```text
profileSite()
  -> raw website facts

classifyBuyerPromptMarket(siteProfile)
  -> market + buyerLanguage + warnings

prompt:select
  -> validate and assemble intent prompts from buyerLanguage only
```

Deterministic code may validate, score, and assemble prompts. It must not try to understand
market language from scraped homepage text.

## Why
Homepage scraping is thin and noisy. Deterministic inference produced bad brand names,
wrong categories, noisy competitors, Shopify leakage for non-Shopify products, and
ungrammatical prompts from pasted clauses.

LLM classification is the right layer for category, audience, and buyer-language judgment.
Code remains useful as a contract: schema validation, manual-review warnings, prompt
quality checks, scoring, and portfolio selection.

## Revisit When
- AI Gateway classification becomes too expensive or unreliable for strategy inference.
- A better first-party site profiler produces clean enough structured facts to reduce LLM
  dependence.
- The product expands beyond SaaS and Shopify enough to require a broader market taxonomy.
