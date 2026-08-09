---
description: Start Marionettist workflow for a feature request
---

I want to develop a new requirement:

$ARGUMENTS

Follow the current repository Marionettist workflow.
When `marionettist.config.yaml` exists, read `marionettist.language` early and use it for Marionettist user-facing communication only; support `en` and `zh-CN`, fall back to `en` when absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language, and preserve identifiers, file paths, YAML keys, command names, and quoted user text.
Run `task-intake` first.
Create a dated task directory for non-trivial work and point `.task/active.json` to it.
When intaking non-trivial work, surface Marionettist gate policy choices `strict`, `balanced`, and `autonomous`, including config `gatePolicy.defaultMode` when available, the recommended policy, and any allowed task-local selection.
If task-local override is allowed, capture `gatePolicy.selected` distinctly from the default and recommendation instead of silently defaulting.
Use `subagent` with `agent: "marionettist-indexer"` for repository, module, docs, rules, or workflow exploration when scope is unclear.
Use `subagent` with `agent: "marionettist-planner"` when implementation slicing, validation strategy, or context-pack planning is needed.
If needed, create the requirement document and implementation plan later.
Do not code directly.
Do not skip analysis gates.
After the user confirms analysis is complete, orchestrate the approved slice through `subagent` with `agent: "marionettist-coder"` and `subagent` with `agent: "marionettist-reviewer"`.
