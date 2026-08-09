---
name: test-strategy
description: Select a task-appropriate validation strategy before coding or validation handoff. Use to recommend evidence, automated tests, manual checks, or NOT_RUN conditions based on task type, change risk, and environment limits without mandating global TDD.
phase: analysis
model_requirement: reasoning
can_edit: false
reads:
  - task goal, task type, scope, and allowed slice
  - requirement, implementation, context-pack, or incident artifacts when available
  - relevant risk notes, reproduction steps, and validation constraints
writes: []
outputs:
  - selected validation strategy by task type and risk
  - required evidence and validation approach for planner, context-pack, coder, or validator handoff
  - commands, manual checks, or NOT_RUN conditions with reasons
risk_level: medium
---

# Test Strategy

Use this skill to choose a proportionate validation strategy for the current task or slice.

## When To Use

- Use before coding when validation expectations are unclear or disputed.
- Use during planning or context building to define the expected evidence for implementation and validation handoff.
- Use when the task needs nuanced guidance instead of a blanket failing-test-first rule.

## Inputs Required

- Task type, goal, and approved slice or scope
- Expected behavior, reproduction steps, or incident evidence when available
- Change risk, affected areas, and environmental constraints
- Known validation options such as automated checks, smoke checks, manual checks, mocks, simulators, or protocol-level verification

## Steps

1. Identify the task type and the kind of behavior being changed.
2. Identify the main risks: regression, hidden state, permission boundaries, event ordering, hardware or environment dependence, or purely presentational change.
3. Choose the lightest strategy that still produces credible evidence.
4. Apply task-type guidance:
   - **bugfix**: prefer clear reproduction and ideally a failing test first when practical.
   - **algorithms, state machines, permissions, event bus behavior**: strongly prefer automated tests.
   - **UI styling or configuration-only changes**: smoke checks or documented manual verification can be acceptable when behavior risk is low.
   - **hardware communication**: prefer mocks, simulators, or protocol-level testing over fragile live-device dependence when possible.
   - **incidents**: require evidence-first analysis before code changes.
5. Decide what evidence is required before implementation can be considered safe enough to proceed.
6. Define the validation approach for the current slice:
   - automated tests
   - smoke checks
   - manual verification
   - environment-constrained `NOT_RUN` with reason
   - stop and ask for more evidence
7. Record commands or manual checks only when they are actually known.
8. List risks, limits, and stop conditions that should block weak validation.

## Output Artifact

- A compact test-strategy recommendation usable by planner, context-pack-builder, coder, or validator handoff

## Output Format

```md
# Test Strategy

## Selected Strategy
- Task type:
- Change type:
- Strategy summary:

## Required Evidence
- Reproduction or baseline evidence:
- Behavior that must be protected:
- Risk-sensitive areas:

## Validation Approach
- Automated tests:
- Smoke checks:
- Manual checks:
- Environment dependencies:

## Commands Or Checks
- Command 1:
- Manual check 1:

## NOT_RUN Conditions
- Check:
- Reason:
- Required follow-up:

## Risks / Stop Conditions
-

## Handoff Notes
- For planner/context-pack:
- For coder:
- For validator:
```

## Gate / Stop Condition

- Stop when no credible validation path can be defined from the current evidence and constraints.
- Stop when the task appears to need incident evidence, reproduction detail, or boundary clarification before test strategy can be chosen safely.
- Stop when the only available validation would create false confidence for a high-risk behavior change.

## Red Flags

- Treating all tasks as if they require the same testing pattern
- Using manual checks alone for logic with hidden state, ordering, permissions, or non-trivial regressions
- Skipping reproduction or evidence collection for a bugfix or incident without a clear reason
- Accepting a weak smoke check for behavior that needs deterministic automated coverage
- Claiming validation is complete without documenting environment limits or NOT_RUN reasons

## Exit Criteria

- The selected strategy matches task type and risk
- Required evidence is explicit
- Validation expectations are concrete enough for handoff
- Any NOT_RUN condition is justified with a reason and follow-up expectation
- No global TDD mandate is introduced

## Handoff

- Hand the strategy to planner, context-pack-builder, coder, or validator with the selected approach, required evidence, known commands or manual checks, NOT_RUN conditions, and risks or stop conditions

## Guardrails

- Keep the guidance stack-agnostic and project-neutral.
- Prefer proportionate evidence over rigid process mandates.
- Do not require failing tests first when the environment or task shape makes that impractical, but say so explicitly.
- Do not weaken validation for high-risk logic, permission, state, or event-ordering work.
- Do not name specific test frameworks unless a caller explicitly asks for stack-specific guidance.
- Do not implement code or invent commands that are not grounded in the task context.
