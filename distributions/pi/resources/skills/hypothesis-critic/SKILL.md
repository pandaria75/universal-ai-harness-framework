---
name: hypothesis-critic
description: Challenge incident or bugfix hypotheses against available evidence before implementation. Use after incident intake or whenever a suspected root cause needs support checks, disconfirming evidence review, and a safest-next-step recommendation.
phase: analysis
model_requirement: reasoning
can_edit: false
reads:
  - .task/active.json
  - .task/<task-id>/incident.md
  - user-supplied evidence
  - relevant logs, code snippets, screenshots, configs, and reports
writes: []
outputs:
  - hypothesis assessment with support labels
  - evidence gaps and disconfirming checks
  - safest next step for planner or context-pack-builder handoff
risk_level: medium
---

# Hypothesis Critic

Use this skill to challenge bugfix or incident hypotheses before implementation.

Read `<task-id>` from `.task/active.json`. Prefer `.task/<task-id>/incident.md` when it exists. If no incident file exists, use only the evidence the user supplied and state the limitation clearly.

## Purpose

- Test whether each hypothesis is supported by observed phenomena, logs, code, runtime behavior, configuration, and other concrete evidence.
- Separate evidence from interpretation.
- Catch weak causal claims before a planner or coding agent acts on them.
- Prepare a clean handoff for a planner, context-pack-builder, or reviewer.

## Workflow

1. Read `.task/active.json` when a task directory is in use.
2. Read `.task/<task-id>/incident.md` if available.
3. Collect the smallest relevant evidence set:
   - user symptom report
   - logs or stack traces
   - screenshots or external reports
   - relevant code snippets or config fragments
   - known environment or version notes
4. List the explicit hypotheses already proposed by the user, incident pack, or prior analysis.
5. If no explicit hypotheses exist, derive a small set of candidate hypotheses and label them as tentative.
6. For each hypothesis, evaluate:
   - what evidence supports it
   - what evidence only weakly suggests it
   - what evidence could disconfirm it
   - whether the claimed cause actually explains the observed effect
   - whether the hypothesis is broader than the current incident scope
7. Assign exactly one support label to each hypothesis:
    - `confirmed`
    - `likely`
    - `possible`
    - `unknown`
    - `weakly-supported`
    - `unsupported`
    - `contradicted`
8. Identify whether the current evidence is sufficient to justify implementation, or whether the safest next step is reproduction, disconfirming checks, or more evidence.
9. Recommend the smallest safe next step needed to reduce uncertainty.
10. Output the assessment only.
11. Do not implement fixes.

## Required Checks

For every hypothesis, explicitly check for:

- over-interpretation from partial evidence
- weak causal links between symptom and suspected cause
- missing disconfirming evidence
- missing reproduction evidence or documented `NOT_RUN` reason
- repair actions that depend on unsupported assumptions
- scope creep beyond the reported incident
- reliance on a single log fragment as if it were conclusive

## Support Label Rules

- `confirmed`: directly supported by multiple consistent evidence points, with no meaningful conflicting evidence currently visible.
- `likely`: supported by meaningful evidence, but at least one uncertainty or missing disconfirmation step remains.
- `possible`: plausible, but support is limited, indirect, or mostly inferential.
- `unknown`: not adequately supported by current evidence, or the evidence is too incomplete or conflicting to judge.
- `weakly-supported`: some evidence points in this direction, but the causal link is too thin for implementation without a narrower check.
- `unsupported`: asserted without concrete evidence in the current packet.
- `contradicted`: conflicts with observed evidence or a stronger confirmed fact.

Do not use any label other than `confirmed`, `likely`, `possible`, `unknown`, `weakly-supported`, `unsupported`, or `contradicted`.

## Output Format

```md
# Hypothesis Critic Assessment

## Evidence Basis
- Incident source:
- Evidence reviewed:
- Missing evidence:
- Limitations:

## Hypothesis Review

### Hypothesis 1
- Statement:
- Support label: confirmed | likely | possible | unknown | weakly-supported | unsupported | contradicted
- Implementation readiness: ready | needs narrower check | needs more evidence | blocked
- Supporting evidence:
- Weak or indirect evidence:
- Disconfirming evidence checked:
- Gaps or contradictions:
- Over-interpretation or scope-creep risk:
- Verdict:
- Required evidence or safest next step:

### Hypothesis 2
- Statement:
- Support label: confirmed | likely | possible | unknown | weakly-supported | unsupported | contradicted
- Implementation readiness: ready | needs narrower check | needs more evidence | blocked
- Supporting evidence:
- Weak or indirect evidence:
- Disconfirming evidence checked:
- Gaps or contradictions:
- Over-interpretation or scope-creep risk:
- Verdict:
- Required evidence or safest next step:

## Recommended Handoff
- Best current working hypothesis:
- Hypotheses that should not drive implementation yet:
- Unsupported, weakly-supported, or contradicted assumptions:
- Before-fix validation needed:
- After-fix validation expectation:
- Next recipient: planner | context-pack-builder | user for more evidence
- Notes for handoff:
```

## Guardrails

- Do not edit code.
- Do not implement or suggest a broad fix plan beyond the safest next step.
- Do not assume local reproduction exists or is required.
- Do not auto-capture logs or generate synthetic evidence.
- Do not treat a single stack trace line or log fragment as conclusive on its own.
- State uncertainty explicitly.
- Treat large code changes based on `possible`, `unknown`, `weakly-supported`, `unsupported`, or `contradicted` hypotheses as blocked unless the user explicitly accepts the risk and the task records the rationale.
- Prefer before-fix and after-fix validation evidence; when validation cannot be run, require a documented `NOT_RUN` reason and follow-up.
- Prefer disconfirming checks over confident speculation.
- Keep the output tied to the reported incident scope.
