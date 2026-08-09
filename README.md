# Marionettist

[中文版](./README.zh-CN.md)

Marionettist is a reusable, file-based workflow for safer AI-assisted development in any repository.

It gives AI agents and human teams a shared contract: where rules live, how task context is prepared, when coding may start, and where the agent must stop for approval.

Marionettist currently remains focused on practical Agent Harness behavior, with optional OpenCode and project-local Pi pathway packages.

## What Marionettist Is

Marionettist helps teams move important AI-workflow context out of chat and into repository files.

Use it when you want:

- repository-local rules and onboarding files
- task context prepared before coding starts
- explicit approval gates for non-trivial work
- framework-managed updates that preserve local project content

## If You Are Here To...

- **Add Marionettist to a target project:** start with [Install](#install) and [For target-project teams](#for-target-project-teams).
- **Understand the workflow first:** read [What Problem It Solves](#what-problem-it-solves), then [Read Next](#read-next).
- **Maintain this framework repository itself:** jump to [For framework maintainers of this repo](#for-framework-maintainers-of-this-repo).

## What Problem It Solves

AI-assisted work often fails for simple reasons:

- the agent forgets constraints from earlier messages
- project knowledge stays in chat instead of the repository
- scope expands silently during implementation
- reviews happen too late or against unclear requirements
- upgrades to agent prompts overwrite local team rules

This framework moves the important parts into normal files. They can be read by any agent, reviewed in Git, and upgraded safely.

If you want the beginner-friendly workflow philosophy behind planning, gates, slices, and project-neutral design, read [docs/philosophy.md](./docs/philosophy.md).

## Highlights

- **Repository-local contract.** `AGENTS.md`, rules, docs, task state, and manifests are plain files.
- **Agent-neutral workflow.** The method works with any agent that can read Markdown and edit files.
- **Explicit gates.** Non-trivial work stops after analysis and after each approved slice.
- **Task context before coding.** Agents prepare compact context packs instead of coding from chat alone.
- **Safe sync.** `marionettist diff` previews changes; `marionettist sync` updates managed assets while preserving local work.
- **Optional OpenCode support.** Slash commands and role agents improve ergonomics, but Marionettist does not depend on OpenCode.
- **Project-local Pi support.** A Pi package installs skills, prompt workflows, and seven fixed Marionettist subagents without global activation.
- **Shared model tiering.** OpenCode and Pi consume the same `.marionettist/model-profiles.yml` profiles.

## Install

```powershell
# From GitHub
npm install -g github:pandaria75/marionettist

# Or from a local clone of this framework repo
npm link
```

## For Target-Project Teams

Run these commands inside a target project:

```powershell
# Preview what will be installed
marionettist init --dry-run

# Install Marionettist interactively
marionettist init

# Optional: install OpenCode commands and agents too
marionettist init --with-opencode

# Optional: initialize and install the project-local Pi pathway
marionettist init --with-pi

# Or install only the Pi package in an already initialized project
pi install -l npm:marionettist-pathway-pi
```

The Pi pathway is project-local only. A global `pi install npm:marionettist-pathway-pi` remains disabled and reports the correct `-l` installation command.

After init, the target project gets files such as:

- `AGENTS.md` for repository-agent behavior
- `marionettist.config.yaml` for local Marionettist settings
- `docs/project/*` for workflow and knowledge routing
- `.aiassistant/rules/*` for constraints
- `.agents/skills/*` for portable workflow skills
- `.marionettist/manifest.json` for safe upgrades

This repository is the framework source, but the normal day-to-day user path is: install Marionettist into your own repository, review the installed files, then follow the target project's local `AGENTS.md` and docs.

## Typical First Run

Without OpenCode, give your agent a prompt like this:

```text
Follow this repository's Marionettist workflow.

Task: Add a small user-facing feature: <describe the change>.

Start with task intake and context preparation.
Do not start coding until the analysis gate is approved.
```

With OpenCode installed, start from the builder command:

```text
/marionettist Add a small user-facing feature: <describe the change>
```

The agent should classify the task, prepare the needed context, stop at the analysis gate, and wait for approval before coding.

## Common Commands For Target Projects

```powershell
# Preview framework updates
marionettist diff

# Apply safe managed updates
marionettist sync

# Diagnose an installed Marionettist setup
marionettist doctor
```

For more install modes, command-surface options, task tiers, and gate behavior, see the usage guide.

## For Framework Maintainers Of This Repo

This repository is the **framework source**, not a normal target project.

- Use `marionettist self init --apply` when maintaining this framework repo.
- Use `marionettist self doctor` and `marionettist self test` for self-maintenance checks.
- Do not run regular `marionettist init` here as if this were a target project.
- `templates/` and `skills/` are publishable assets for target projects.
- `.marionettist-self/` is disposable local runtime state.
- OpenCode is optional. The core Marionettist workflow works through files and prompts.

## Read Next

| Document | Best For | What It Covers |
| --- | --- | --- |
| [docs/user-guide/README.md](./docs/user-guide/README.md) | New users adopting Marionettist | Recommended reading path and user guide entry |
| [docs/philosophy.md](./docs/philosophy.md) | Beginners evaluating the workflow | Why Marionettist plans before coding, uses gates, and stays project-neutral |
| [docs/DESIGN.md](./docs/DESIGN.md) | Tech leads, architects, framework evaluators | Design ideas, workflow philosophy, asset ownership, non-goals |
| [docs/GUIDELINES.md](./docs/GUIDELINES.md) | Teams adopting Marionettist | Installation, daily usage, task tiers, gates, upgrades |
| [docs/OPENCODE.md](./docs/OPENCODE.md) | Teams using OpenCode | Slash commands, agent roles, model profiles, permission posture |
| [docs/PI.md](./docs/PI.md) | Teams using Pi | Project-local package, workflows, fixed subagents, shared model profiles |
| [docs/develop/00-next-stage-vision.md](./docs/develop/00-next-stage-vision.md) | Maintainers planning future work | Quill dogfooding, Pi adapter exploration, delayed shared-foundation strategy |
