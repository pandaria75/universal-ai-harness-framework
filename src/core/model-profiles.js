import path from "node:path";
import { pathExists, readText } from "./files.js";
import { resolveCoreTemplateSource, templatesRoot } from "./framework-paths.js";
import { parseSimpleYaml } from "./yaml.js";

export const modelProfilesProjectRelative = ".marionettist/model-profiles.yml";
const modelProfilesTemplateSourceRelative = ".marionettist/model-profiles.yml";
export const requiredModelProfiles = ["think", "build", "review", "run"];

const opencodeAgentProfileBindings = [
  ["harness-builder", "think", "harnessBuilder"],
  ["harness-planner", "think", "harnessPlanner"],
  ["harness-coder", "build", "harnessCoder"],
  ["harness-reviewer", "review", "harnessReviewer"],
  ["harness-critic", "review", "harnessCritic"],
  ["harness-indexer", "run", "harnessIndexer"],
  ["harness-validator", "run", "harnessValidator"]
];

const builtInProfileDefaults = {
  think: {
    description: "Deep reasoning, planning, and gate decisions",
    default: "openai/gpt-5.5",
    temperature: 0.1,
    agentOverrides: {}
  },
  build: {
    description: "Focused coding and implementation from approved task context",
    default: "openai/gpt-5.4",
    temperature: 0.1,
    agentOverrides: {}
  },
  review: {
    description: "Reflective, cautious, nuanced review",
    default: "deepseek/deepseek-v4-pro",
    temperature: 0,
    agentOverrides: {}
  },
  run: {
    description: "Fast utility work such as indexing and validation",
    default: "deepseek/deepseek-v4-flash",
    temperature: 0,
    agentOverrides: {}
  }
};

export async function loadModelProfiles(projectPath) {
  return (await loadModelProfilesState(projectPath)).effectiveProfiles;
}

export async function loadModelProfilesState(projectPath) {
  const frameworkDefaults = await loadFrameworkDefaultProfiles();

  if (!frameworkDefaults) {
    throw new Error(`Framework model profile defaults not found: ${path.join(templatesRoot, modelProfilesTemplateSourceRelative)}`);
  }

  const canonicalProfiles = await readModelProfilesFromPath(
    path.join(projectPath, modelProfilesProjectRelative),
    "canonical"
  );
  if (canonicalProfiles) {
    const normalizedCanonicalProfiles = normalizeModelProfiles(canonicalProfiles);
    return {
      frameworkDefaults,
      canonicalProfiles: normalizedCanonicalProfiles,
      legacyProfiles: null,
      effectiveProfiles: mergeModelProfiles(frameworkDefaults, normalizedCanonicalProfiles),
      source: "canonical"
    };
  }

  return {
    frameworkDefaults,
    canonicalProfiles: null,
    legacyProfiles: null,
    effectiveProfiles: frameworkDefaults,
    source: "framework"
  };
}

export async function loadCanonicalOrFrameworkModelProfiles(projectPath) {
  const frameworkDefaults = await loadFrameworkDefaultProfiles();

  if (!frameworkDefaults) {
    throw new Error(`Framework model profile defaults not found: ${path.join(templatesRoot, modelProfilesTemplateSourceRelative)}`);
  }

  const canonicalProfiles = await readModelProfilesFromPath(
    path.join(projectPath, modelProfilesProjectRelative),
    "canonical"
  );

  return canonicalProfiles ? mergeModelProfiles(frameworkDefaults, normalizeModelProfiles(canonicalProfiles)) : frameworkDefaults;
}

export function buildModelProfileTemplateVariables(profiles, variables = {}) {
  return {
    ...variables,
    modelProfileThink: profiles.think.default,
    modelProfileBuild: profiles.build.default,
    modelProfileReview: profiles.review.default,
    modelProfileRun: profiles.run.default
  };
}

export function buildOpencodeAgentTemplateVariables(profiles, variables = {}) {
  const resolvedVariables = buildModelProfileTemplateVariables(profiles, variables);
  const resolvedAgentModels = buildResolvedOpencodeAgentModelConfigs(profiles);

  for (const [agentName,, variablePrefix] of opencodeAgentProfileBindings) {
    const resolved = resolvedAgentModels[agentName];
    resolvedVariables[`${variablePrefix}Model`] = resolved.model;
    resolvedVariables[`${variablePrefix}Temperature`] = renderTemperatureValue(resolved.temperature);
  }

  return resolvedVariables;
}

export function buildResolvedOpencodeAgentModelConfigs(profiles) {
  return Object.fromEntries(
    opencodeAgentProfileBindings.map(([agentName, profileName]) => [
      agentName,
      resolveAgentModelConfig(profiles, profileName, agentName)
    ])
  );
}

export function resolveAgentModelConfig(profiles, profileName, agentName) {
  const profile = profiles?.[profileName] ?? {};
  const builtInProfile = builtInProfileDefaults[profileName] ?? {};
  const override = profile.agentOverrides?.[agentName] ?? {};

  return {
    model: readProfileField(override, "model", readProfileField(profile, "default", builtInProfile.default ?? "unknown")),
    temperature: readTemperatureField(override, "temperature", readTemperatureField(profile, "temperature", builtInProfile.temperature ?? 0))
  };
}

export function renderCanonicalModelProfiles(profiles) {
  const lines = ["profiles:"];

  for (const profileName of requiredModelProfiles) {
    const profile = profiles[profileName] ?? {};
    lines.push(`  ${profileName}:`);
    lines.push(`    description: ${JSON.stringify(profile.description ?? "unknown")}`);
    lines.push(`    default: ${JSON.stringify(profile.default ?? "unknown")}`);
    lines.push(`    temperature: ${renderTemperatureValue(typeof profile.temperature === "number" ? profile.temperature : 0)}`);

    const agentOverrideNames = Object.keys(profile.agentOverrides ?? {}).sort();
    if (agentOverrideNames.length > 0) {
      lines.push("    agentOverrides:");
      for (const agentName of agentOverrideNames) {
        const override = profile.agentOverrides[agentName] ?? {};
        lines.push(`      ${agentName}:`);
        if (typeof override.model === "string" && override.model.length > 0) {
          lines.push(`        model: ${JSON.stringify(override.model)}`);
        }
        if (typeof override.temperature === "number" && Number.isFinite(override.temperature)) {
          lines.push(`        temperature: ${renderTemperatureValue(override.temperature)}`);
        }
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

async function loadFrameworkDefaultProfiles() {
  const resolvedSource = await resolveCoreTemplateSource(modelProfilesTemplateSourceRelative);
  const frameworkDefaultSource = resolvedSource
    ? await readModelProfilesFromPath(resolvedSource.sourcePath, "canonical")
    : null;
  return frameworkDefaultSource
    ? mergeModelProfiles(builtInProfileDefaults, frameworkDefaultSource)
    : normalizeModelProfiles(builtInProfileDefaults);
}

async function readModelProfilesFromPath(filePath, sourceType) {
  if (!(await pathExists(filePath))) {
    return null;
  }

  const parsed = parseSimpleYaml(await readText(filePath));
  const rawProfiles = parsed?.profiles;

  if (!rawProfiles || typeof rawProfiles !== "object") {
    return null;
  }

  return rawProfiles;
}

function normalizeModelProfiles(rawProfiles) {
  const result = {};

  for (const profileName of requiredModelProfiles) {
    const rawProfile = rawProfiles?.[profileName];
    const normalizedProfile = {
      agentOverrides: normalizeAgentOverrides(rawProfile?.agentOverrides)
    };

    if (typeof rawProfile?.description === "string" && rawProfile.description.length > 0) {
      normalizedProfile.description = rawProfile.description;
    }
    if (typeof rawProfile?.default === "string" && rawProfile.default.length > 0) {
      normalizedProfile.default = rawProfile.default;
    }

    const hasTemperature = Object.prototype.hasOwnProperty.call(rawProfile ?? {}, "temperature");
    const temperature = readTemperatureField(rawProfile, "temperature", Number.NaN);
    if (hasTemperature && Number.isFinite(temperature)) {
      normalizedProfile.temperature = temperature;
    }

    result[profileName] = normalizedProfile;
  }

  return result;
}

function mergeModelProfiles(defaultProfiles, overrideProfiles) {
  const result = {};

  for (const profileName of requiredModelProfiles) {
    result[profileName] = {
      description: readProfileField(overrideProfiles?.[profileName], "description", defaultProfiles[profileName].description),
      default: readProfileField(overrideProfiles?.[profileName], "default", defaultProfiles[profileName].default),
      temperature: readTemperatureField(overrideProfiles?.[profileName], "temperature", defaultProfiles[profileName].temperature),
      agentOverrides: mergeAgentOverrides(defaultProfiles[profileName].agentOverrides, overrideProfiles?.[profileName]?.agentOverrides)
    };
  }

  return result;
}

function readProfileField(rawProfile, fieldName, fallback = "unknown") {
  const value = rawProfile?.[fieldName];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readTemperatureField(rawProfile, fieldName, fallback = 0) {
  const value = rawProfile?.[fieldName];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeAgentOverrides(rawOverrides) {
  if (!rawOverrides || typeof rawOverrides !== "object" || Array.isArray(rawOverrides)) {
    return {};
  }

  const normalized = {};
  for (const [agentName, rawOverride] of Object.entries(rawOverrides)) {
    if (!rawOverride || typeof rawOverride !== "object" || Array.isArray(rawOverride)) {
      continue;
    }

    const override = {};
    if (typeof rawOverride.model === "string" && rawOverride.model.length > 0) {
      override.model = rawOverride.model;
    }

    const hasTemperature = Object.prototype.hasOwnProperty.call(rawOverride, "temperature");
    const temperature = readTemperatureField(rawOverride, "temperature", Number.NaN);
    if (hasTemperature && Number.isFinite(temperature)) {
      override.temperature = temperature;
    }

    if (Object.keys(override).length > 0) {
      normalized[agentName] = override;
    }
  }

  return normalized;
}

function mergeAgentOverrides(defaultOverrides = {}, overrideOverrides = {}) {
  const merged = {};
  const agentNames = new Set([
    ...Object.keys(defaultOverrides ?? {}),
    ...Object.keys(overrideOverrides ?? {})
  ]);

  for (const agentName of agentNames) {
    const defaultOverride = defaultOverrides?.[agentName] ?? {};
    const overrideOverride = overrideOverrides?.[agentName] ?? {};
    const mergedOverride = {};

    if (typeof overrideOverride.model === "string" && overrideOverride.model.length > 0) {
      mergedOverride.model = overrideOverride.model;
    } else if (typeof defaultOverride.model === "string" && defaultOverride.model.length > 0) {
      mergedOverride.model = defaultOverride.model;
    }

    if (typeof overrideOverride.temperature === "number" && Number.isFinite(overrideOverride.temperature)) {
      mergedOverride.temperature = overrideOverride.temperature;
    } else if (typeof defaultOverride.temperature === "number" && Number.isFinite(defaultOverride.temperature)) {
      mergedOverride.temperature = defaultOverride.temperature;
    }

    if (Object.keys(mergedOverride).length > 0) {
      merged[agentName] = mergedOverride;
    }
  }

  return merged;
}

function renderTemperatureValue(value) {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}
