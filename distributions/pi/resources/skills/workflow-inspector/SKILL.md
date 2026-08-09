---
name: workflow-inspector
description: Analyze repository flows, execution chains, orchestration paths, event-driven behavior, and frontend-backend integration paths. Use when a task involves process design, workflow-sensitive behavior, call-chain analysis, or cross-boundary flow impact.
---

# Workflow Inspector

Use this skill to inspect execution chains and workflow impact. It should output workflow context, not a full implementation plan.

## When To Use

- Use when the task is mainly about execution flow, call chain, orchestration, event-driven behavior, or cross-boundary workflow impact.

## Inputs Required

- Known entrypoint clues such as routes, jobs, actions, listeners, or integration boundaries
- Relevant docs, rules, filenames, or task evidence when available

## Steps

1. Identify the likely functional entrypoint:
   - controller, route, or API endpoint
   - service or use case entrypoint
   - stage, job, worker, or task runner
   - event publisher or event listener
   - frontend action or state transition
   - integration or message boundary
2. Read `docs/project/knowledge-map.md` when ownership, cross-area scope, or relevant docs/rules routing is unclear.
3. Load only docs and rules relevant to the identified flow and involved areas.
4. Do not duplicate knowledge-map indexes inside this skill.
5. Inspect source files only after identifying the likely area and flow boundary.
6. Output workflow context only.
7. If the entrypoint or flow cannot be determined from docs and filenames, state the uncertainty explicitly and inspect the smallest relevant source area.

## Output Artifact

- A workflow inspection result covering the entrypoint, execution chain, involved areas, impact range, risks, and uncertainty

## Required Output Format

```md
# Workflow Inspection Result

## Entrypoint

## Execution Chain

## Involved Areas

## Key Nodes

## Impact Range

## Recommended Modification Order

## Risks And Boundary Constraints

## Uncertainty
```

## Boundary With Other Skills

- Use module-inspector when the task is mainly about area ownership or modifiability.
- Use workflow-inspector when the task is mainly about execution flow, call chain, orchestration, event-driven behavior, or frontend-backend integration.
- If both apply:
  1. Use workflow-inspector to identify the execution chain.
  2. Use module-inspector only for areas that need modification.
- This skill should output workflow context, not a full implementation plan.
- Use implementation-slicer after this skill if coding is required.

## Guardrails

- Do not create code indexes.
- Do not inspect unrelated flows.
- Do not produce a full implementation plan.
- Use implementation-slicer after this skill if coding is required.
- Do not implement code.

## Gate / Stop Condition

- Stop when the likely entrypoint or execution chain cannot be identified safely from available evidence.
- Stop before turning workflow analysis into a plan or code change.

## Red Flags

- Multiple plausible entrypoints with no strong evidence
- Workflow changes that cross protected or unfamiliar boundaries
- Analysis drifting into broad code indexing or implementation planning
- Missing rules for integration or orchestration boundaries

## Exit Criteria

- The likely entrypoint and execution chain are summarized
- Involved areas and impact range are bounded
- Risks and boundary constraints are explicit
- Uncertainty is recorded where the flow is still unresolved

## Handoff

- Hand the workflow summary to module-inspector, implementation-slicer, context-pack-builder, or the caller depending on the next approved step
