---
description: Start from the unified builder-first Marionettist entrypoint
---

Use this as the default Marionettist command.

User request:
$ARGUMENTS

Requirements:
- When `marionettist.config.yaml` exists, read `marionettist.language` early and use it for Marionettist user-facing communication only; support `en` and `zh-CN`, fall back to `en` when absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language, and preserve identifiers, file paths, YAML keys, command names, and quoted user text.
- Treat this as a builder-first natural-language entrypoint.
- First classify the intent and choose the smallest matching Marionettist workflow.
- Explain the selected workflow in one concise sentence, including any required gate before acting or delegating.
- Ask only minimal clarifying questions when ambiguity blocks safe progress.
- Keep the command project-neutral and preserve normal Marionettist gates.
- When starting or intaking non-trivial work, surface Marionettist gate policy choices separately from Pi permissions: report config `gatePolicy.defaultMode` when available, the recommended policy for the task, and the available choices `strict`, `balanced`, and `autonomous`.
- If task-local gate-policy override is allowed, capture the user's selected policy for the task instead of silently defaulting; record recommended versus selected distinctly.

Supported intent examples include development, bugfix, incident, docs, config, review, validation, status, continuation, and context-pack requests.
