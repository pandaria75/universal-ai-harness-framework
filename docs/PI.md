# Pi Pathway

The `marionettist-pathway-pi` package exposes Marionettist skills, prompt
templates, and seven fixed subagent roles to Pi.

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
- `marionettist_subagent` accepts only builder, planner, coder, reviewer, critic,
  indexer, and validator roles.
- Child agents run as isolated Pi processes and cannot recursively delegate.

## Shared configuration

Pi and OpenCode read the same `.marionettist/model-profiles.yml`. Pi does not
silently replace unavailable model IDs. Run the following to diagnose package
scope and model availability:

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
