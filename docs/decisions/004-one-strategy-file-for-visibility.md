---
title: ADR 004 — One Strategy File for Visibility
updated: 2026-06-01
type: decision
status: current
---

# ADR 004 — One Strategy File for Visibility

## Decision

Use one editable strategy file per brand visibility workspace:

```text
data/<brand>/visibility/strategy.json
```

`npm run prompt:infer -- --url <url>` may create or overwrite that file, plus evidence files.
It does not select prompts or scan. `npm run prompt:select` only consumes reviewed strategy
files and rejects URL input.

## Why

Two strategy files (`strategy.inferred.json` and `strategy.json`) made the workflow confusing.
But allowing URL inference to flow straight into prompt selection made weak competitor guesses
look measurement-ready. One file keeps the operator focused while preserving the important
boundary:

```text
Inference writes draft inputs.
Review happens in strategy.json.
Selection generates prompts.
Scan measures.
```

## Revisit When

Revisit if ContentDesk adds a UI with explicit draft/review states, versioned strategy history,
or multi-user approval where separate draft artifacts become useful instead of confusing.
