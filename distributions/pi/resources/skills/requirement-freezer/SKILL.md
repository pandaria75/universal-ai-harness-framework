---
name: requirement-freezer
description: Convert raw feature requests, meeting notes, ambiguous requirements, or behavior disputes into a frozen requirement document with scope, assumptions, non-goals, risks, and acceptance criteria. Use before implementation planning when requirements are unclear, business rules need stabilization, or the task will later be handed to an AI agent for coding.
phase: analysis
model_requirement: reasoning
can_edit: true
risk_level: medium
---

# Requirement Freezer

Use this skill to convert raw requirements into a stable requirement document.

## When To Use

- Use before implementation planning when requirements, business rules, or expected behavior are unclear.
- Use when a task needs a stable requirement artifact for later slicing or coding.

## Inputs Required

- Raw task request, notes, or requirement source
- Relevant evidence, docs, or examples when available
- Active task selection from `.task/active.json` when writing artifacts

## Steps

1. Read the user-provided requirement.
2. Identify:
   - business or system goal
   - involved users or actors
   - affected modules or feature areas if obvious
   - expected behavior
   - unclear business rules or compatibility expectations
3. Classify questions:
   - Blocking Questions
   - Non-blocking Assumptions
   - Deferred Questions
4. Ask only Blocking Questions.
5. If enough information is available, create or update `.task/<task-id>/requirement.md`, where `<task-id>` is read from `.task/active.json`.
6. Update `.task/<task-id>/state.json` if the caller asks you to record the requirement gate.
7. Use the active task directory selected by `.task/active.json`.
8. Do not implement code.
9. Do not write an implementation plan.

## Output Artifact

- A frozen requirement document in `.task/<task-id>/requirement.md`
- Optional task state update only when the caller asks to record the gate

## Output Document Template

```md
# <Task Name> Requirement

## Goal

## Background

## In Scope

## Out Of Scope

## Current Behavior

## Required Behavior

## User Flow

## Business Rules

## Data Rules

## API Contract

## UI Requirements

## Compatibility Requirements

## Error Handling

## Permissions And Security

## Assumptions

## Risks

## Acceptance Criteria

## Deferred Questions

## Source Notes
```

## Guardrails

- Do not implement code.
- Do not invent business rules.
- Record assumptions explicitly.
- Keep requirements separate from implementation details.
- Ask only blocking questions.

## Gate / Stop Condition

- Stop and ask blocking questions when required behavior, scope, or acceptance criteria cannot be stabilized from available evidence.
- Stop before planning or coding.

## Red Flags

- Conflicting sources for expected behavior
- Unclear in-scope versus out-of-scope boundaries
- Missing acceptance criteria for a non-trivial change
- Hidden implementation decisions presented as requirements

## Exit Criteria

- Scope and non-goals are explicit
- Assumptions and deferred questions are recorded
- Acceptance criteria are stable enough for implementation slicing
- No code or implementation plan was produced

## Handoff

- Hand the frozen requirement to implementation-slicer or context-pack-builder together with any remaining deferred questions and relevant source notes
