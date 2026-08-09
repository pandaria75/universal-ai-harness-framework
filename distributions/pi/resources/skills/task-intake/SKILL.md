---
name: task-intake
description: Default lightweight entrypoint for non-trivial repository tasks, including feature development, bug fixing, refactoring, documentation updates, investigations, reviews, and workflow-sensitive work. Use when a new task starts and the Marionettist flow has not started yet; use fast path when structured task artifacts or a clearly scoped ongoing slice are already provided.
phase: analysis
model_requirement: reasoning
can_edit: true
risk_level: low
---

# Task Intake

Use this skill to collect task information and route the task into the lightweight file-based Marionettist workflow.

## When To Use

- Use when a new non-trivial repository task starts and the Marionettist flow has not started yet.
- Use the fast path when structured task artifacts or a clearly scoped ongoing slice already exist.

## Inputs Required

- User task goal and requested outcome
- Relevant repository constraints, paths, or evidence when available
- Existing task artifacts if the task is already in progress

## Fast Path

If the user already provides structured task artifacts or a clearly scoped ongoing slice, do not ask the full intake questions.

Structured task artifacts include:
- `.task/active.json`
- `.task/<task-id>/state.json`
- `.task/<task-id>/requirement.md`
- `.task/<task-id>/implementation-plan.md`
- `.task/<task-id>/context-pack.md`

Use the local task date for `<yyyy-MM-dd>`, for example `.task/2026-04-28/`.

For fast-path tasks:
1. Summarize the current task state.
2. Identify the next required Marionettist step.
3. Check and report existing gate policy state, including any visible `gatePolicy.selected`, config default, or effective task policy, instead of skipping policy state entirely.
4. If the task is resuming non-trivial work and policy selection is missing or ambiguous, ask only the blocking question needed to confirm the effective task policy when override is allowed.
5. Route directly to that step.
6. Ask only blocking questions needed for routing.

## Steps

1. Read `AGENTS.md`.
2. Read `marionettist.config.yaml` if present.
3. Classify the task type:
   - feature
   - bugfix
   - refactor
   - documentation
   - review
   - investigation
   - build/deployment
4. Read `marionettist.config.yaml` gate policy defaults when present, especially `gatePolicy.defaultMode` and whether task-local override is allowed.
5. Explain the available gate policy choices for the task:
   - `strict` for the most pause-heavy posture, especially for explicitly high-risk, boundary-sensitive, or critic-required work
   - `balanced` for the normal middle posture for many non-trivial tasks with clear approved slices, including low/moderate-risk `standard` slices that should not pause after every slice
   - `autonomous` only when the task is already well-bounded, validation is clear, and fewer mid-task pauses are acceptable
6. Recommend an initial gate policy for the task based on risk and workflow sensitivity, but make clear the recommendation is advisory rather than controlling.
7. Explain that a task-local gate policy selection changes only the task's gate posture. It does not bypass required analysis gates, critic-required routing, final approval by default, explicit stops, protected or dangerous command stops, or concrete elevated-risk `risk_score >= 4` stops. A `strict` recommendation is advisory and must not overwrite an explicit selected policy.
8. For non-trivial new tasks, ask for and capture the selected task gate policy when task-local override is allowed. If no explicit selection is provided, record the default or effective task policy instead of leaving policy state implicit.
9. Ask only the minimum blocking questions required to choose the next workflow.
10. Do not implement code.
11. Do not create large documents unless the task requires them.
12. For non-trivial new tasks, create a dated task directory and point `.task/active.json` to it.
13. Route to the correct next skill or workflow.

## Questions To Ask

### Common Questions

- What is the task goal?
- Which module, package, feature area, API, page, or workflow is involved?
- Is this a new feature, bug fix, refactor, investigation, documentation task, or review?
- Is the expected behavior already known?
- Are there files, logs, screenshots, APIs, or docs that must be used?
- Is any area forbidden to modify?
- What validation command or manual verification is expected?

### Feature Task Questions

- What user or system scenario should be supported?
- What is in scope?
- What is explicitly out of scope?
- Are UI, API, database, workflow, or infrastructure changes required?
- Are compatibility requirements involved?

### Bugfix Task Questions

- What is the observed behavior?
- What is the expected behavior?
- How can the issue be reproduced?
- Is there an error log or stack trace?
- Is the bug stable or intermittent?
- Which version, branch, environment, customer, or deployment context is affected?
- Is this a regression?

### Refactor Task Questions

- What problem should the refactor solve?
- What behavior must remain unchanged?
- What areas are allowed to change?
- What areas are forbidden to change?

## Routing Rules

### Feature

Use:

1. requirement-freezer when scope, business rules, or expected behavior are unclear
2. module-inspector or workflow-inspector when boundaries or flows need analysis
3. implementation-slicer
4. context-pack-builder
5. coding
6. boundary-reviewer

### Bugfix

Use:

1. bug intake section in this skill
2. workflow-inspector if call chain or runtime flow is unclear
3. module-inspector if module boundary is unclear
4. requirement-freezer only when expected behavior or business rule is unclear
5. context-pack-builder
6. coding
7. boundary-reviewer

### Refactor

Use:

1. module-inspector
2. workflow-inspector if behavior flow may be affected
3. implementation-slicer
4. context-pack-builder
5. coding
6. boundary-reviewer

### Documentation

Use:

1. workspace-knowledge-manager
2. update `docs/project/knowledge-map.md` when docs or rules are added, moved, renamed, or deleted

## Output Artifact

- A compact intake result that captures task type, current understanding, gate policy recommendation, gate policy selection or effective default, blocking questions, assumptions, and the recommended next step
- Task artifacts only when the task requires initialization or the caller asks for them

## Output Format

```md
# Task Intake Result

## Task Type

## Current Understanding

## Gate Policy

- config/default:
- allowTaskOverride:
- recommended:
- selected:
- reason or override reason:
- effective:
- finalApprovalRequired:

## Blocking Questions

## Non-blocking Assumptions

## Recommended Next Step

## Suggested Prompt For Next Step
```

## Guardrails

- Ask only blocking questions.
- Do not implement code.
- Do not generate full implementation plans directly.
- Keep the intake lightweight.
- Prefer repository evidence over asking the user when possible.
- Recommend a gate policy at task start for non-trivial work, but keep the recommendation advisory.
- Do not classify work as Tier L merely because it is non-trivial. Prefer Tier M for clear, bounded bugfixes, features, refactors, docs, or config work without cross-boundary ambiguity or sensitive production/security/compatibility impact.
- Treat Tier S as available for clearly scoped localized low-risk work such as typo/comment fixes, docs-only corrections, small tests/examples, harmless config text changes, or localized one-file fixes with no boundary ambiguity.
- Record gate policy state for non-trivial work even on fast path; do not leave selected/default/effective policy implicit when the evidence is available.
- Treat Tier L / Tier M references here as existing Marionettist task classification guidance only, not as a configurable tier-policy mapping.
- Preserve final approval by default unless higher-priority instructions explicitly change it.
- Treat task override as policy selection, not as permission to bypass required gates.
- Keep Marionettist gate policy separate from OpenCode permission settings.
- Do not imply that balanced or autonomous bypasses analysis, critic-required review, final approval, explicit stops, protected or dangerous command handling, or concrete elevated-risk `risk_score >= 4` pauses.

## Gate / Stop Condition

- Stop and ask blocking questions when the goal, task type, or safe next workflow cannot be determined from available evidence.
- Stop before coding, implementation planning, or broad document creation.

## Red Flags

- Missing task goal, scope, or validation expectation
- Conflicting instructions about allowed or forbidden areas
- Fast-path artifacts that disagree about current slice or gate status
- Requests that implicitly skip required Marionettist steps

## Exit Criteria

- The next Marionettist step is identified
- Blocking questions are minimized and explicit
- Recommended gate policy is stated for non-trivial work
- Selected/default/effective gate policy state is captured for non-trivial work
- The task is routed without implementing code

## Handoff

- Send the task to the next skill with the intake result, task type, known scope, open blocking questions, and the recorded gate policy state, including recommended, selected, reason or override reason, and effective policy when available
