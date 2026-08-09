---
description: Generate or update the current task context pack
---

Use `context-pack-builder`.
Use `marionettist-planner` first if the current slice, validation commands, or stop conditions are not clear enough.

Requirement source:
$1

Implementation source:
$2

Current slice:
$3

Output:
`.task/<task-id>/context-pack.md`, where `<task-id>` is read from `.task/active.json`.

Requirements:
- When `marionettist.config.yaml` exists, read `marionettist.language` early and use it for Marionettist user-facing communication only; support `en` and `zh-CN`, fall back to `en` when absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language, and preserve identifiers, file paths, YAML keys, command names, and quoted user text.
- Keep the context pack compact.
- Include only what is needed for the current coding slice.
- Include visible gate policy state when available: config `defaultMode`, recommended policy, selected policy, effective policy, and `finalApprovalRequired`.
- If task-local override is allowed and `selected` is still missing at a decision point, surface the available choices `strict`, `balanced`, and `autonomous` instead of silently defaulting when the task still needs an explicit selection.
- State allowed modification scope.
- State forbidden modification scope.
- State validation commands.
- State stop conditions.
- Do not code.
- If `.task/active.json` is missing, do not guess a task path; ask the user to start or select a task first.
- If legacy `.task/context-pack.md` exists, use it only as migration fallback and recommend moving context into the active task directory.
