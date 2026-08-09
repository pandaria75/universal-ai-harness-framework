---
description: Start focused docs or rules work through the builder-first Marionettist flow
---

I want help with docs, rules, or project knowledge work.

Target area:
$1

Task:
$2

Requirements:
- When `marionettist.config.yaml` exists, read `marionettist.language` early and use it for Marionettist user-facing communication only; support `en` and `zh-CN`, fall back to `en` when absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language, and preserve identifiers, file paths, YAML keys, command names, and quoted user text.
- Treat this as the normal-user docs wrapper.
- Prefer docs-oriented routing unless another workflow is clearly a better fit.
- Explain the selected workflow in one concise sentence, including any required gate before acting or delegating.
- Docs should explain responsibilities, design, workflows, boundaries, and extension points.
- Rules should express behavioral constraints and may include metadata such as `type`, `confidence`, and `source`; do not treat `observed` or `target` rules as hard constraints by default.
- Do not duplicate content between docs and rules.
- If docs or rules are added, moved, renamed, or deleted, update `docs/project/knowledge-map.md` as well.
