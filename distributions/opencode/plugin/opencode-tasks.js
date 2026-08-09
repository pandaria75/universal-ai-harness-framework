import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageSkillPath = fileURLToPath(new URL("../pathway-skills", import.meta.url)).split(path.sep).join("/");
const registerPackagedStandardSurface = true;

const builtInProfileDefaults = {
  think: {
    default: "openai/gpt-5.5",
    temperature: 0.1,
    agentOverrides: {}
  },
  build: {
    default: "openai/gpt-5.4",
    temperature: 0.1,
    agentOverrides: {}
  },
  review: {
    default: "deepseek/deepseek-v4-pro",
    temperature: 0,
    agentOverrides: {}
  },
  run: {
    default: "deepseek/deepseek-v4-flash",
    temperature: 0,
    agentOverrides: {}
  }
};

const permissionModeWarnings = {
  default: "Default mode preserves the current per-agent OpenCode permission behavior.",
  moderate: "Moderate mode reduces routine prompt friction where the schema supports it, while keeping dangerous-command expectations explicit.",
  loose: "Loose mode is the broadest supported per-agent policy and must retain visible risk warnings because schema-level dangerous-command matching remains limited."
};

const dangerousCommandBaselineWarning = [
  "Dangerous command baseline: treat destructive shell actions as high-risk even when OpenCode permission schema cannot match them directly.",
  "Require explicit user confirmation before force-push, history rewrite, destructive delete/overwrite, publish/release/deploy, project-external writes, global tool or git config mutation, or risky shell pipes/chains that can hide side effects.",
  "When schema-level command filters cannot express a risky pattern, enforce the baseline through prompt text, reviewer guidance, and operator warnings instead of silently broadening autonomy."
].join(" ");

const schemaLimitationWarning = "OpenCode agent permission schema is tool-level, not command-pattern-level, so dangerous bash subcommands and shell compositions must still be constrained by prompt instructions and review guidance.";

const permissionPolicies = {
  default: {
    "marionettist-builder": {
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-planner": "allow",
        "marionettist-critic": "allow",
        "marionettist-coder": "allow",
        "marionettist-reviewer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-planner": { edit: "allow", bash: "allow", webfetch: "ask", task: "deny" },
    "marionettist-coder": {
      edit: "allow",
      bash: "allow",
      webfetch: "ask",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-reviewer": {
      edit: "deny",
      bash: "allow",
      webfetch: "ask",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-critic": {
      edit: "deny",
      bash: "allow",
      webfetch: "ask",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-indexer": { edit: "deny", bash: "allow", webfetch: "ask", task: "deny" },
    "marionettist-validator": {
      edit: "deny",
      bash: "allow",
      webfetch: "deny",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow"
      }
    }
  },
  moderate: {
    "marionettist-builder": {
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-planner": "allow",
        "marionettist-critic": "allow",
        "marionettist-coder": "allow",
        "marionettist-reviewer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-planner": { edit: "allow", bash: "allow", webfetch: "allow", task: "deny" },
    "marionettist-coder": {
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-reviewer": {
      edit: "deny",
      bash: "allow",
      webfetch: "allow",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-critic": {
      edit: "deny",
      bash: "allow",
      webfetch: "allow",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-indexer": { edit: "deny", bash: "allow", webfetch: "allow", task: "deny" },
    "marionettist-validator": {
      edit: "deny",
      bash: "allow",
      webfetch: "deny",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow"
      }
    }
  },
  loose: {
    "marionettist-builder": {
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-planner": "allow",
        "marionettist-critic": "allow",
        "marionettist-coder": "allow",
        "marionettist-reviewer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-planner": { edit: "allow", bash: "allow", webfetch: "allow", task: "deny" },
    "marionettist-coder": {
      edit: "allow",
      bash: "allow",
      webfetch: "allow",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-reviewer": {
      edit: "deny",
      bash: "allow",
      webfetch: "allow",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-critic": {
      edit: "deny",
      bash: "allow",
      webfetch: "allow",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow",
        "marionettist-validator": "allow"
      }
    },
    "marionettist-indexer": { edit: "deny", bash: "allow", webfetch: "allow", task: "deny" },
    "marionettist-validator": {
      edit: "deny",
      bash: "allow",
      webfetch: "ask",
      task: {
        "*": "deny",
        "marionettist-indexer": "allow"
      }
    }
  }
};

const agentDefinitions = [
  {
    name: "marionettist-builder",
    file: "../templates/agents/marionettist-builder.md",
    profile: "think",
    variablePrefix: "HARNESS_BUILDER",
    overrideAliases: ["marionettist-builder", "harness-builder"]
  },
  {
    name: "marionettist-planner",
    file: "../templates/agents/marionettist-planner.md",
    profile: "think",
    variablePrefix: "HARNESS_PLANNER",
    overrideAliases: ["marionettist-planner", "harness-planner"]
  },
  {
    name: "marionettist-coder",
    file: "../templates/agents/marionettist-coder.md",
    profile: "build",
    variablePrefix: "HARNESS_CODER",
    overrideAliases: ["marionettist-coder", "harness-coder"]
  },
  {
    name: "marionettist-reviewer",
    file: "../templates/agents/marionettist-reviewer.md",
    profile: "review",
    variablePrefix: "HARNESS_REVIEWER",
    overrideAliases: ["marionettist-reviewer", "harness-reviewer"]
  },
  {
    name: "marionettist-critic",
    file: "../templates/agents/marionettist-critic.md",
    profile: "review",
    variablePrefix: "HARNESS_CRITIC",
    overrideAliases: ["marionettist-critic", "harness-critic"]
  },
  {
    name: "marionettist-indexer",
    file: "../templates/agents/marionettist-indexer.md",
    profile: "run",
    variablePrefix: "HARNESS_INDEXER",
    overrideAliases: ["marionettist-indexer", "harness-indexer"]
  },
  {
    name: "marionettist-validator",
    file: "../templates/agents/marionettist-validator.md",
    profile: "run",
    variablePrefix: "HARNESS_VALIDATOR",
    overrideAliases: ["marionettist-validator", "harness-validator"]
  },
  {
    name: "marionettist-pathway-prototype",
    description: "OpenCode pathway prototype agent installed through the marionettist plugin seam.",
    file: "../pathway/agents/marionettist-pathway-prototype.md"
  }
];

const commandDefinitions = [
  {
    name: "marionettist",
    file: "../templates/commands/marionettist.md",
    surface: "minimal"
  },
  {
    name: "marionettist-dev",
    file: "../templates/commands/marionettist-dev.md",
    surface: "minimal"
  },
  {
    name: "marionettist-incident",
    file: "../templates/commands/marionettist-incident.md",
    surface: "minimal"
  },
  {
    name: "marionettist-docs",
    file: "../templates/commands/marionettist-docs.md",
    surface: "minimal"
  },
  {
    name: "marionettist-config",
    file: "../templates/commands/marionettist-config.md",
    surface: "minimal"
  },
  {
    name: "marionettist-context",
    file: "../templates/commands/marionettist-context.md",
    surface: "standard"
  },
  {
    name: "marionettist-status",
    file: "../templates/commands/marionettist-status.md",
    surface: "standard"
  },
  {
    name: "marionettist-continue",
    file: "../templates/commands/marionettist-continue.md",
    surface: "standard"
  },
  {
    name: "marionettist-feature",
    file: "../templates/commands/marionettist-feature.md",
    surface: "advanced"
  },
  {
    name: "marionettist-bugfix",
    file: "../templates/commands/marionettist-bugfix.md",
    surface: "advanced"
  },
  {
    name: "marionettist-refactor",
    file: "../templates/commands/marionettist-refactor.md",
    surface: "advanced"
  },
  {
    name: "marionettist-pathway-prototype",
    description: "OpenCode pathway prototype command installed through the marionettist plugin seam.",
    file: "../pathway/commands/marionettist-pathway-prototype.md"
  },
  {
    name: "marionettist-pathway-config",
    description: "Pathway-scoped OpenCode or marionettist config drafting command with preview-first confirmation.",
    file: "../pathway/commands/marionettist-pathway-config.md"
  }
];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export default async function marionettistPathwayOpencodePlugin(input = {}) {
  const projectPath = resolveProjectPath(input);
  const projectConfig = await readProjectConfig(projectPath);
  const permissionMode = normalizePermissionMode(projectConfig?.opencode?.permissionMode);
  const commandSurface = normalizeCommandSurface(projectConfig?.opencode?.commandSurface);
  const runtimeVariables = registerPackagedStandardSurface
    ? await buildRuntimeVariables(projectPath, permissionMode)
    : {};
  const activeAgentDefinitions = agentDefinitions.filter((definition) => registerPackagedStandardSurface || !definition.profile);
  const activeCommandDefinitions = commandDefinitions.filter((definition) => registerPackagedStandardSurface || !definition.surface);

  const [agentEntries, commandEntries] = await Promise.all([
    Promise.all(activeAgentDefinitions.map((definition) => loadAgentDefinition(definition, runtimeVariables))),
    Promise.all(activeCommandDefinitions.map((definition) => loadCommandDefinition(definition, runtimeVariables)))
  ]);

  const agentPromptMap = new Map(agentEntries.map((entry) => [entry.name, entry]));
  const commandPromptMap = new Map(commandEntries.map((entry) => [entry.name, entry]));

  return {
    config: (cfg) => {
      cfg.agent = isRecord(cfg.agent) ? cfg.agent : {};
      cfg.command = isRecord(cfg.command) ? cfg.command : {};
      cfg.skills = isRecord(cfg.skills) ? cfg.skills : {};

      for (const definition of agentDefinitions) {
        if (!registerPackagedStandardSurface && definition.profile) {
          continue;
        }
        const entry = agentPromptMap.get(definition.name);
        if (!entry) {
          continue;
        }
        cfg.agent[definition.name] ??= { ...entry.config };
      }

      for (const definition of commandDefinitions) {
        if (!registerPackagedStandardSurface && definition.surface) {
          continue;
        }
        if (!shouldIncludeCommandSurface(definition.surface, commandSurface)) {
          continue;
        }
        const entry = commandPromptMap.get(definition.name);
        if (!entry) {
          continue;
        }
        cfg.command[definition.name] ??= { ...entry.config };
      }

      const skillPaths = Array.isArray(cfg.skills.paths)
        ? [...cfg.skills.paths]
        : [];

      if (!skillPaths.includes(packageSkillPath)) {
        skillPaths.push(packageSkillPath);
      }

      cfg.skills.paths = skillPaths;
    }
  };
}

async function loadAgentDefinition(definition, runtimeVariables) {
  if (!definition.profile) {
    return {
      name: definition.name,
      config: {
        mode: "subagent",
        description: definition.description,
        prompt: (await readFile(new URL(definition.file, import.meta.url), "utf8")).trim()
      }
    };
  }

  const rendered = renderTemplate(
    await readFile(new URL(definition.file, import.meta.url), "utf8"),
    runtimeVariables
  );
  const { frontmatter, body } = parseMarkdownDefinition(rendered);
  return {
    name: definition.name,
    config: {
      ...frontmatter,
      prompt: body.trim()
    }
  };
}

async function loadCommandDefinition(definition, runtimeVariables) {
  const rendered = renderTemplate(
    await readFile(new URL(definition.file, import.meta.url), "utf8"),
    runtimeVariables
  );

  if (definition.description) {
    return {
      name: definition.name,
      config: {
        description: definition.description,
        template: rendered.trim()
      }
    };
  }

  const { frontmatter, body } = parseMarkdownDefinition(rendered);
  return {
    name: definition.name,
    config: {
      ...frontmatter,
      template: body.trim()
    }
  };
}

function resolveProjectPath(input) {
  const candidate = input?.project?.root ?? input?.project?.path ?? input?.directory ?? process.cwd();
  return path.resolve(candidate);
}

async function buildRuntimeVariables(projectPath, permissionMode) {
  const profiles = await loadEffectiveProfiles(projectPath);
  const policy = buildPermissionPolicy(permissionMode);
  const variables = {
    OPENCODE_PERMISSION_WARNINGS_MARKDOWN: policy.warningsMarkdown,
    VALIDATOR_PROJECT_GUIDANCE: await buildValidatorProjectGuidance()
  };

  for (const definition of agentDefinitions) {
    if (!definition.profile || !definition.variablePrefix) {
      continue;
    }
    const resolved = resolveAgentModelConfig(profiles, definition.profile, definition.overrideAliases ?? [definition.name]);
    variables[`${definition.variablePrefix}_MODEL`] = resolved.model;
    variables[`${definition.variablePrefix}_TEMPERATURE`] = renderTemperatureValue(resolved.temperature);
    variables[`OPENCODE_PERMISSION_BLOCK_${definition.variablePrefix}`] = renderPermissionBlock(policy.agents[definition.name]);
  }

  return variables;
}

async function loadEffectiveProfiles(projectPath) {
  const canonical = await readYamlFile(path.join(projectPath, ".marionettist", "model-profiles.yml"));
  const legacy = canonical ? null : await readYamlFile(path.join(projectPath, "marionettist.config.yaml"));
  const overrides = canonical?.profiles ?? legacy?.models?.profiles ?? null;
  return mergeProfiles(builtInProfileDefaults, normalizeProfiles(overrides));
}

async function readProjectConfig(projectPath) {
  return readYamlFile(path.join(projectPath, "marionettist.config.yaml"));
}

async function readYamlFile(filePath) {
  try {
    return parseSimpleYaml(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    return null;
  }
}

async function buildValidatorProjectGuidance() {
  const genericFallback = await readFile(new URL("../templates/agents/validators/generic-fallback.md", import.meta.url), "utf8");
  return [
    genericFallback.trim(),
    "# Scheduled Validator Guidance",
    "",
    "- If `opencode.jsonc` enables `opencode-tasks` and the caller asks for recurring, unattended, or cron-style validation, prefer proposing an `opencode-tasks` schedule over an ad hoc loop.",
    "- Do not modify user-global scheduler state or create recurring tasks unless the caller explicitly asks for scheduling.",
    "- For normal one-off validation, continue to run the smallest relevant validation command directly."
  ].join("\n");
}

function normalizeProfiles(rawProfiles) {
  const result = {};
  for (const [profileName, defaults] of Object.entries(builtInProfileDefaults)) {
    const rawProfile = rawProfiles?.[profileName] ?? {};
    result[profileName] = {
      default: typeof rawProfile.default === "string" && rawProfile.default.length > 0 ? rawProfile.default : defaults.default,
      temperature: readNumber(rawProfile.temperature, defaults.temperature),
      agentOverrides: normalizeAgentOverrides(rawProfile.agentOverrides)
    };
  }
  return result;
}

function mergeProfiles(defaults, overrides) {
  const result = {};
  for (const [profileName, defaultProfile] of Object.entries(defaults)) {
    const override = overrides?.[profileName] ?? {};
    result[profileName] = {
      default: override.default ?? defaultProfile.default,
      temperature: override.temperature ?? defaultProfile.temperature,
      agentOverrides: {
        ...(defaultProfile.agentOverrides ?? {}),
        ...(override.agentOverrides ?? {})
      }
    };
  }
  return result;
}

function normalizeAgentOverrides(rawOverrides) {
  if (!isRecord(rawOverrides)) {
    return {};
  }
  const normalized = {};
  for (const [key, value] of Object.entries(rawOverrides)) {
    if (!isRecord(value)) {
      continue;
    }
    normalized[key] = {};
    if (typeof value.model === "string" && value.model.length > 0) {
      normalized[key].model = value.model;
    }
    if (Object.prototype.hasOwnProperty.call(value, "temperature")) {
      normalized[key].temperature = readNumber(value.temperature, undefined);
    }
  }
  return normalized;
}

function resolveAgentModelConfig(profiles, profileName, overrideAliases) {
  const profile = profiles?.[profileName] ?? builtInProfileDefaults[profileName];
  const override = firstDefinedOverride(profile.agentOverrides, overrideAliases);
  return {
    model: override?.model ?? profile.default,
    temperature: override?.temperature ?? profile.temperature
  };
}

function firstDefinedOverride(overrides, aliases) {
  for (const alias of aliases) {
    const override = overrides?.[alias];
    if (override && (override.model !== undefined || override.temperature !== undefined)) {
      return override;
    }
  }
  return null;
}

function buildPermissionPolicy(permissionMode) {
  const mode = normalizePermissionMode(permissionMode);
  return {
    mode,
    agents: permissionPolicies[mode],
    warningsMarkdown: [
      `- ${permissionModeWarnings[mode]}`,
      `- ${dangerousCommandBaselineWarning}`,
      `- ${schemaLimitationWarning}`
    ].join("\n")
  };
}

function normalizePermissionMode(value) {
  return value === "moderate" || value === "loose" ? value : "default";
}

function normalizeCommandSurface(value) {
  if (value === "advanced" || value === "standard" || value === "minimal") {
    return value;
  }
  if (value === "full") {
    return "advanced";
  }
  return "minimal";
}

function shouldIncludeCommandSurface(commandSurface, effectiveSurface) {
  if (!commandSurface) {
    return true;
  }
  if (effectiveSurface === "advanced") {
    return true;
  }
  if (effectiveSurface === "standard") {
    return commandSurface === "minimal" || commandSurface === "standard";
  }
  return commandSurface === "minimal";
}

function renderPermissionBlock(permission) {
  return [
    "permission:",
    `  edit: ${permission.edit}`,
    `  bash: ${permission.bash}`,
    `  webfetch: ${permission.webfetch}`,
    ...renderTaskPermission(permission.task)
  ].join("\n");
}

function renderTaskPermission(taskPermission) {
  if (typeof taskPermission === "string") {
    return [`  task: ${taskPermission}`];
  }
  const lines = ["  task:"];
  for (const [name, access] of Object.entries(taskPermission)) {
    lines.push(`    ${name}: ${access}`);
  }
  return lines;
}

function renderTemplate(content, variables) {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match
  ));
}

function parseMarkdownDefinition(content) {
  const normalized = content.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/u);
  if (!match) {
    return { frontmatter: {}, body: normalized };
  }
  return {
    frontmatter: parseSimpleYaml(match[1]),
    body: match[2]
  };
}

function parseSimpleYaml(content) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  const lines = content.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) {
      continue;
    }
    const indent = rawLine.match(/^ */u)?.[0].length ?? 0;
    const line = rawLine.trim();
    while (stack.length > 1 && indent <= stack.at(-1).indent) {
      stack.pop();
    }
    const parent = stack.at(-1).value;
    const separator = line.indexOf(":");
    if (separator === -1) {
      throw new Error(`invalid yaml line: ${line}`);
    }
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    if (rawValue === "") {
      const nextMeaningful = nextMeaningfulLine(lines, index + 1);
      const value = nextMeaningful?.trim().startsWith("- ") ? [] : {};
      parent[key] = value;
      stack.push({ indent, value });
      continue;
    }
    parent[key] = parseYamlScalar(rawValue);
  }
  return root;
}

function nextMeaningfulLine(lines, start) {
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() && !line.trimStart().startsWith("#")) {
      return line;
    }
  }
  return null;
}

function parseYamlScalar(rawValue) {
  const value = stripYamlInlineComment(rawValue).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  const numeric = Number(value);
  if (value.length > 0 && Number.isFinite(numeric)) {
    return numeric;
  }
  return value;
}

function stripYamlInlineComment(value) {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    if (current === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (current === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (current === "#" && !inSingleQuote && !inDoubleQuote) {
      return value.slice(0, index);
    }
  }
  return value;
}

function readNumber(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function renderTemperatureValue(value) {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}
