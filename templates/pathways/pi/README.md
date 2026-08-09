# Marionettist Pi Pathway

This pathway packages the Marionettist skills, prompt workflows, seven default
agents, and the `pi-subagents` runtime for project-local Pi installations.

Install it from the target project only:

```bash
pi install -l npm:marionettist-pathway-pi
```

The package uses `pi-subagents` for dynamic agent discovery and orchestration.
Its seven built-in Marionettist agents are package defaults; project definitions
in `.pi/agents/**/*.md` can add new agents or override them by name.

Package agents inherit the active Pi model after direct installation. Running
`marionettist init --with-pi` or `marionettist sync --with-pi` maps the shared
`.marionettist/model-profiles.yml` values into project `agentOverrides`.

The extension intentionally keeps skills, prompts, and the `subagent` runtime
disabled unless the package is present in the nearest project `.pi/settings.json`.

If `pi-subagents` is already configured at the user or project scope, the
pathway reuses that runtime rather than registering duplicate `subagent` tools.
