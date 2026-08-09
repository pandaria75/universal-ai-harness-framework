---
name: context-pack-builder
description: Build a minimal task context pack before coding. Use after a requirement document or implementation plan exists, or when a coding task spans modules and needs compact context for AI agent execution.
phase: analysis
model_requirement: reasoning
can_edit: true
risk_level: medium
---

# Context Pack Builder

Use this skill to build `.task/<task-id>/context-pack.md` before implementation. Read `<task-id>` from `.task/active.json`.

## When To Use

- Use after a requirement document or implementation plan exists.
- Use before coding when a task needs compact, bounded execution context.

## Inputs Required

- `.task/active.json` and `.task/<task-id>/state.json`
- Requirement, implementation, and incident artifacts when applicable
- Relevant rules and docs routed through the knowledge map or nearby rule files

## Steps

1. Read `.task/active.json` and `.task/<task-id>/state.json`.
2. Read `marionettist.config.yaml` when it exists and note `knowledge.mode` and `knowledge.maturity`.
3. Read the requirement document if available, preferring `.task/<task-id>/requirement.md`.
4. Read the implementation plan if available, preferring `.task/<task-id>/implementation-plan.md`.
5. For bugfix or incident-style work, read `.task/<task-id>/incident.md` when it exists.
6. Read `docs/project/knowledge-map.md` to route only the most relevant docs and rules.
7. Match involved areas using knowledge-map fields such as `Areas`, `Tags`, `Docs`, `Rules`, `Read When`, `Boundaries`, and `Validation`.
8. If target files or directories are known, walk upward from those paths and load only nearby `MODULE_RULES.md`, `AGENTS.md`, or `HARNESS_RULES.md` files that actually constrain the work.
9. Treat global safety and boundary rules as higher priority than local path-proximity rules when they conflict.
10. Use module-inspector or workflow-inspector only when scope is still unclear after targeted routing.
11. Extract only the minimum context needed for coding.
12. Create or update `.task/<task-id>/context-pack.md`.
13. Do not implement code.
14. If legacy `.task/context-pack.md` exists, read it only as a migration fallback and recommend moving context into the active task directory.
15. Record the task's recommended and selected gate policy when available from task artifacts and, when present, `marionettist.config.yaml`, along with the stop conditions that still require a pause.

## Output Artifact

- A compact `.task/<task-id>/context-pack.md` with the current slice or group, loaded context, allowed scope, validation commands, and stop conditions

## Knowledge Mode And Maturity

Use config values as routing defaults:

- `knowledge.mode: standard` -> balance current-state and future-intent context as needed
- `knowledge.mode: mudball` -> load current-state evidence first and prefer present-day behavior, risk, unknowns, and safe-change guidance

Scale context depth by `knowledge.maturity`:

- **L0**: minimum viable context; keep scope tight and unknowns explicit
- **L1**: include current-state entrypoints, major flows, risk zones, and safe-change notes
- **L2**: include reusable area docs and rule metadata when they materially affect the task
- **L3**: include stronger ownership, boundary, and docs/rules sync context when relevant
- **L4**: include curated high-trust constraints and stronger validation expectations for architecture-sensitive work

Do not push mudball projects toward L3/L4 by default. L0-L1 are acceptable steady states when knowledge is still emerging.

## Output File Template

```md
# Task Context Pack

## Task Goal

## Knowledge Posture

- Mode:
- Maturity:

## Current Slice Or Group

## Gate Policy

- Recommended:
- Selected:
- finalApprovalRequired: true | false
- Policy Notes:

## Bugfix Context

### Observed Behavior

### Expected Behavior

### Reproduction Steps

### Evidence
- Logs:
- Stack Trace:
- Screenshots:
- Related Files:

### Suspected Scope

### Regression Risk

## Requirement Source

## Implementation Source

## Involved Modules Or Areas

## Loaded Context

### Global Rules

### Knowledge Map Matches

### Path-Proximity Rules

### Excluded Context

Use `Loaded Context` to explain routing decisions and why each source was included or excluded. Use the following `Loaded Rules` and `Loaded Docs` sections as concise reference lists, not as places to duplicate full content.

## Loaded Rules

## Loaded Docs

## Execution Mode

- Mode: sequential | parallel-group
- Current Slice Or Group:
- Parallel Members:
- Fallback Order:
- Shared Files:
- Merge Owner:
- Conflict Resolution Rule:
- Validation Level: slice | group | final

## Execution Chain

## Allowed Modification Scope

## Forbidden Modification Scope

## Key Existing Classes Or Entrypoints

## Required Behavior

## Non-goals

## Implementation Steps

## Validation Commands

## Assumptions

## Risks

## Stop Conditions
```

## Guardrails

- Keep the context pack compact.
- Read mode/maturity from `marionettist.config.yaml` when available and reflect them in the context pack.
- Do not copy full docs or source files.
- Include forbidden scope explicitly.
- Include validation commands explicitly.
- When the current approved work is `parallel-capable`, include both the parallel mode and the sequential fallback order.
- When the current approved work is a parallel group, include members, shared files, merge owner, conflict rule, and group validation.
- Include stop conditions explicitly.
- Record recommended and selected gate policy from task artifacts when available, and also note relevant `marionettist.config.yaml` gate policy defaults or overrides when present.
- In markdown, prefer the canonical field name `finalApprovalRequired` or explicitly note that it maps to the JSON key of the same name so agents do not copy a humanized label into `state.json`.
- If a task-local policy override is selected, note that it changes the task posture but does not bypass required analysis gates, required final approval by default, or any other explicit stop condition.
- For bugfix tasks, include observed behavior, expected behavior, reproduction steps, evidence, suspected scope, and regression risk when available.
- Read `incident.md` only when the task type and available evidence justify it.
- Do not load the whole `docs` directory by default.
- Do not turn `knowledge-map.md` into a code index.
- Record which context was loaded, why it matched, and what was intentionally excluded.
- Prefer references to the exact docs and rules that matter instead of copying them.
- If local path rules conflict with repository-global safety or boundary rules, follow the global rules and note the conflict.
- For `knowledge.mode: mudball`, prefer current-state docs over target-state docs unless future design is directly relevant.
- Do not require broad documentation context for L0-L1 tasks when a smaller safe context is sufficient.
- Do not implement code.

## Gate / Stop Condition

- Stop when the approved slice or current task posture cannot be identified.
- Stop when required rules, boundaries, or validation expectations remain too unclear for safe coding handoff.

## Red Flags

- Context packs that duplicate large docs instead of routing to them
- Missing forbidden scope or stop conditions
- Unclear slice versus parallel-group execution posture
- Loaded local rules that conflict with stronger global safety boundaries

## Exit Criteria

- The current slice or group is explicit
- Only the minimum relevant docs and rules are included
- Allowed and forbidden scope are clear
- Validation commands, assumptions, risks, and stop conditions are documented

## Handoff

- Hand the context pack to the coding workflow together with the approved slice or group and any unresolved stop conditions that still require a pause
