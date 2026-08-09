import fs from "node:fs/promises";
import path from "node:path";
import { parseCommonArgs } from "../core/args.js";
import { projectConfigRelative } from "../core/framework-paths.js";
import { validateOptionalGatePolicyDefaultMode } from "../core/gate-policy.js";
import { validateOptionalDistributionMode, validateOptionalOpencodeCommandSurface, validateOptionalOpencodePermissionMode, validateOptionalOpencodePluginSource } from "../core/manifest.js";
import { loadTierPolicyState, tierPolicySourceRelative } from "../core/tier-policy.js";
import { parseSimpleYaml } from "../core/yaml.js";
import { listPiModels, piPackageSource, readPiProjectInstall } from "../core/pi-package.js";
import { loadModelProfiles } from "../core/model-profiles.js";

const managedBlockStart = "<!-- marionettist-kit:start -->";
const managedBlockEnd = "<!-- marionettist-kit:end -->";
const requiredModelProfiles = ["think", "build", "review", "run"];
const codingPhases = new Set(["coding", "review", "validation", "finalization"]);
const opencodeAgentRoleMap = new Map([
  ["marionettist-builder", "think"],
  ["marionettist-planner", "think"],
  ["marionettist-coder", "build"],
  ["marionettist-reviewer", "review"],
  ["marionettist-critic", "review"],
  ["marionettist-validator", "run"],
  ["marionettist-indexer", "run"]
]);
const opencodeAdapterConfigRelatives = [
  ".marionettist/adapters/opencode.yml",
  ".marionettist/adapters/opencode.yaml"
];
const requiredNormalOpencodeCommands = [
  ".opencode/commands/marionettist.md",
  ".opencode/commands/marionettist-dev.md",
  ".opencode/commands/marionettist-incident.md",
  ".opencode/commands/marionettist-docs.md",
  ".opencode/commands/marionettist-config.md"
];
const standardOpencodeCommands = [
  ".opencode/commands/marionettist-context.md",
  ".opencode/commands/marionettist-status.md",
  ".opencode/commands/marionettist-continue.md"
];
const advancedOnlyOpencodeCommands = [
  ".opencode/commands/marionettist-feature.md",
  ".opencode/commands/marionettist-bugfix.md",
  ".opencode/commands/marionettist-refactor.md"
];
const opencodePackagePluginSpecifier = "marionettist-pathway-opencode";
const opencodeLocalPluginSpecifier = "./.opencode/plugin/opencode-tasks.js";
const modelDriftRemediation = "Reconcile the local model sources, then run `marionettist diff --project <path>` or `marionettist sync --project <path> --with-opencode` to preview or apply the safe regeneration.";

export async function doctorCommand(args) {
  const options = parseCommonArgs(args);
  const results = [];

  const projectConfig = await checkProjectConfig(options.project, results);
  await checkTierPolicy(options.project, results);
  await checkAgents(options.project, results);
  const manifest = await checkManifest(options.project, results);
  await checkPi(options.project, options, manifest, results);
  checkDistributionMode(manifest, projectConfig, results);
  checkGatePolicyDefaultMode(projectConfig, results);
  await checkPath(options.project, ".aiassistant/rules", "directory", ".aiassistant/rules exists", results);
  await checkPath(options.project, "docs/project/knowledge-map.md", "file", "docs/project/knowledge-map.md exists", results);
  await checkPath(options.project, "docs/project/marionettist-workflow.md", "file", "docs/project/marionettist-workflow.md exists", results);
  await checkPath(options.project, ".task", "directory", ".task directory exists", results);
  const opencodeState = await checkOpencode(options.project, manifest, projectConfig, results);
  checkOpenCodePermissionMode(manifest, projectConfig, opencodeState?.config, results);
  await checkOpenCodeCommandSurface(options.project, projectConfig, opencodeState, results);
  await checkOpenCodeModelDrift(options.project, projectConfig, opencodeState, results);
  await checkSkills(options.project, results);
  await checkActiveTask(options.project, results);

  printResults(results);

  if (results.some((result) => result.level === "FAIL")) {
    process.exitCode = 1;
  }
}

async function checkPi(projectPath, options, manifest, results) {
  const expected = options.withPi === true || manifest?.piPackageSource === piPackageSource;
  const install = await readPiProjectInstall(projectPath);
  if (install.parseError) {
    results.push(fail(`.pi/settings.json parse failed: ${install.parseError.message}`));
    return;
  }
  if (!install.installed) {
    results.push(expected
      ? fail(`Pi project package missing; run pi install -l ${piPackageSource}`)
      : warn("Pi project package not installed; optional Pi pathway not enabled"));
    return;
  }
  results.push(pass(`Pi project package ${piPackageSource} is installed locally`));

  let modelOutput;
  try {
    modelOutput = (await listPiModels(projectPath)).stdout;
  } catch (error) {
    results.push(fail(`Pi model discovery failed: ${error.message}`));
    return;
  }

  const profiles = await loadModelProfiles(projectPath);
  for (const profileName of requiredModelProfiles) {
    const model = profiles?.[profileName]?.default;
    if (!model) {
      results.push(fail(`Pi model profile ${profileName}.default missing`));
    } else if (!modelOutput.includes(model)) {
      results.push(fail(`Pi model profile ${profileName}.default unavailable: ${model}`));
    } else {
      results.push(pass(`Pi model profile ${profileName}.default available: ${model}`));
    }
  }
}

async function checkProjectConfig(projectPath, results) {
  const relative = projectConfigRelative;
  const absolute = path.join(projectPath, relative);
  if (!(await exists(absolute))) {
    results.push(fail(`${relative} missing`));
    return null;
  }

  let parsed;
  try {
    parsed = parseSimpleYaml(await fs.readFile(absolute, "utf8"), { validateIndentation: true });
    results.push(pass(`${relative} parsed`));
  } catch (error) {
    results.push(fail(`${relative} parse failed: ${error.message}`));
    return null;
  }
  return parsed;
}

async function checkAgents(projectPath, results) {
  const absolute = path.join(projectPath, "AGENTS.md");
  if (!(await exists(absolute))) {
    results.push(fail("AGENTS.md missing"));
    return;
  }

  const content = await fs.readFile(absolute, "utf8");
  if (content.includes(managedBlockStart) && content.includes(managedBlockEnd)) {
    results.push(pass("AGENTS.md managed block found"));
    return;
  }
  results.push(fail("AGENTS.md managed block missing"));
}

async function checkTierPolicy(projectPath, results) {
  try {
    const state = await loadTierPolicyState(projectPath);
    const { explanation } = state;
    const interactionMessages = new Set((explanation.interactions ?? []).map((interaction) => interaction.message));

    if (explanation.errors.length > 0) {
      for (const error of explanation.errors) {
        results.push(fail(error));
      }
    }

    if (!state.projectSource.exists) {
      results.push(warn(`${tierPolicySourceRelative} missing; task intake will use framework defaults`));
    } else if (explanation.errors.length === 0) {
      results.push(pass(`${tierPolicySourceRelative} parsed`));
    } else {
      results.push(warn(`${tierPolicySourceRelative} invalid; task intake will fall back to safe defaults where needed`));
    }

    for (const warning of explanation.warnings) {
      if (!warning.startsWith(`${tierPolicySourceRelative} not found;`) && !interactionMessages.has(warning)) {
        results.push(warn(warning));
      }
    }

    for (const interaction of explanation.interactions ?? []) {
      if (interaction.classification === "refinement") {
        results.push(pass(interaction.message));
      } else if (interaction.classification === "soft-conflict") {
        results.push(warn(interaction.message));
      } else if (interaction.classification === "explicit-override") {
        results.push(warn(interaction.message));
      }
    }
  } catch (error) {
    results.push(fail(`${tierPolicySourceRelative} could not be evaluated: ${error.message}`));
  }
}

async function checkManifest(projectPath, results) {
  const relative = ".marionettist/manifest.json";
  const absolute = path.join(projectPath, relative);
  if (!(await exists(absolute))) {
    results.push(fail(`${relative} missing`));
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(await fs.readFile(absolute, "utf8"));
  } catch (error) {
    results.push(fail(`${relative} parse failed: ${error.message}`));
    return;
  }

  if (manifest.schemaVersion !== 1) {
    results.push(fail(`${relative} unsupported schemaVersion: ${manifest.schemaVersion}`));
    return null;
  }
  results.push(pass(`${relative} schemaVersion=${manifest.schemaVersion}`));

  if (!manifest.frameworkVersion) {
    results.push(fail(`${relative} missing frameworkVersion`));
  } else {
    results.push(pass(`${relative} frameworkVersion=${manifest.frameworkVersion}`));
  }

  if (!Array.isArray(manifest.managedFiles)) {
    results.push(fail(`${relative} managedFiles missing or not an array`));
    return null;
  }
  results.push(pass(`${relative} managedFiles count=${manifest.managedFiles.length}`));

  const missingManaged = [];
  for (const file of manifest.managedFiles) {
    if (!(await exists(path.join(projectPath, file.path)))) {
      missingManaged.push(file.path);
    }
  }
  if (missingManaged.length > 0) {
    const preview = missingManaged.slice(0, 5).join(", ");
    const suffix = missingManaged.length > 5 ? ` (+${missingManaged.length - 5} more)` : "";
    results.push(warn(`manifest references ${missingManaged.length} missing managed file(s): ${preview}${suffix}`));
  } else {
    results.push(pass("all managed files referenced in manifest exist on disk"));
  }

  return manifest;
}

function checkDistributionMode(manifest, harnessConfig, results) {
  if (!manifest) {
    return;
  }

  const manifestMode = readConfiguredDistributionModeValue(manifest.distributionMode, ".marionettist/manifest.json distributionMode");
  const configMode = readConfiguredDistributionModeValue(harnessConfig?.distribution?.mode, `${projectConfigRelative} distribution.mode`);

  if (manifestMode.error) {
    results.push(fail(manifestMode.error));
    return;
  }

  if (configMode.error) {
    results.push(fail(configMode.error));
    return;
  }

  if (manifestMode.value) {
    results.push(pass(`distribution mode: ${manifestMode.value} (manifest)`));
    if (configMode.value && configMode.value !== manifestMode.value) {
      results.push(warn(`distribution mode config mismatch: manifest=${manifestMode.value}, ${projectConfigRelative}=${configMode.value}`));
    }
    return;
  }

  if (configMode.value) {
    results.push(warn(`distribution mode: ${configMode.value} (inferred from ${projectConfigRelative}; manifest missing distributionMode)`));
    return;
  }

  results.push(warn("distribution mode: embedded (legacy inferred; manifest missing distributionMode)"));
}

function checkGatePolicyDefaultMode(harnessConfig, results) {
  const hasGatePolicyDefaultMode = Object.prototype.hasOwnProperty.call(harnessConfig?.gatePolicy ?? {}, "defaultMode");
  if (!hasGatePolicyDefaultMode) {
    return;
  }

  const configuredMode = readConfiguredGatePolicyDefaultMode(harnessConfig);
  if (configuredMode.error) {
    results.push(fail(configuredMode.error));
    return;
  }

  results.push(pass(`gate policy default mode: ${configuredMode.value} (${projectConfigRelative})`));
}

async function checkPath(projectPath, relative, expectedType, label, results) {
  const absolute = path.join(projectPath, relative);
  try {
    const stat = await fs.stat(absolute);
    const ok = expectedType === "directory" ? stat.isDirectory() : stat.isFile();
    results.push(ok ? pass(label) : fail(`${relative} is not a ${expectedType}`));
  } catch {
    results.push(fail(`${relative} missing`));
  }
}

async function checkOpencode(projectPath, manifest, harnessConfig, results) {
  const configPath = path.join(projectPath, "opencode.jsonc");
  let parsedConfig = null;
  if (await exists(configPath)) {
    try {
      parsedConfig = JSON.parse(stripJsonComments(await fs.readFile(configPath, "utf8")));
      results.push(pass("opencode.jsonc parsed"));
    } catch (error) {
      results.push(fail(`opencode.jsonc parse failed: ${error.message}`));
    }
  } else {
    results.push(warn("opencode.jsonc not found; optional OpenCode scaffold not installed"));
  }

  const runtimeSource = detectOpenCodeRuntimeSource(manifest, harnessConfig, parsedConfig);
  if (runtimeSource.pluginSource === "package") {
    results.push(pass(`OpenCode runtime source: package plugin (${runtimeSource.sourceLabel})`));
  } else if (runtimeSource.pluginSource === "local") {
    results.push(pass(`OpenCode runtime source: local plugin (${runtimeSource.sourceLabel})`));
  }

  const agentDirectoryExists = Boolean(await findFirstDirectory(projectPath, [".opencode/agent", ".opencode/agents"]));
  const commandDirectoryExists = Boolean(await findFirstDirectory(projectPath, [".opencode/command", ".opencode/commands"]));

  if (runtimeSource.pluginSource !== "package" || agentDirectoryExists) {
    await checkMarkdownFrontmatterDirectory(projectPath, [".opencode/agent", ".opencode/agents"], "OpenCode agent", results);
  }

  if (runtimeSource.pluginSource !== "package" || commandDirectoryExists) {
    await checkMarkdownFrontmatterDirectory(projectPath, [".opencode/command", ".opencode/commands"], "OpenCode command", results);
  }

  return { config: parsedConfig, runtimeSource };
}

async function checkOpenCodeModelDrift(projectPath, harnessConfig, opencodeState, results) {
  const opencodeConfig = opencodeState?.config ?? null;
  const runtimeSource = opencodeState?.runtimeSource?.pluginSource ?? null;
  const agentDirectory = await findFirstDirectory(projectPath, [".opencode/agent", ".opencode/agents"]);
  const canonicalSource = await readModelProfileSource(path.join(projectPath, ".marionettist", "model-profiles.yml"), "canonical");

  if (canonicalSource.parseError) {
    results.push(fail(`.marionettist/model-profiles.yml parse failed: ${canonicalSource.parseError.message}`));
    return;
  }

  if (runtimeSource === "package" && !agentDirectory) {
    if (canonicalSource.exists) {
      results.push(pass("OpenCode package agents resolve models at runtime from .marionettist/model-profiles.yml after OpenCode restart/reload"));
    } else {
      results.push(pass("OpenCode package agents will use package-safe default model profiles because .marionettist/model-profiles.yml is missing"));
    }
    return;
  }

  if (!agentDirectory) {
    return;
  }

  await checkOpenCodePlaceholderDrift(projectPath, results);

  const adapterSource = await readAdapterModelSource(projectPath);
  const opencodeAssignments = extractOpencodeModelAssignments(opencodeConfig);
  if (adapterSource.parseError) {
    results.push(fail(`${adapterSource.label} parse failed: ${adapterSource.parseError.message}`));
    return;
  }

  for (const [agentName, role] of opencodeAgentRoleMap.entries()) {
    const agentRelative = toPosix(path.join(path.relative(projectPath, agentDirectory), `${agentName}.md`));
    const agentAbsolute = path.join(projectPath, agentRelative);
    const agentExists = await exists(agentAbsolute);
    const agentContent = agentExists ? await fs.readFile(agentAbsolute, "utf8") : null;
    const evaluation = evaluateAgentModelStatus({
      role,
      agentName,
      canonicalSource,
      adapterSource,
      opencodeAssignments,
      agentExists,
      agentContent,
      agentRelative
    });
    results.push(statusResult(evaluation.status, evaluation.message));
  }
}

function checkOpenCodePermissionMode(manifest, harnessConfig, opencodeConfig, results) {
  const hasPermissionModeConfig = Object.prototype.hasOwnProperty.call(harnessConfig?.opencode ?? {}, "permissionMode");
  const configMode = readConfiguredPermissionMode(harnessConfig);
  const manifestMode = readRecordedPermissionMode(manifest);
  const hasOpenCodeScaffold = Boolean(opencodeConfig) || hasManagedOpencodeFiles(manifest);

  if (hasPermissionModeConfig && configMode.error) {
    results.push(fail(`${projectConfigRelative} opencode.permissionMode invalid: ${configMode.error}`));
    return;
  }

  if (manifestMode.error) {
    results.push(fail(manifestMode.error));
    return;
  }

  if (!hasOpenCodeScaffold && !configMode.value && !hasPermissionModeConfig) {
    return;
  }

  if (manifestMode.value) {
    results.push(pass(`OpenCode permission mode: ${manifestMode.value} (${manifestMode.source})`));
    if (configMode.value && configMode.value !== manifestMode.value) {
      results.push(warn(`OpenCode permission mode config mismatch: manifest=${manifestMode.value}, ${projectConfigRelative}=${configMode.value}`));
    }
    return;
  }

  if (configMode.value) {
    results.push(warn(`OpenCode permission mode: ${configMode.value} (inferred from ${projectConfigRelative}; manifest missing opencodePermissionMode)`));
    return;
  }

  if (hasOpenCodeScaffold) {
    results.push(warn("OpenCode permission mode: default (legacy inferred; manifest/config missing explicit permission mode)"));
  }
}

async function checkOpenCodeCommandSurface(projectPath, harnessConfig, opencodeState, results) {
  const opencodeConfig = opencodeState?.config ?? null;
  const runtimeSource = opencodeState?.runtimeSource?.pluginSource ?? null;
  const commandDirectory = await findFirstDirectory(projectPath, [".opencode/command", ".opencode/commands"]);
  const configuredSurface = readConfiguredCommandSurface(harnessConfig);
  const hasCommandSurfaceConfig = Object.prototype.hasOwnProperty.call(harnessConfig?.opencode ?? {}, "commandSurface");

  if (hasCommandSurfaceConfig && configuredSurface.error) {
    results.push(fail(`${projectConfigRelative} opencode.commandSurface invalid: ${configuredSurface.error}`));
  }

  const installedCommands = new Set();
  if (commandDirectory) {
    const files = await listFiles(commandDirectory, ".md");
    for (const file of files) {
      installedCommands.add(toPosix(path.relative(projectPath, file)));
    }
  }

  const hasOpenCodeScaffold = Boolean(opencodeConfig) || commandDirectory !== null;
  if (!hasOpenCodeScaffold) {
    return;
  }

  if (runtimeSource === "package" && commandDirectory === null) {
    const effectiveSurface = configuredSurface.value
      ? (configuredSurface.isLegacyAlias ? "legacy-full" : configuredSurface.value)
      : "minimal";

    results.push(pass(`OpenCode command surface [${effectiveSurface}] required normal commands provided by package plugin ${opencodePackagePluginSpecifier}`));
    if (effectiveSurface === "advanced" || effectiveSurface === "legacy-full") {
      results.push(pass(`OpenCode command surface [${effectiveSurface}] standard helper commands provided by package plugin ${opencodePackagePluginSpecifier}`));
      results.push(pass(`OpenCode command surface [${effectiveSurface}] advanced commands provided by package plugin ${opencodePackagePluginSpecifier}`));
    } else if (effectiveSurface === "standard") {
      results.push(pass(`OpenCode command surface [${effectiveSurface}] standard helper commands provided by package plugin ${opencodePackagePluginSpecifier}`));
      results.push(pass(`OpenCode command surface [${effectiveSurface}] advanced-only commands absent by configured package surface`));
    } else {
      results.push(pass(`OpenCode command surface [${effectiveSurface}] non-minimal commands omitted by configured package surface`));
    }
    return;
  }

  const hasAdvancedOnlyCommands = advancedOnlyOpencodeCommands.some((relative) => installedCommands.has(relative));
  const hasStandardCommands = standardOpencodeCommands.some((relative) => installedCommands.has(relative));
  const effectiveSurface = configuredSurface.value
    ? (configuredSurface.isLegacyAlias ? "legacy-full" : configuredSurface.value)
    : (hasAdvancedOnlyCommands ? "legacy-full" : hasStandardCommands ? "standard" : "minimal");
  const presentStandardCommands = standardOpencodeCommands.filter((relative) => installedCommands.has(relative));
  const presentAdvancedOnlyCommands = advancedOnlyOpencodeCommands.filter((relative) => installedCommands.has(relative));

  const missingNormalCommands = requiredNormalOpencodeCommands.filter((relative) => !installedCommands.has(relative));
  if (missingNormalCommands.length > 0) {
    results.push(fail(`OpenCode command surface [${effectiveSurface}] missing required normal command(s): ${missingNormalCommands.join(", ")}`));
  } else {
    results.push(pass(`OpenCode command surface [${effectiveSurface}] required normal commands present`));
  }

  if (effectiveSurface === "advanced" || effectiveSurface === "legacy-full") {
    const missingStandardCommands = standardOpencodeCommands.filter((relative) => !installedCommands.has(relative));
    if (missingStandardCommands.length > 0) {
      results.push(fail(`OpenCode command surface [${effectiveSurface}] missing standard helper command(s): ${missingStandardCommands.join(", ")}`));
    } else {
      results.push(pass(`OpenCode command surface [${effectiveSurface}] standard helper commands present`));
    }

    const missingAdvancedCommands = advancedOnlyOpencodeCommands.filter((relative) => !installedCommands.has(relative));
    if (missingAdvancedCommands.length > 0) {
      results.push(fail(`OpenCode command surface [${effectiveSurface}] missing advanced command(s): ${missingAdvancedCommands.join(", ")}`));
    } else {
      results.push(pass(`OpenCode command surface [${effectiveSurface}] advanced commands present`));
    }
    return;
  }

  if (effectiveSurface === "standard") {
    const missingStandardCommands = standardOpencodeCommands.filter((relative) => !installedCommands.has(relative));
    if (missingStandardCommands.length > 0) {
      results.push(fail(`OpenCode command surface [standard] missing standard helper command(s): ${missingStandardCommands.join(", ")}`));
    } else {
      results.push(pass("OpenCode command surface [standard] standard helper commands present"));
    }

    if (presentAdvancedOnlyCommands.length > 0) {
      results.push(warn(`OpenCode command surface [standard] includes advanced-only command(s): ${presentAdvancedOnlyCommands.join(", ")}`));
    } else {
      results.push(pass("OpenCode command surface [standard] advanced-only commands absent"));
    }
    return;
  }

  if (presentStandardCommands.length > 0 || presentAdvancedOnlyCommands.length > 0) {
    results.push(warn(`OpenCode command surface [minimal] includes non-minimal command(s): ${[...presentStandardCommands, ...presentAdvancedOnlyCommands].join(", ")}`));
  } else {
    results.push(pass("OpenCode command surface [minimal] non-minimal commands absent"));
  }
}

async function checkOpenCodePlaceholderDrift(projectPath, results) {
  for (const relative of await listOpenCodeHarnessFiles(projectPath)) {
    const content = await fs.readFile(path.join(projectPath, relative), "utf8");
    if (!containsUnresolvedModelProfilePlaceholder(content)) {
      continue;
    }

    results.push(fail(`OpenCode placeholder [UNRESOLVED] ${relative} still contains MODEL_PROFILE placeholders. Run \`marionettist diff --project <path> --with-opencode\` or \`marionettist sync --project <path> --with-opencode\` to regenerate runtime OpenCode files.`));
  }
}

function evaluateAgentModelStatus(context) {
  const {
    role,
    agentName,
    canonicalSource,
    adapterSource,
    opencodeAssignments,
    agentExists,
    agentContent,
    agentRelative
  } = context;

  const canonicalValue = readProfileDefault(canonicalSource.profiles, role);
  const adapterValue = readAdapterExpectedModel(adapterSource, role, agentName);
  const opencodeValue = readOpencodeExpectedModel(opencodeAssignments, role, agentName);

  if (canonicalSource.exists) {
    if (!canonicalValue) {
      return buildModelStatus("MISSING", `${agentRelative} expected profile ${role}.default is missing from .marionettist/model-profiles.yml. ${modelDriftRemediation}`);
    }
  }

  if (!canonicalSource.exists) {
    return buildModelStatus("MISSING", `${agentRelative} cannot determine expected model because .marionettist/model-profiles.yml is missing for profile ${role}. ${modelDriftRemediation}`);
  }

  const expectedModel = canonicalValue;
  const expectedSourceLabel = ".marionettist/model-profiles.yml";

  if (adapterValue && adapterValue !== expectedModel) {
    return buildModelStatus("CONFLICT", `${agentRelative} adapter config ${adapterSource.label} expects ${adapterValue} for ${agentName}, but ${expectedSourceLabel} profile ${role}.default expects ${expectedModel}. ${modelDriftRemediation}`);
  }

  if (opencodeValue && opencodeValue !== expectedModel) {
    return buildModelStatus("CONFLICT", `${agentRelative} opencode.jsonc model data expects ${opencodeValue} for ${agentName}, but ${expectedSourceLabel} profile ${role}.default expects ${expectedModel}. ${modelDriftRemediation}`);
  }

  if (!agentExists) {
    return buildModelStatus("MISSING", `${agentRelative} missing; expected model ${expectedModel} from ${expectedSourceLabel} profile ${role}.default. ${modelDriftRemediation}`);
  }

  try {
    const frontmatter = parseFrontmatter(agentContent);
    const actualModel = typeof frontmatter.model === "string" && frontmatter.model.length > 0
      ? frontmatter.model
      : null;

    if (!actualModel) {
      return buildModelStatus("MISSING", `${agentRelative} is missing frontmatter model; expected ${expectedModel} from ${expectedSourceLabel} profile ${role}.default. ${modelDriftRemediation}`);
    }

    if (actualModel !== expectedModel) {
      return buildModelStatus("DRIFTED", `${agentRelative} model drifted to ${actualModel}; expected ${expectedModel} from ${expectedSourceLabel} profile ${role}.default. ${modelDriftRemediation}`);
    }

    return buildModelStatus("OK", `${agentRelative} model ${actualModel} matches ${expectedSourceLabel} profile ${role}.default.`);
  } catch (error) {
    return buildModelStatus("MISSING", `${agentRelative} frontmatter could not be parsed for model drift inspection: ${error.message}. ${modelDriftRemediation}`);
  }
}

async function readModelProfileSource(filePath, sourceType) {
  const label = sourceType === "canonical" ? ".marionettist/model-profiles.yml" : path.basename(filePath);
  if (!(await exists(filePath))) {
    return { label, exists: false, profiles: null, parseError: null };
  }

  try {
    const parsed = parseSimpleYaml(await fs.readFile(filePath, "utf8"), { validateIndentation: true });
    return {
      label,
      exists: true,
      profiles: normalizeProfileDefaults(parsed.profiles),
      parseError: null
    };
  } catch (error) {
    return { label, exists: true, profiles: null, parseError: error };
  }
}

async function readAdapterModelSource(projectPath) {
  for (const relative of opencodeAdapterConfigRelatives) {
    const absolute = path.join(projectPath, relative);
    if (!(await exists(absolute))) {
      continue;
    }

    try {
      const parsed = parseSimpleYaml(await fs.readFile(absolute, "utf8"), { validateIndentation: true });
      return {
        label: relative,
        exists: true,
        profiles: normalizeProfileDefaults(parsed.profiles ?? parsed.modelProfiles ?? parsed.models?.profiles),
        agentModels: normalizeNamedModelMap(parsed.agents),
        parseError: null
      };
    } catch (error) {
      return { label: relative, exists: true, profiles: null, agentModels: {}, parseError: error };
    }
  }

  return { label: opencodeAdapterConfigRelatives[0], exists: false, profiles: null, agentModels: {}, parseError: null };
}

function extractOpencodeModelAssignments(opencodeConfig) {
  if (!opencodeConfig || typeof opencodeConfig !== "object") {
    return { byAgent: {}, byRole: {}, globalModel: null };
  }

  return {
    globalModel: readString(opencodeConfig.model),
    byAgent: {
      ...normalizeNamedModelMap(opencodeConfig.agents),
      ...normalizeNamedModelMap(opencodeConfig.models)
    },
    byRole: {
      ...normalizeNamedModelMap(opencodeConfig.roles),
      ...pickKnownRoleModels(opencodeConfig.models)
    }
  };
}

function pickKnownRoleModels(value) {
  const result = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }
  for (const role of requiredModelProfiles) {
    const model = readModelField(value[role]);
    if (model) {
      result[role] = model;
    }
  }
  return result;
}

function normalizeProfileDefaults(rawProfiles) {
  if (!rawProfiles || typeof rawProfiles !== "object" || Array.isArray(rawProfiles)) {
    return null;
  }

  const normalized = {};
  for (const role of requiredModelProfiles) {
    normalized[role] = {
      default: readModelField(rawProfiles[role]?.default ?? rawProfiles[role])
    };
  }
  return normalized;
}

function normalizeNamedModelMap(rawMap) {
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
    return {};
  }

  const normalized = {};
  for (const [key, value] of Object.entries(rawMap)) {
    const model = readModelField(value);
    if (model) {
      normalized[key] = model;
    }
  }
  return normalized;
}

function readProfileDefault(profiles, role) {
  const value = profiles?.[role]?.default;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readAdapterExpectedModel(adapterSource, role, agentName) {
  return adapterSource.agentModels?.[agentName] ?? readProfileDefault(adapterSource.profiles, role);
}

function readOpencodeExpectedModel(opencodeAssignments, role, agentName) {
  return opencodeAssignments.byAgent?.[agentName] ?? opencodeAssignments.byRole?.[role] ?? opencodeAssignments.globalModel;
}

function readModelField(value) {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return readString(value.model) ?? readString(value.default);
  }
  return null;
}

function readString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function buildModelStatus(status, message) {
  return { status, message: `OpenCode model [${status}] ${message}` };
}

function statusResult(status, message) {
  if (status === "OK") {
    return pass(message);
  }
  return warn(message);
}

async function findFirstDirectory(projectPath, relatives) {
  for (const relative of relatives) {
    const absolute = path.join(projectPath, relative);
    if (await isDirectory(absolute)) {
      return absolute;
    }
  }
  return null;
}

async function checkMarkdownFrontmatterDirectory(projectPath, relatives, label, results) {
  let foundDirectory = false;
  for (const relative of relatives) {
    const absolute = path.join(projectPath, relative);
    if (!(await isDirectory(absolute))) {
      continue;
    }
    foundDirectory = true;
    const files = await listFiles(absolute, ".md");
    if (files.length === 0) {
      results.push(warn(`${relative} contains no markdown files`));
      continue;
    }
    for (const file of files) {
      const fileRelative = toPosix(path.relative(projectPath, file));
      try {
        parseFrontmatter(await fs.readFile(file, "utf8"));
        results.push(pass(`${fileRelative} frontmatter parsed`));
      } catch (error) {
        results.push(fail(`${fileRelative} frontmatter failed: ${error.message}`));
      }
    }
  }
  if (!foundDirectory) {
    results.push(warn(`${label} directory not found; optional OpenCode scaffold not installed`));
  }
}

async function checkSkills(projectPath, results) {
  const skillRoots = [path.join(projectPath, ".agents", "skills"), path.join(projectPath, "skills")];
  const skillFiles = [];
  for (const root of skillRoots) {
    if (await isDirectory(root)) {
      skillFiles.push(...(await listSkillFiles(root)));
    }
  }

  if (skillFiles.length === 0) {
    results.push(warn("no skill SKILL.md files found"));
    return;
  }

  for (const skillFile of skillFiles) {
    const relative = toPosix(path.relative(projectPath, skillFile));
    try {
      const frontmatter = parseFrontmatter(await fs.readFile(skillFile, "utf8"));
      if (!frontmatter.name) {
        results.push(fail(`${relative} missing required frontmatter: name`));
        continue;
      }
      if (!frontmatter.description) {
        results.push(fail(`${relative} missing required frontmatter: description`));
        continue;
      }
      results.push(pass(`${relative} valid`));
    } catch (error) {
      results.push(fail(`${relative} frontmatter failed: ${error.message}`));
    }
  }
}

async function checkActiveTask(projectPath, results) {
  const activePath = path.join(projectPath, ".task", "active.json");
  const legacyContextPath = path.join(projectPath, ".task", "context-pack.md");
  if (!(await exists(activePath))) {
    results.push(warn(".task/active.json not found; no active task selected"));
    if (await exists(legacyContextPath)) {
      results.push(warn("legacy .task/context-pack.md found; migrate to .task/<date>/<task-slug>/context-pack.md"));
    }
    return;
  }

  let active;
  try {
    active = JSON.parse(await fs.readFile(activePath, "utf8"));
    results.push(pass(".task/active.json parsed"));
  } catch (error) {
    results.push(fail(`.task/active.json parse failed: ${error.message}`));
    return;
  }

  if (!active.taskId) {
    results.push(fail(".task/active.json missing taskId"));
    return;
  }

  const taskRelative = toPosix(path.join(".task", active.taskId));
  const taskDirectory = path.join(projectPath, taskRelative);
  if (!(await isDirectory(taskDirectory))) {
    results.push(fail(`${taskRelative} missing`));
    return;
  }
  results.push(pass(`${taskRelative} found`));

  const statePath = path.join(taskDirectory, "state.json");
  if (!(await exists(statePath))) {
    results.push(fail(`${taskRelative}/state.json missing`));
    return;
  }

  let state;
  try {
    state = JSON.parse(await fs.readFile(statePath, "utf8"));
    results.push(pass(`${taskRelative}/state.json parsed`));
  } catch (error) {
    results.push(fail(`${taskRelative}/state.json parse failed: ${error.message}`));
    return;
  }

  const contextPackPath = path.join(taskDirectory, "context-pack.md");
  const contextPackRequired = Boolean(active.allowedToCode || state.allowedToCode || codingPhases.has(active.phase) || codingPhases.has(state.phase));
  if (await exists(contextPackPath)) {
    results.push(pass(`${taskRelative}/context-pack.md found`));
  } else if (contextPackRequired) {
    results.push(fail(`${taskRelative}/context-pack.md missing for coding-stage task`));
  } else {
    results.push(warn(`${taskRelative}/context-pack.md not found; required before coding`));
  }

  if (await exists(legacyContextPath)) {
    results.push(warn("legacy .task/context-pack.md found; active task should use task-scoped context-pack.md"));
  }
}

function parseFrontmatter(content) {
  const normalized = content.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    throw new Error("missing opening ---");
  }
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error("missing closing ---");
  }
  return parseSimpleYaml(match[1], { validateIndentation: true });
}

function stripJsonComments(content) {
  let output = "";
  let inString = false;
  let quote = "";
  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];
    const next = content[index + 1];
    if (inString) {
      output += current;
      if (current === "\\") {
        output += next ?? "";
        index += 1;
      } else if (current === quote) {
        inString = false;
      }
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      quote = current;
      output += current;
      continue;
    }
    if (current === "/" && next === "/") {
      while (index < content.length && content[index] !== "\n") {
        index += 1;
      }
      output += "\n";
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }
    output += current;
  }
  return output;
}

async function listSkillFiles(root) {
  const files = await listFiles(root, "SKILL.md");
  return files.filter((file) => path.basename(file) === "SKILL.md");
}

async function listFiles(directory, extensionOrName) {
  const files = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolute, extensionOrName)));
      continue;
    }
    if (extensionOrName.startsWith(".")) {
      if (entry.name.endsWith(extensionOrName)) files.push(absolute);
    } else if (entry.name === extensionOrName) {
      files.push(absolute);
    }
  }
  return files;
}

async function listOpenCodeHarnessFiles(projectPath) {
  const files = [];

  for (const root of [".opencode/agent", ".opencode/agents", ".opencode/command", ".opencode/commands"]) {
    const absolute = path.join(projectPath, root);
    if (!(await isDirectory(absolute))) {
      continue;
    }

    const markdownFiles = await listFiles(absolute, ".md");
    for (const file of markdownFiles) {
      const relative = toPosix(path.relative(projectPath, file));
      const basename = path.basename(relative);
      if (!basename.startsWith("marionettist-")) {
        continue;
      }
      files.push(relative);
    }
  }

  files.sort((left, right) => left.localeCompare(right));
  return files;
}

function containsUnresolvedModelProfilePlaceholder(content) {
  return /\{\{MODEL_PROFILE_[A-Z_]+\}\}/.test(content);
}

function readConfiguredCommandSurface(harnessConfig) {
  const value = harnessConfig?.opencode?.commandSurface;
  const label = `${projectConfigRelative} opencode.commandSurface`;
  const result = validateOptionalOpencodeCommandSurface(value, label);
  return {
    value: result.value,
    error: typeof result.error === "string"
      ? stripValidationErrorPrefix(result.error, label)
      : result.error,
    isLegacyAlias: result.isLegacyAlias
  };
}

function readConfiguredPermissionMode(harnessConfig) {
  const value = harnessConfig?.opencode?.permissionMode;
  const label = `${projectConfigRelative} opencode.permissionMode`;
  const result = validateOptionalOpencodePermissionMode(value, label);
  return {
    value: result.value,
    error: typeof result.error === "string"
      ? stripValidationErrorPrefix(result.error, label)
      : result.error
  };
}

function detectOpenCodeRuntimeSource(manifest, harnessConfig, opencodeConfig) {
  const manifestSource = readConfiguredPluginSourceValue(manifest?.opencodePluginSource, ".marionettist/manifest.json opencodePluginSource");
  if (manifestSource.value) {
    return { pluginSource: manifestSource.value, sourceLabel: ".marionettist/manifest.json opencodePluginSource" };
  }

  const configSource = readConfiguredPluginSourceValue(harnessConfig?.opencode?.pluginSource, `${projectConfigRelative} opencode.pluginSource`);
  if (configSource.value) {
    return { pluginSource: configSource.value, sourceLabel: `${projectConfigRelative} opencode.pluginSource` };
  }

  const opencodePlugins = Array.isArray(opencodeConfig?.plugin) ? opencodeConfig.plugin : [];
  if (opencodePlugins.some((entry) => readPluginSpecifier(entry) === opencodePackagePluginSpecifier)) {
    return { pluginSource: "package", sourceLabel: `opencode.jsonc plugin ${opencodePackagePluginSpecifier}` };
  }
  if (opencodePlugins.some((entry) => readPluginSpecifier(entry) === opencodeLocalPluginSpecifier)) {
    return { pluginSource: "local", sourceLabel: `opencode.jsonc plugin ${opencodeLocalPluginSpecifier}` };
  }

  const managedPluginFile = manifest?.managedFiles?.some((file) => file.path === ".opencode/plugin/opencode-tasks.js");
  if (managedPluginFile) {
    return { pluginSource: "local", sourceLabel: ".marionettist/manifest.json managed local OpenCode plugin" };
  }

  return { pluginSource: null, sourceLabel: null };
}

function readPluginSpecifier(entry) {
  if (typeof entry === "string") {
    return entry;
  }
  if (Array.isArray(entry) && typeof entry[0] === "string") {
    return entry[0];
  }
  return null;
}

function readConfiguredPluginSourceValue(value, label) {
  const result = validateOptionalOpencodePluginSource(value, label);
  return { value: result.value, error: result.error };
}

function stripValidationErrorPrefix(error, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return error.replace(new RegExp(`^${escapedLabel} invalid: `, "u"), "");
}

function readRecordedPermissionMode(manifest) {
  const topLevel = validateOptionalOpencodePermissionMode(manifest?.opencodePermissionMode, ".marionettist/manifest.json opencodePermissionMode");
  if (topLevel.error) {
    return { value: null, error: topLevel.error, source: null };
  }
  if (topLevel.value) {
    return { value: topLevel.value, error: null, source: "manifest" };
  }

  if (!hasManagedOpencodeFiles(manifest)) {
    return { value: null, error: null, source: null };
  }

  const recordedValues = (manifest?.managedFiles ?? [])
    .filter((file) => file.adapter === "opencode" && file.permissionMode !== undefined)
    .map((file) => validateOptionalOpencodePermissionMode(file.permissionMode, `.marionettist/manifest.json managedFiles[${file.path}] permissionMode`));
  const invalid = recordedValues.find((result) => result.error);
  if (invalid) {
    return { value: null, error: invalid.error, source: null };
  }

  if (recordedValues.some((result) => result.value === "loose")) {
    return { value: "loose", error: null, source: "manifest metadata" };
  }
  if (recordedValues.some((result) => result.value === "moderate")) {
    return { value: "moderate", error: null, source: "manifest metadata" };
  }
  if (recordedValues.some((result) => result.value === "default")) {
    return { value: "default", error: null, source: "manifest metadata" };
  }

  return { value: null, error: null, source: null };
}

function readConfiguredDistributionModeValue(value, label) {
  const result = validateOptionalDistributionMode(value, label);
  return { value: result.value, error: result.error };
}

function readConfiguredGatePolicyDefaultMode(harnessConfig) {
  const value = harnessConfig?.gatePolicy?.defaultMode;
  const result = validateOptionalGatePolicyDefaultMode(value, `${projectConfigRelative} gatePolicy.defaultMode`);
  return {
    value: result.value,
    error: result.error
  };
}

function hasManagedOpencodeFiles(manifest) {
  return manifest?.managedFiles?.some((file) => file.path === "opencode.jsonc" || file.path.startsWith(".opencode/")) ?? false;
}

async function exists(absolute) {
  try {
    await fs.access(absolute);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(absolute) {
  try {
    return (await fs.stat(absolute)).isDirectory();
  } catch {
    return false;
  }
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function pass(message) {
  return { level: "PASS", message };
}

function warn(message) {
  return { level: "WARN", message };
}

function fail(message) {
  return { level: "FAIL", message };
}

function printResults(results) {
  console.log("Marionettist Doctor");
  console.log("");
  for (const result of results) {
    console.log(`${result.level.padEnd(5)} ${result.message}`);
  }
}
