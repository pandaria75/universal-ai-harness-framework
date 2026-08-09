---
description: Start focused incident investigation through the builder-first Marionettist flow
---

Use this command for incident or urgent investigation when the user has symptoms, reports, logs, screenshots, videos, error stacks, communication packets, config, environment details, reproduction notes, or partial analysis.

Incident details:
$ARGUMENTS

Requirements:
- When `marionettist.config.yaml` exists, read `marionettist.language` early and use it for Marionettist user-facing communication only; support `en` and `zh-CN`, fall back to `en` when absent or unknown unless a higher-priority local safety instruction for that Marionettist interaction explicitly requires another language, and preserve identifiers, file paths, YAML keys, command names, and quoted user text.
- Treat this as the normal-user incident wrapper and prefer an incident-first evidence workflow unless another workflow is clearly a better fit.
- Read `.task/active.json` first. If an active task exists, then read `.task/<task-id>/state.json`. Here `<task-id>` is selected by `.task/active.json`.
- Explain the selected workflow in one concise sentence, including any required gate before acting or delegating.
- Create or update `.task/<task-id>/incident.md` as an analysis artifact only.
- Do not treat this command as authorization to code, bugfix, refactor, or change production files.
- Do not skip evidence organization and jump to code changes.
- Keep facts, hypotheses, candidate repair actions, and missing evidence in separate sections.
- Require reproduction evidence or an explicit unavailable/manual/environmental `NOT_RUN` reason before recommending implementation by default.

Incident-first rules:
- If no active task exists, create a dated task directory for the investigation and point `.task/active.json` to it.
- Do not assume local reproduction is available.
- Do not assume site, production, browser, device, packet-capture, or environment access.
- Do not automatically capture terminal logs or any other evidence.
- Use `subagent` with `agent: "marionettist-indexer"` only for read-only repository, docs, rules, ownership, boundary, or suspected-file exploration when that helps organize the incident.
- Treat broad repairs without direct evidence, reproduction, or documented validation constraints as a stop condition unless the user explicitly approves the risk.

Collect and organize only user-provided or explicitly supplied evidence:
- symptoms, impact, and severity clues
- logs
- screenshots or video references
- error stacks or traces
- communication packets, requests, responses, and headers
- relevant config, flags, and feature toggles
- environment, version, deployment, runtime, and device details
- reproduction steps or operator steps
- initial analysis already performed
- suspected modules, files, services, or ownership hints
- explicit unknowns, missing evidence, and blocked observations

Write `.task/<task-id>/incident.md` with at least:
- incident summary
- evidence inventory
- timeline or event sequence if known
- reproduction or operation notes
- initial hypotheses
- confirmed facts separated from assumptions and unknowns
- hypothesis support classification: `confirmed`, `likely`, `possible`, `unknown`, `weakly-supported`, `unsupported`, or `contradicted`
- candidate repair actions with the evidence each action depends on
- before-fix validation and after-fix validation, or `NOT_RUN` reasons when validation is unavailable, manual, or environmental
- needed on-site or user confirmations for each non-confirmed hypothesis
- missing evidence
- forbidden assumptions and non-goals
- recommended next analysis step

Before any next-phase recommendation, explicitly remind the user that incident analysis is not coding authorization.
