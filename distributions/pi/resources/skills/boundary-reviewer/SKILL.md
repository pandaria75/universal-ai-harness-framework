---
name: boundary-reviewer
description: Review code changes for boundary violations, rule conflicts, unintended scope expansion, missing validation, and documentation sync requirements. Use after implementation and before commit.
phase: review
model_requirement: reflective
can_edit: false
risk_level: medium
---

# Boundary Reviewer

Use this skill after code changes and before commit or handoff.

This skill is primarily a boundary, scope, rules, and validation reviewer. For higher-risk work, it may also include a distinct second review dimension for implementation quality, but it should not turn every review into a full heavyweight code review by default.

## Workflow

1. Inspect the current diff.
2. Read `AGENTS.md`.
3. Read `.task/active.json`, `.task/<task-id>/state.json`, and `.task/<task-id>/context-pack.md` if present. Here `<task-id>` is selected by `.task/active.json`.
4. Read `docs/project/knowledge-map.md`.
5. Read relevant rules and docs for changed areas.
6. Determine review depth from the active task context:
   - Use the standard boundary-focused review by default.
   - Use two review dimensions only when the task context, rules, or reviewer instructions explicitly mark the work as high-risk, Tier L, architecture-sensitive, or otherwise requiring stricter review.
   - Keep any second review dimension distinct from pre-done critic evidence audit work; do not treat critic findings as a substitute for this review, and do not repeat the critic's role as a pre-done gate evidence checker.
7. Check boundary/spec/scope/rule/validation compliance:
   - allowed scope vs actual changed files
   - forbidden scope violations
   - protected area modifications
   - spec or requirement drift relative to the approved slice, group, or task context
   - dependency direction
   - architecture-sensitive changes
   - SQL or data migration risks
   - parallel group shared files, merge owner, fallback order, and group validation when applicable
   - Marionettist gate compliance for analysis, coding slice/group, and review transitions
   - rule conflicts
   - missing validation
   - docs, rules, or knowledge-map sync needs
8. When the task explicitly requires higher-risk or Tier L review, also check implementation quality in a separate dimension:
   - code quality and maintainability concerns that materially affect the approved slice
   - implementation clarity and fitness for the stated requirement
   - test quality and whether tests or checks meaningfully cover the changed behavior
   - avoid duplicating a full general-purpose review when the task does not require it
9. Output review findings only.
10. Do not modify code unless explicitly asked.

## Diff Sources

Prefer these git sources when reviewing changes:
- `git status --short`
- `git diff --stat`
- `git diff`
- `git diff --staged` when staged changes are present

If git is unavailable, state the limitation explicitly in the review output.

## Blocking Criteria

Return `BLOCKED` when:
- a forbidden file or area was modified
- a protected area was modified without explicit user approval
- actual changes exceed `.task/<task-id>/context-pack.md` allowed scope
- a rule in `AGENTS.md` or `.aiassistant/rules` is violated
- destructive SQL or migration risk is detected without explicit approval
- required validation is missing for architecture-sensitive changes
- parallel group work touched shared files without a declared merge owner or conflict resolution rule
- current changes show the task crossed a required Marionettist gate without explicit user confirmation

Do not block solely for code-quality or maintainability observations unless the task explicitly requires the higher-risk second review dimension and the issue creates material release, correctness, safety, or supportability risk.

## Output Format

```md
# Boundary Review Result

## Summary

## Changed Scope

## Violations

### Violation 1
- File:
- Rule:
- Risk:
- Required Fix:

## Warnings

## Missing Validation

## Review Dimensions

- Boundary / Spec / Scope / Rules / Validation:
- Code Quality / Maintainability / Implementation / Test Quality:

## Parallel Group Check

- Applicable:
- Shared Files:
- Merge Owner:
- Fallback Order:
- Group Validation:
- Issues:

## Marionettist Gate Check

## Documentation Sync Needed

## Final Recommendation

Final recommendation must be one of:

- PASS
- PASS_WITH_WARNINGS
- BLOCKED
```

## Guardrails

- Do not modify code during review.
- Treat rules as constraints and docs as knowledge.
- Do not expand the task scope.
- Keep the boundary-reviewer and critic roles distinct. The critic is not a duplicate code reviewer, and this skill is not a pre-done evidence-audit substitute.
- For non-high-risk work, keep the review lightweight and boundary-focused unless stronger instructions require more.
- If a violation is uncertain, report a warning instead of inventing a violation.
