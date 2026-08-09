---
description: Start Marionettist workflow for a bug fix
---

I want to fix a bug. Follow the current repository bugfix Marionettist workflow.

Observed behavior:
$1

Expected behavior:
$2

Reproduction steps:
$3

Evidence:
$4

Affected scope:
$5

Requirements:
- When `marionettist.config.yaml` exists, read `marionettist.language` early and use it for Marionettist user-facing communication only; support `en` and `zh-CN`, fall back to `en` when absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language, and preserve identifiers, file paths, YAML keys, command names, and quoted user text.
- First decide whether `workflow-inspector` or `module-inspector` is needed.
- Create a dated task directory for non-trivial work and point `.task/active.json` to it.
- When intaking non-trivial work, surface Marionettist gate policy choices `strict`, `balanced`, and `autonomous`, including config `gatePolicy.defaultMode` when available, the recommended policy, and any allowed task-local selection.
- If task-local override is allowed, capture `gatePolicy.selected` distinctly from the default and recommendation instead of silently defaulting.
- Use `subagent` with `agent: "marionettist-indexer"` for repository, docs, rules, knowledge, boundary, or call-path exploration when evidence is incomplete.
- Use `subagent` with `agent: "marionettist-planner"` only when the bugfix needs an implementation slice, validation strategy, or context-pack planning.
- Do not use `requirement-freezer` by default.
- Only use `requirement-freezer` when expected behavior or business rules are unclear.
- Create `.task/<task-id>/context-pack.md` before coding, where `<task-id>` is selected by `.task/active.json`.
- Do not code directly.
- After the user confirms analysis is complete, orchestrate the approved slice through `subagent` with `agent: "marionettist-coder"` and `subagent` with `agent: "marionettist-reviewer"`.
