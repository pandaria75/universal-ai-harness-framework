# Pi Pathway

The `marionettist-pathway-pi` package exposes Marionettist skills, prompt
templates, seven default agents, and the standard `pi-subagents` runtime to Pi.

## Project-local installation

Install from the target project:

```bash
pi install -l npm:marionettist-pathway-pi
```

Or initialize the framework and package together:

```bash
marionettist init --with-pi
```

Global installation is intentionally unsupported. The package manifest exposes
only a guard extension; skills and prompts are contributed dynamically after the
extension confirms that the nearest `.pi/settings.json` contains the package.

## Resources

- Skills are generated from the framework `skills/` source.
- Prompt templates expose `/marionettist` and the focused Marionettist workflow wrappers.
- The standard `subagent` tool discovers builder, planner, coder, reviewer,
  critic, indexer, and validator as `marionettist-*` package agents.
- Project definitions in `.pi/agents/**/*.md` are discovered recursively. They
  can add arbitrary agents or override a package agent by using the same `name`.
- Calls use the regular `pi-subagents` shape, for example
  `subagent(agent="marionettist-indexer", task="Map the authentication flow")`.

For example, a target project can add `.pi/agents/domain-expert.md`:

```markdown
---
name: domain-expert
description: Understands the project's domain rules and terminology.
tools: read, grep, find, ls
model: deepseek/deepseek-v4-pro
---

Study the relevant project context and answer with evidence from the repository.
```

The main agent can then call `subagent` with `agent: "domain-expert"`. No
package rebuild or extension registration is required.

## Shared configuration

Pi and OpenCode read the same `.marionettist/model-profiles.yml`. During
`marionettist init --with-pi` or `marionettist sync --with-pi`, Marionettist
writes the resolved models to `.pi/settings.json` under
`subagents.agentOverrides`, while preserving other settings and per-agent
options. With direct `pi install`, package agents inherit the active Pi model;
run `marionettist sync --with-pi` when you want the shared per-role model
profiles applied. Pi does not silently replace unavailable model IDs. Run the
following to diagnose package scope and model availability:

```bash
marionettist doctor --with-pi
```

## Lifecycle

```bash
marionettist diff --with-pi
marionettist sync --with-pi
marionettist doctor --with-pi
```

`diff` is read-only. `sync` preserves the recorded Pi pathway and reconciles the
project-local package through Pi's package manager.
