---
description: Start focused development work through the builder-first Marionettist flow
---

I want help with development or implementation work:

$ARGUMENTS

Requirements:
- When `marionettist.config.yaml` exists, read `marionettist.language` early and use it for Marionettist user-facing communication only; support `en` and `zh-CN`, fall back to `en` when absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language, and preserve identifiers, file paths, YAML keys, command names, and quoted user text.
- Treat this as the normal-user development wrapper.
- Prefer the development workflow unless the request clearly fits another workflow better.
- Explain the selected workflow in one concise sentence, including any required gate before acting or delegating.
- Keep the request broad enough to cover feature, build, or implementation work without forcing a low-level command choice.
- Do not skip analysis, critic, review, validation, or human-confirmation gates.
- For non-trivial task intake, surface gate policy choices `strict`, `balanced`, and `autonomous`, including config `defaultMode` when available and the recommended policy for the task.
- If task-local override is allowed, capture the selected task policy explicitly instead of silently defaulting.
