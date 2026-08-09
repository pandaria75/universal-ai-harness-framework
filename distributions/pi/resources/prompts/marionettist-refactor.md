---
description: Start Marionettist workflow for a refactor task
---

I want to perform a refactor task:

$ARGUMENTS

Follow the current repository Marionettist workflow.
When `marionettist.config.yaml` exists, read `marionettist.language` early and use it for Marionettist user-facing communication only; support `en` and `zh-CN`, fall back to `en` when absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language, and preserve identifiers, file paths, YAML keys, command names, and quoted user text.
Analyze boundaries and workflow impact first.
When intaking non-trivial work, surface Marionettist gate policy choices `strict`, `balanced`, and `autonomous`, including config `gatePolicy.defaultMode` when available, the recommended policy, and any allowed task-local selection.
If task-local override is allowed, capture `gatePolicy.selected` distinctly from the default and recommendation instead of silently defaulting.
Use `marionettist-indexer` for ownership, docs, rules, and call-path exploration.
Use `marionettist-planner` to create small implementation slices and validation strategy after scope is clear.
Do not code directly.
After the user confirms analysis is complete, orchestrate the approved slice through `marionettist-coder` and `marionettist-reviewer`.
