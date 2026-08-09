---
description: Start Marionettist or project configuration work through the builder-first flow
---

I want help with Marionettist or project workflow configuration:

$ARGUMENTS

Requirements:
- When `marionettist.config.yaml` exists, read `marionettist.language` early and use it for Marionettist user-facing communication only; support `en` and `zh-CN`, fall back to `en` when absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language, and preserve identifiers, file paths, YAML keys, command names, and quoted user text.
- Treat this as the normal-user configuration wrapper.
- Prefer configuration-oriented routing for Marionettist-managed setup, workflow, agent, rule, tasking, or Pi-related config work unless another workflow is clearly a better fit.
- When the request describes Tier-policy changes in natural language, draft candidate `.marionettist/tier-policy.yml` content, show a diff before any write, and require explicit confirmation before persistence.
- For Tier-policy authoring, use the existing builder/config workflow rather than inventing a new command unless a future approved design adds one.
- Explain the selected workflow in one concise sentence, including any required gate before acting or delegating.
- Keep the request project-neutral.
- Do not skip analysis, critic, review, validation, or human-confirmation gates.
- For non-trivial task intake, surface Marionettist gate policy choices `strict`, `balanced`, and `autonomous`, including config `defaultMode` when available and the recommended policy for the task.
- If task-local override is allowed, capture the selected task policy explicitly instead of silently defaulting.
