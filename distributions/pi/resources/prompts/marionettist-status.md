---
description: Show current Marionettist task state without modifying files
---

Read `.task/active.json` first, then read `.task/<task-id>/state.json` if an active task exists. Here `<task-id>` is selected by `.task/active.json`.

When available, also read `marionettist.config.yaml` so gate policy can be reported with its config `defaultMode`. Treat Marionettist gate policy separately from Pi permission settings.

When `marionettist.config.yaml` exists, also read `marionettist.language` early and use it for Marionettist user-facing communication only. Support `en` and `zh-CN`; fall back to `en` when the value is absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language. Preserve identifiers, file paths, YAML keys, command names, and quoted user text.

Output only the current task status. Do not modify files and do not code.

If no active task exists, tell the user to start with one of:
- `/marionettist`
- `/marionettist-dev`
- `/marionettist-incident`
- `/marionettist-docs`

Report:
- Task
- Type
- Phase
- Allowed To Code
- Current Slice
- Last Gate
- Next Command
- Gate policy: config default, recommended, selected, effective, whether override appears allowed, and `finalApprovalRequired`
- Required files and whether each exists
- Warnings

Do not guess missing state. If state is incomplete, name the missing field and suggest the smallest repair.
