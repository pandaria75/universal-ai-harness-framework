# Marionettist Pi Pathway

This pathway packages the Marionettist skills, prompt workflows, and seven fixed
subagent roles for project-local Pi installations.

Install it from the target project only:

```bash
pi install -l npm:marionettist-pathway-pi
```

The extension intentionally keeps skills, prompts, and subagent tools disabled
unless the package is present in the nearest project `.pi/settings.json`.
