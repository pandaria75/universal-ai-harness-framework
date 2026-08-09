# Marionettist Framework Agent Guide

## Purpose

This repository maintains the reusable Marionettist framework used to initialize and upgrade Marionettist files in other projects.

This file governs work on the framework itself. It is not the same as `templates/AGENTS.md`, which is installed into target projects.

## Core Principles

- Keep framework core project-neutral.
- Do not add business-project-specific knowledge to templates, core skills, or CLI defaults.
- Do not hard-code module names, customer names, domain terms, technology stacks, or validation commands from a source project.
- Prefer configuration-driven behavior through `marionettist.config.yaml`.
- Keep target-project installation safe, repeatable, and reversible.

## Repository Layout

- `bin/` contains CLI entrypoints.
- `src/commands/` contains command implementations: `init` (with interactive prompts from `init-prompts`), `sync`, `diff`, and `doctor`.
- `src/core/` contains reusable CLI helpers: `plan` (builds install/sync plans), `manifest` (reads/writes `.marionettist/manifest.json`), `managed-block` (split-ownership markers in `AGENTS.md`), `template` (variable rendering), `apply-plan` (writes plan operations), `hash`, `args`, `cli`, `files`, and `framework-paths`.
- `templates/` contains files installed into target projects.
- `skills/` contains framework-managed agent skills copied into target projects.

## Template Policy

- `templates/AGENTS.md` defines target-project agent behavior.
- Root `AGENTS.md` defines framework maintenance behavior.
- Framework self-bootstrap behavior belongs in `.marionettist/self/` and self OpenCode files, not target-project templates.
- `templates/core/` and `templates/pathways/` are the framework source roots for shared and Pathway-specific template content.
- `templates/pathways/opencode/` is the source of truth for target-project OpenCode agents, commands, plugin assets, and package staging inputs.
- Root `.opencode/` may contain both self-only files and generated mirrors from the active framework OpenCode source candidates for local framework maintenance.
- Template files must not assume a specific language, build tool, backend framework, frontend framework, or module layout.
- Template files may reference `marionettist.config.yaml` as the target-project source of local configuration.
- Managed template sections must be safe for `marionettist sync` to update without overwriting project-local sections.

## Skill Policy

- Core skills must be agent-neutral and usable from Codex, Gemini CLI, OpenCode, or any agent that can read Markdown context.
- Skills must not depend on private MCP implementations.
- Skills may instruct agents to prefer available IDE or local search tools for code lookup.
- `workspace-knowledge-manager` must generate design and architecture knowledge, not code index directories.
- Code indexes, symbol lookup, call-site lookup, and implementation navigation belong to IDE MCP or local search tools, not project docs.

## CLI Policy

- `marionettist init` must be safe by default and must not overwrite existing project-local content without an explicit force option.
- Do not use regular `marionettist init` to bootstrap this framework repository; use `marionettist self init --apply` or `marionettist self init --apply --with-opencode`.
- Regular target-project `marionettist init --with-opencode` and framework `marionettist self init --apply --with-opencode` are separate paths with separate OpenCode content.
- `marionettist sync` must update framework-managed files while preserving project-local docs, rules, skills, and task files.
- `marionettist diff` must show what would change before sync.
- Destructive behavior is forbidden unless explicitly requested by the user and implemented behind clear flags.

## Version And Release Policy

When preparing a version bump or release, update all repository version sources together:

- `VERSION`
- root `package.json`
- root `package-lock.json`
- `distributions/opencode/package.json` when releasing `marionettist-pathway-opencode`
- `distributions/pi/package.json` when releasing `marionettist-pathway-pi`

Before publishing, verify that generated or staged release assets are current, including `distributions/opencode/README.md` and `distributions/opencode/templates/**` when the OpenCode pathway package is affected.

## Validation

When changing CLI code, run the relevant Node command or smoke test.

When changing self-bootstrap or OpenCode boundary logic, run:
- `npm run smoke`
- `npm run self:smoke`

When changing the Pi pathway, also run `npm run pi:dist:check`, the Pi distribution tests, and `npm pack --dry-run ./distributions/pi`.

When changing templates or skills, validate that:
- no project-specific terms leaked into core assets
- target-project install paths remain consistent
- sync behavior still preserves project-local content

## Guardrails

- Do not implement broad behavior changes without updating templates and docs consistently.
- When a task comes from GitHub issues, add a completion summary comment to the relevant issue(s) before closing the task; include what changed, validation results, residual risks, and follow-up impact for related issues.
- Do not mix framework-maintenance rules with target-project Marionettist rules.
- Do not put self-only OpenCode commands, agents, or policy into `templates/AGENTS.md`, publishable template source roots, or `skills/`.
- Do not edit generated `.opencode/agents/marionettist-*.md`, `.opencode/agents/validators/**`, or `.opencode/commands/marionettist-*.md` directly; edit the active framework OpenCode source files in `templates/pathways/opencode/**`, then rerun `marionettist self init --apply --with-opencode`.
- Do not treat generated target-project docs as code indexes.
