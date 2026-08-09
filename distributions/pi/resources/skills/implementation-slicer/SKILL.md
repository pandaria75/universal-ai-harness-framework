---
name: implementation-slicer
description: Convert a frozen requirement document or approved refactor scope into small implementation slices with file scope, modification order, validation commands, rollback notes, and done criteria. Use before coding non-trivial features or refactors.
phase: analysis
model_requirement: reasoning
can_edit: true
risk_level: medium
---

# Implementation Slicer

Use this skill to convert a requirement document into executable implementation slices.

## When To Use

- Use after requirements are frozen or refactor scope is approved.
- Use before coding non-trivial features or refactors that need bounded slices.

## Inputs Required

- Frozen requirement document or approved refactor scope
- Relevant boundary or workflow analysis when available
- Active task selection from `.task/active.json` when writing artifacts

## Steps

1. Read the requirement document or approved refactor scope.
2. Use module-inspector or workflow-inspector when module or workflow scope is unclear.
3. Identify the smallest safe implementation slices.
4. For each slice, define:
   - goal
   - allowed files, packages, or directories
   - forbidden files, packages, or directories
   - execution mode
   - gate class
   - risk score
   - gate reasons
   - dependencies and parallel eligibility when the task is complex
   - validation level
   - merge owner and conflict rule when shared files are involved
   - steps
   - validation command
   - done criteria
   - rollback notes
5. Create or update `.task/<task-id>/implementation-plan.md`, where `<task-id>` is read from `.task/active.json`.
6. Update `.task/<task-id>/state.json` if the caller asks you to record slices or gates.
7. Use the active task directory selected by `.task/active.json`.
8. Do not implement code.

## Output Artifact

- An implementation plan with bounded slices, validation guidance, and rollback notes in `.task/<task-id>/implementation-plan.md`
- Optional task state update only when the caller asks to record slices or gates

## Gate Class Rules

- Use only this frozen `gateClass` vocabulary: `simple`, `standard`, `boundary-sensitive`, `high-risk`.
- Emit `risk_score` as an integer from `1` to `5` for every slice or approved parallel group.
- Emit `gateReasons` as short reason labels that explain why the slice should pause or may continue under the selected policy.
- `risk_score` is stricter supplemental metadata, not a replacement for `gateClass`, required human gates, explicit stop conditions, or critic-required pauses.
- When `risk_score` indicates higher risk than `gateClass` alone, preserve or strengthen the stop posture rather than weakening it.
- Calibrate ordinary bounded `standard` slices toward `risk_score` 2-3 unless there is concrete elevated impact, reversibility concern, or validation uncertainty.
- Use `risk_score` 4-5 only when the slice itself carries elevated safety, compatibility, production, data, security, cross-boundary, or validation risk.
- Treat these as common higher-risk inputs when assigning or explaining `risk_score`: database schema updates, permissions or security logic, device communication, scheduling, externally committed public API compatibility, build or release scripts, code deletion, dependency upgrades, and production configuration.

## Output Document Template

```md
# <Task Name> Implementation Plan

## Requirement Source

## Scope Summary

## Involved Modules Or Areas

## Loaded Rules

## Loaded Docs

## Global Forbidden Scope

## Execution Strategy

- Complexity: simple | complex
- Default Execution: sequential
- Parallel Execution: optional | not-needed
- Fallback Execution: sequential
- Merge Owner:
- Conflict Resolution Rule:

## Slice Dependency Graph

| Slice | Depends On | Can Run In Parallel With | Fallback Order | Shared Files | Merge Owner | Conflict Risk |
| --- | --- | --- | --- | --- | --- | --- |

## Implementation Slices

### Slice 1: <Name>

#### Goal

#### Allowed Modification Scope

#### Forbidden Scope

#### Execution

- Mode: sequential | parallel-capable
- Depends On:
- Can Run With:
- Must Not Run With:
- Fallback Order:
- Shared Files:
- Merge Owner:
- Conflict Risk: low | medium | high
- Gate Class: simple | standard | boundary-sensitive | high-risk
- Risk Score: 1 | 2 | 3 | 4 | 5
- Gate Reasons:
- Validation Level: slice | group | final
- Recommended Agent Strategy:

#### Steps

#### Validation

#### Done Criteria

#### Rollback Notes

## Parallel Slice Groups

Use this section only for complex tasks that have independent work worth parallel planning.

### Group A: <Name>

#### Members

#### Parallel Eligibility

#### Sequential Fallback Order

#### Merge Rule

#### Conflict Resolution Rule

#### Group Validation

#### Group Done Criteria

## Final Validation

## Documentation Update Requirement

## Risks
```

## Guardrails

- Prefer small slices.
- Do not merge unrelated work into one slice.
- Do not implement code.
- Use `parallel-capable` planning only for complex tasks with independent scope and a clear sequential fallback.
- Do not mark shared-file work as `parallel-capable` unless the plan names a merge owner and conflict resolution rule.
- Do not expand the requirement scope.
- Include validation commands whenever possible.
- When recording slices in task state or plan artifacts, emit `gateClass`, `risk_score`, and `gateReasons` together.
- Do not use `risk_score` to replace `gateClass`, invent new gate classes, or relax structured artifact shape.

## Gate / Stop Condition

- Stop when requirement scope is still unstable or slice boundaries cannot be defined safely.
- Stop before coding or when planning would require expanding scope, changing the frozen `gateClass` vocabulary, or turning `risk_score` into a replacement for required gates.

## Red Flags

- Large or mixed-purpose slices
- Shared-file parallel work without a merge owner or conflict rule
- Missing validation guidance for risky changes
- Slice definitions that blur allowed versus forbidden scope
- Slice metadata that omits one of `gateClass`, `risk_score`, or `gateReasons`
- Numeric scoring framed as a substitute for human review or gate stops

## Exit Criteria

- Each slice has a clear goal and bounded modification scope
- Execution order, dependencies, and validation level are explicit
- Gate metadata uses existing `gateClass` vocabulary and includes supplemental `risk_score` plus `gateReasons`
- The plan is ready for context packing and coding handoff

## Handoff

- Hand the approved slice or parallel group, including `gateClass`, `risk_score`, `gateReasons`, validation guidance, and forbidden scope, to context-pack-builder or the coding workflow
