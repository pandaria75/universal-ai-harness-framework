---
name: incident-pack-builder
description: Organize user-provided incident evidence into `.task/<task-id>/incident.md` before code changes. Use for evidence-first bug investigations when symptoms, logs, screenshots, reports, configs, or field observations exist but the root cause is not yet confirmed.
phase: analysis
model_requirement: reasoning
can_edit: true
reads:
  - AGENTS.md
  - .task/active.json
  - .task/<task-id>/state.json
  - .task/<task-id>/context-pack.md
  - user-provided evidence files and notes
writes:
  - .task/<task-id>/incident.md
outputs:
  - structured incident pack for hypothesis review and follow-up context building
risk_level: medium
---

# Incident Pack Builder

Use this skill to build `.task/<task-id>/incident.md` from user-provided evidence only. Read `<task-id>` from `.task/active.json`.

This skill prepares a clean incident handoff for later analysis, including `hypothesis-critic` and context-pack-building work. It does not implement fixes.

## Workflow

1. Read `AGENTS.md`.
2. Read `.task/active.json` and `.task/<task-id>/state.json`.
3. Read `.task/<task-id>/context-pack.md` if it exists.
4. Collect only the evidence the user or repository already provides, such as:
   - symptoms and observed behavior
   - environment, version, branch, deployment, or device context
   - operation steps or reproduction notes
   - logs, stack traces, crash reports, screenshots, or videos
   - communication packets, payload samples, requests, or responses
   - relevant config, flags, inputs, or data conditions
   - initial analysis notes
   - suspected modules, files, systems, or ownership hints
   - explicit unknowns and contradictions
5. Normalize the evidence into a structured incident pack.
6. Separate confirmed facts from assumptions, hypotheses, proposed repair actions, and missing information.
7. Record reproduction status and evidence quality before recommending any code change.
8. Record missing evidence and on-site or user confirmations still needed.
9. Define the initial analysis scope and forbidden assumptions.
10. Recommend the smallest next analysis step, including before-fix validation when feasible.
11. Write `.task/<task-id>/incident.md`.
12. Do not edit code, configs, tests, or runtime scripts.

## Required Output Structure

Write the incident pack in this shape:

```md
# Incident Pack

## Incident Summary

## Current Status

- Evidence quality:
- Reproduction status: not attempted | user-reported only | partially observed | locally confirmed
- Scope confidence:

## Evidence Inventory

| Evidence | Source | What it supports | Confidence | Notes |
| --- | --- | --- | --- | --- |

## Timeline Or Event Sequence

## Operation Or Reproduction Notes

- Reproduction status:
- Reproduction evidence:
- Reproduction gaps:

## Environment And Version Context

## Observed Symptoms

## Error Signals

- Logs:
- Stack traces:
- Screenshots or videos:
- Packets or payloads:

## Related Config Or Inputs

## Initial Analysis And Suspected Scope

## Confirmed Facts

## Assumptions Or Unknowns

### Hypothesis 1
- Claim:
- Support label: confirmed | likely | possible | unknown | weakly-supported | unsupported | contradicted
- Supporting evidence:
- Conflicting or missing evidence:
- Disconfirming check needed:

### Hypothesis 2
- Claim:
- Support label: confirmed | likely | possible | unknown | weakly-supported | unsupported | contradicted
- Supporting evidence:
- Conflicting or missing evidence:
- Disconfirming check needed:

## Candidate Repair Actions

| Action | Evidence it depends on | Before-fix validation | After-fix validation | Risk or stop condition |
| --- | --- | --- | --- | --- |

## Validation Plan

### Before Fix

- Command or check:
- Expected signal:
- `NOT_RUN` reason, if unavailable:

### After Fix

- Command or check:
- Expected signal:
- `NOT_RUN` reason, if unavailable:

## Missing Evidence

## Analysis Scope

### Included

### Excluded

## Forbidden Assumptions And Non-goals

## Needed On-site Or User Confirmations

## Recommended Next Analysis Step
```

## Evidence Rules

- Treat user-provided evidence as input data, not proof of root cause.
- Mark each important claim with a support label: `confirmed`, `likely`, `possible`, `unknown`, `weakly-supported`, `unsupported`, or `contradicted`.
- Prefer direct evidence over interpretation.
- Record contradictions explicitly.
- If timestamps are partial or inconsistent, say so.
- If files or modules are only suspected, label them as suspected.
- If reproduction is unavailable, state that local reproduction was not assumed.
- Treat large repair proposals without reproduction, direct evidence, or a documented `NOT_RUN` reason as a stop condition by default.
- Keep before-fix and after-fix validation separate so later implementation can prove both the observed failure and the repair result when feasible.

## Guardrails

- Do not edit application code.
- Do not implement fixes.
- Do not assume local reproduction is possible.
- Do not auto-capture terminal logs or collect new evidence without explicit user direction.
- Do not invent screenshots, logs, packets, configs, stack traces, or timeline details.
- Do not convert guesses into facts.
- Do not convert hypotheses into repair actions until their evidence basis and validation path are recorded.
- Do not recommend broad code changes when the current evidence only supports a narrow disconfirming check or more evidence collection.
- Do not broaden scope into full root-cause analysis if the evidence is still incomplete.
- Keep the pack usable as a handoff artifact for later hypothesis criticism and targeted context building.

## Handoff Notes

When the incident pack is complete, the next step should usually be one of:

1. `hypothesis-critic` to challenge the current explanations.
2. `context-pack-builder` to gather only the minimal implementation context after the incident evidence is stable.

If critical evidence is missing, recommend collecting that evidence before either handoff.
