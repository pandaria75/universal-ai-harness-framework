---
name: module-inspector
description: Perform module-level document lookup and boundary analysis for the repository. Use when a task modifies a module, spans multiple modules, involves unfamiliar ownership, or requires dependency or boundary judgment before implementation.
---

# Module Inspector

Use this skill to inspect module ownership, modifiability, dependency direction, and boundary risks before changing code.

`docs/project/knowledge-map.md` is the routing source for relevant docs and rules. Do not duplicate routing tables inside this skill.

## When To Use

- Use when a task modifies a module, spans multiple areas, or needs ownership or boundary analysis before implementation.

## Inputs Required

- Target area, file path, module name, or feature area from the request
- Relevant knowledge-map entries, rules, and nearby boundary docs when needed

## Steps

1. Read `docs/project/knowledge-map.md`.
2. Identify the target module, package, feature area, subsystem, or directory from the request, file paths, names, or knowledge-map entries.
3. Identify related areas, cross-area impact, protected areas, restricted areas, and any ownership notes from the knowledge-map and loaded rules.
4. From the knowledge-map, load only the context needed for the target and involved related areas:
   - repository-level rule files required for the task
   - area-specific rule files for involved scope
   - minimum doc files required for the current task
5. Do not load unrelated docs or rules.
6. Inspect source files only when the knowledge-map and loaded docs are insufficient to determine ownership, modifiability, dependency direction, or boundary risks.
7. If ownership or boundaries remain unclear, state the uncertainty explicitly and inspect only the smallest relevant source area before recommending changes.
8. Output the boundary summary using the required format below.

## Output Artifact

- A module boundary summary covering scope, modifiability, dependency direction, risks, and recommended modification path

## Required Output Format

```md
# Module Boundary Summary

## Module Scope
- Target area:
- Related areas:
- Cross-area impact:

## Modifiability
- Modifiable:
- Restricted areas:
- Forbidden areas:

## Loaded Context

## Dependency Direction

## Boundary Risks

## Recommended Modification Path
1.
2.
3.

## Uncertainty
- Unresolved ownership or boundary uncertainty:
```

## Guardrails

- Do not duplicate knowledge-map content.
- Do not load unrelated docs.
- Do not treat docs as stronger than rules.
- Use `docs/project/knowledge-map.md` as the routing authority for rule and doc paths.
- When the task spans multiple areas, load every applicable rule file for the involved areas, but load only the minimum doc files required for the current task.
- When adding, moving, renaming, or deleting docs or rules, update `docs/project/knowledge-map.md`.
- Do not implement code.

## Gate / Stop Condition

- Stop when module ownership, allowed scope, or dependency direction remains too unclear to recommend a safe modification path.

## Red Flags

- Cross-area impact without clear boundary rules
- Restricted or forbidden areas that the task seems to require changing
- Dependency direction that would be reversed by the proposed change
- Uncertainty that would force broad source inspection

## Exit Criteria

- Target and related areas are identified
- Modifiable, restricted, and forbidden areas are explicit
- Boundary risks and dependency direction are summarized
- Uncertainty is stated when boundaries are still unresolved

## Handoff

- Hand the summary to implementation-slicer, context-pack-builder, or the caller with the recommended modification path and any unresolved boundary questions
