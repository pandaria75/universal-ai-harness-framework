import path from "node:path";
import { listFiles, pathExists, readText, toPosixPath } from "./files.js";
import { listResolvedOpencodeTemplateRelatives, projectConfigRelative, resolveCoreTemplateSource, resolveOpencodeTemplateSource, skillsRoot, templatesRoot, versionFile } from "./framework-paths.js";
import { extractManagedBlock, replaceManagedBlock } from "./managed-block.js";
import { sha256 } from "./hash.js";
import { buildManifest, getManagedFileHash, manifestFileMap, manifestRelative, normalizeDistributionMode, normalizeOpencodeCommandSurface, normalizeOpencodePermissionMode, normalizeOpencodePluginSource, opencodeArtifactAdapter, readManifest, validateOptionalDistributionMode, validateOptionalOpencodeCommandSurface, validateOptionalOpencodePermissionMode, validateOptionalOpencodePluginSource } from "./manifest.js";
import { buildOpencodeAgentTemplateVariables, buildResolvedOpencodeAgentModelConfigs, loadModelProfiles, loadModelProfilesState } from "./model-profiles.js";
import { getOpencodePermissionPolicy } from "./opencode-permissions.js";
import { renderWithMetadata, stableJsonStringify } from "./render.js";
import { parseSimpleYaml } from "./yaml.js";
import { piPackageSource } from "./pi-package.js";

const coreTemplateTargets = new Map([
  ["AGENTS.md", "AGENTS.md"],
  [".marionettist/model-profiles.yml", ".marionettist/model-profiles.yml"],
  [".marionettist/tier-policy.yml", ".marionettist/tier-policy.yml"],
  ["marionettist.config.yaml", projectConfigRelative],
  ["docs/project/marionettist-workflow.md", "docs/project/marionettist-workflow.md"],
  ["docs/project/knowledge-map.md", "docs/project/knowledge-map.md"],
  ["docs/project/tier-policy-workflow-design.md", "docs/project/tier-policy-workflow-design.md"],
  ["docs/current/system-map.md", "docs/current/system-map.md"],
  ["docs/target/architecture-intent.md", "docs/target/architecture-intent.md"],
  ["rules/00-repository-rules.md", ".aiassistant/rules/00-repository-rules.md"],
  ["rules/workflow-rules.md", ".aiassistant/rules/workflow-rules.md"]
]);

const opencodeManagedPrefix = ".opencode/";
const opencodeValidatorTemplatePrefix = "agents/validators/";
const opencodeProjectConfigSource = "opencode.jsonc";
const opencodeLocalPluginPath = "./.opencode/plugin/opencode-tasks.js";
const opencodePackagePluginSpecifier = "marionettist-pathway-opencode";
const minimalOpencodeCommandRelatives = new Set([
  "commands/marionettist.md",
  "commands/marionettist-dev.md",
  "commands/marionettist-incident.md",
  "commands/marionettist-docs.md",
  "commands/marionettist-config.md"
]);
const standardOnlyOpencodeCommandRelatives = new Set([
  "commands/marionettist-context.md",
  "commands/marionettist-status.md",
  "commands/marionettist-continue.md"
]);
const advancedOnlyOpencodeCommandRelatives = new Set([
  "commands/marionettist-feature.md",
  "commands/marionettist-bugfix.md",
  "commands/marionettist-refactor.md"
]);
const knowledgeModeValues = new Set(["standard", "mudball"]);
const knowledgeMaturityValues = new Set(["L0", "L1", "L2", "L3", "L4"]);
const projectIdentityConfigVariableMap = new Map([
  [["project", "name"], "projectName"],
  [["project", "type"], "projectType"],
  [["project", "architecture"], "architecture"],
  [["project", "primaryLanguage"], "primaryLanguage"]
]);

async function buildFrameworkAssets(projectPath, options = {}) {
  const explicitVariables = options.variables ?? {};
  const resolvedIdentityVariables = await readProjectIdentityFromConfig(projectPath);
  const variables = normalizeKnowledgeVariables({
    ...resolvedIdentityVariables,
    ...explicitVariables
  });
  const assets = [];
  const modelProfilesState = await loadModelProfilesState(projectPath);

  for (const [sourceRelative, targetRelative] of coreTemplateTargets.entries()) {
    const resolvedSource = await resolveCoreTemplateSource(sourceRelative);
    if (!resolvedSource) {
      throw new Error(`Framework template source not found: templates/${sourceRelative}`);
    }
    const templateContent = await readText(resolvedSource.sourcePath);
    const renderState = buildFrameworkAssetRenderState(sourceRelative, variables, {
      modelProfilesState,
      marionettistLanguageState: options.marionettistLanguageState,
      distributionModeState: options.distributionModeState,
      opencodeCommandSurfaceState: options.opencodeCommandSurfaceState,
      opencodePermissionModeState: options.opencodePermissionModeState,
      opencodePluginSourceState: options.opencodePluginSourceState
    });
    const rendered = renderWithMetadata({
      templateContent,
      variables: renderState.variables,
      renderContext: renderState.renderContext,
      postRender: finalizeFrameworkAssetRender
    });
    const content = rendered.content;
    const kind = targetRelative === "AGENTS.md" ? "managed-block" : "file";
    const managedContent = kind === "managed-block" ? extractManagedBlock(content) : content;
    if (!managedContent) {
      throw new Error(`Template is missing marionettist managed block markers: ${sourceRelative}`);
    }

    assets.push({
      sourceRelative: resolvedSource.sourceRelative,
      targetRelative,
      targetPath: path.join(projectPath, targetRelative),
      kind,
      content,
      managedContent,
      frameworkHash: sha256(managedContent),
      templateHash: rendered.templateHash,
      renderedHash: rendered.renderedHash,
      renderInputHash: rendered.renderInputHash
    });
  }

  const skillFiles = await listFiles(skillsRoot);
  for (const sourcePath of skillFiles) {
    const sourceRelative = toPosixPath(path.relative(skillsRoot, sourcePath));
    const targetRelative = toPosixPath(path.join(".agents/skills", sourceRelative));
    const content = await readText(sourcePath);
    assets.push({
      sourceRelative: `skills/${sourceRelative}`,
      targetRelative,
      targetPath: path.join(projectPath, targetRelative),
      kind: "file",
      content,
      managedContent: content,
      frameworkHash: sha256(content)
    });
  }

  if (options.includeOpencode) {
    assets.push(...await buildOpencodeAssets(projectPath, variables, {
      distributionModeState: options.distributionModeState,
      commandSurfaceState: options.opencodeCommandSurfaceState,
      permissionModeState: options.opencodePermissionModeState,
      pluginSourceState: options.opencodePluginSourceState
    }));
  }

  return assets;
}

async function buildOpencodeAssets(projectPath, variables = {}, states = {}) {
  const assets = [];
  const opencodeRenderState = await resolveOpencodeRenderState(projectPath, variables, states);
  const opencodeVariables = opencodeRenderState.variables;
  const opencodeRelatives = await listResolvedOpencodeTemplateRelatives();
  const validatorProjectGuidance = await buildValidatorProjectGuidance(projectPath, opencodeVariables);
  const commandSurface = normalizeOpencodeCommandSurface(states.commandSurfaceState?.value ?? "advanced", "effective OpenCode command surface");
  const permissionMode = normalizeOpencodePermissionMode(states.permissionModeState?.permissionMode ?? "default", "effective OpenCode permission mode");
  const pluginSource = normalizeOpencodePluginSource(states.pluginSourceState?.pluginSource ?? "package", "effective OpenCode plugin source");

  for (const sourceRelative of opencodeRelatives) {
    const resolvedSource = await resolveOpencodeTemplateSource(sourceRelative);
    if (!resolvedSource) {
      throw new Error(`Framework OpenCode template source not found: templates/pathways/opencode/${sourceRelative}`);
    }
    if (sourceRelative.startsWith(opencodeValidatorTemplatePrefix)) {
      continue;
    }
    if (sourceRelative.startsWith("commands/") && !shouldIncludeOpencodeCommand(sourceRelative, commandSurface)) {
      continue;
    }
    if (pluginSource === "package" && sourceRelative !== opencodeProjectConfigSource) {
      continue;
    }

    const targetRelative = sourceRelative === opencodeProjectConfigSource
      ? sourceRelative
      : toPosixPath(path.join(".opencode", sourceRelative));

    const templateContent = await readText(resolvedSource.sourcePath);
    const rendered = renderWithMetadata({
      templateContent,
      variables: sourceRelative === "agents/marionettist-validator.md"
        ? {
          ...opencodeVariables,
          validatorProjectGuidance
        }
        : opencodeVariables,
      renderContext: sourceRelative === opencodeProjectConfigSource
        ? opencodeRenderState.configRenderContext
        : null
    });
    const content = rendered.content;

    assets.push({
      sourceRelative: resolvedSource.sourceRelative,
      targetRelative,
      targetPath: path.join(projectPath, targetRelative),
      kind: "file",
      adapter: opencodeArtifactAdapter,
      templateHash: rendered.templateHash,
      renderedHash: rendered.renderedHash,
      renderInputHash: rendered.renderInputHash,
      commandSurface,
      permissionMode,
      pluginSource,
      content,
      managedContent: content,
      frameworkHash: sha256(content)
    });
  }

  return assets;
}

async function resolveOpencodeRenderState(projectPath, variables = {}, states = {}) {
  const profiles = await loadModelProfiles(projectPath);
  const resolvedAgentModels = buildResolvedOpencodeAgentModelConfigs(profiles);
  const permissionPolicy = getOpencodePermissionPolicy(states.permissionModeState?.permissionMode ?? "default");
  const pluginSource = normalizeOpencodePluginSource(states.pluginSourceState?.pluginSource ?? "package", "effective OpenCode plugin source");

  return {
    variables: {
      ...buildOpencodeAgentTemplateVariables(profiles, variables),
      ...permissionPolicy.renderVariables,
      opencodePluginArray: stableJsonStringify(buildDefaultOpencodePluginEntries(pluginSource))
    },
    configRenderContext: {
      pathwayMode: "plugin-first",
      generatedFilesFallback: true,
      pluginSource,
      pluginPackageSpecifier: opencodePackagePluginSpecifier,
      localFallbackPluginPath: opencodeLocalPluginPath,
      distributionMode: states.distributionModeState?.value ?? null,
      commandSurface: states.commandSurfaceState?.value ?? null,
      permissionMode: states.permissionModeState?.permissionMode ?? null,
      resolvedAgentModels
    }
  };
}

function buildDefaultOpencodePluginEntries(pluginSource = "package") {
  const source = normalizeOpencodePluginSource(pluginSource, "OpenCode plugin source");
  return [source === "package" ? opencodePackagePluginSpecifier : opencodeLocalPluginPath];
}

async function buildValidatorProjectGuidance(projectPath, variables = {}) {
  const guidanceParts = [];
  const genericFallback = await readResolvedOpencodeTemplateText("agents/validators/generic-fallback.md");
  guidanceParts.push(genericFallback.trim());

  guidanceParts.push([
    "# Scheduled Validator Guidance",
    "",
    "- If `opencode.jsonc` enables `opencode-tasks` and the caller asks for recurring, unattended, or cron-style validation, prefer proposing an `opencode-tasks` schedule over an ad hoc loop.",
    "- Do not modify user-global scheduler state or create recurring tasks unless the caller explicitly asks for scheduling.",
    "- For normal one-off validation, continue to run the smallest relevant validation command directly."
  ].join("\n"));

  if (await detectGradleKotlinProject(projectPath, variables)) {
    const gradleKotlin = await readResolvedOpencodeTemplateText("agents/validators/gradle-kotlin.md");
    guidanceParts.push(gradleKotlin.trim());
  }

  if (await detectMavenProject(projectPath, variables)) {
    const maven = await readResolvedOpencodeTemplateText("agents/validators/maven.md");
    guidanceParts.push(maven.trim());
  }

  if (await detectNodeProject(projectPath, variables)) {
    const node = await readResolvedOpencodeTemplateText("agents/validators/node.md");
    guidanceParts.push(node.trim());
  }

  if (await detectPythonProject(projectPath, variables)) {
    const python = await readResolvedOpencodeTemplateText("agents/validators/python.md");
    guidanceParts.push(python.trim());
  }

  return guidanceParts.join("\n\n");
}

async function readResolvedOpencodeTemplateText(sourceRelative) {
  const resolvedSource = await resolveOpencodeTemplateSource(sourceRelative);
  if (!resolvedSource) {
    throw new Error(`Framework OpenCode template source not found: templates/pathways/opencode/${sourceRelative}`);
  }

  return readText(resolvedSource.sourcePath);
}

async function detectGradleKotlinProject(projectPath, variables = {}) {
  const primaryLanguage = String(variables.primaryLanguage ?? "").toLowerCase();
  const projectType = String(variables.projectType ?? "").toLowerCase();
  const architecture = String(variables.architecture ?? "").toLowerCase();

  if (primaryLanguage.includes("kotlin") || projectType.includes("gradle") || architecture.includes("gradle")) {
    return true;
  }

  const gradleMarkers = [
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "gradlew",
    "gradlew.bat"
  ];

  for (const marker of gradleMarkers) {
    if (await pathExists(path.join(projectPath, marker))) {
      return true;
    }
  }

  return false;
}

async function detectMavenProject(projectPath, variables = {}) {
  const projectType = String(variables.projectType ?? "").toLowerCase();
  const architecture = String(variables.architecture ?? "").toLowerCase();

  if (projectType.includes("maven") || projectType.includes("mvn") || architecture.includes("maven")) {
    return true;
  }

  const mavenMarkers = [
    "pom.xml",
    "mvnw",
    "mvnw.cmd",
    ".mvn"
  ];

  for (const marker of mavenMarkers) {
    if (await pathExists(path.join(projectPath, marker))) {
      return true;
    }
  }

  return false;
}

async function detectNodeProject(projectPath, variables = {}) {
  const primaryLanguage = String(variables.primaryLanguage ?? "").toLowerCase();
  const projectType = String(variables.projectType ?? "").toLowerCase();
  const architecture = String(variables.architecture ?? "").toLowerCase();

  if (
    primaryLanguage.includes("javascript")
    || primaryLanguage.includes("typescript")
    || primaryLanguage.includes("node")
    || projectType.includes("node")
    || projectType.includes("npm")
    || projectType.includes("pnpm")
    || projectType.includes("yarn")
    || architecture.includes("node")
  ) {
    return true;
  }

  const nodeMarkers = [
    "package.json",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "pnpm-lock.yaml",
    "yarn.lock"
  ];

  for (const marker of nodeMarkers) {
    if (await pathExists(path.join(projectPath, marker))) {
      return true;
    }
  }

  return false;
}

async function detectPythonProject(projectPath, variables = {}) {
  const primaryLanguage = String(variables.primaryLanguage ?? "").toLowerCase();
  const projectType = String(variables.projectType ?? "").toLowerCase();
  const architecture = String(variables.architecture ?? "").toLowerCase();

  if (primaryLanguage.includes("python") || projectType.includes("python") || architecture.includes("python")) {
    return true;
  }

  const pythonMarkers = [
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "requirements.txt",
    "tox.ini",
    "noxfile.py",
    "pytest.ini"
  ];

  for (const marker of pythonMarkers) {
    if (await pathExists(path.join(projectPath, marker))) {
      return true;
    }
  }

  return false;
}

function hasManagedOpencodeAssets(previousManifest) {
  return previousManifest?.managedFiles?.some((file) => file.path === opencodeProjectConfigSource || file.path.startsWith(opencodeManagedPrefix)) ?? false;
}

function hasManagedAdvancedOpencodeCommands(previousManifest) {
  return previousManifest?.managedFiles?.some((file) => advancedOnlyOpencodeCommandRelatives.has(stripOpencodeManagedPrefix(file.path))) ?? false;
}

function hasManagedStandardOpencodeCommands(previousManifest) {
  return previousManifest?.managedFiles?.some((file) => standardOnlyOpencodeCommandRelatives.has(stripOpencodeManagedPrefix(file.path))) ?? false;
}

function stripOpencodeManagedPrefix(targetRelative) {
  return targetRelative.startsWith(opencodeManagedPrefix)
    ? targetRelative.slice(opencodeManagedPrefix.length)
    : targetRelative;
}

function shouldIncludeOpencodeCommand(sourceRelative, commandSurface) {
  if (!sourceRelative.startsWith("commands/")) {
    return true;
  }

  if (commandSurface === "advanced") {
    return true;
  }

  if (commandSurface === "standard") {
    return minimalOpencodeCommandRelatives.has(sourceRelative) || standardOnlyOpencodeCommandRelatives.has(sourceRelative);
  }

  return minimalOpencodeCommandRelatives.has(sourceRelative);
}

async function resolveDistributionModeState(projectPath, previousManifest, options = {}, mode = "sync") {
  const explicitDistributionMode = options.distributionMode === null || options.distributionMode === undefined
    ? null
    : normalizeDistributionMode(options.distributionMode, "--distribution-mode value");
  const recordedDistributionMode = validateOptionalDistributionMode(previousManifest?.distributionMode, "manifest distributionMode");
  const configuredDistributionMode = await readConfiguredDistributionMode(projectPath);

  assertValidDistributionModeSource(recordedDistributionMode, mode, "manifest");
  assertValidDistributionModeSource(configuredDistributionMode, mode, "config");

  let value = null;
  let source = null;
  let reportedValue = null;
  let reportedSource = null;
  let legacyInference = false;

  if (explicitDistributionMode !== null) {
    value = explicitDistributionMode;
    source = "cli";
    reportedValue = value;
    reportedSource = source;
  } else if (recordedDistributionMode.value !== null) {
    value = recordedDistributionMode.value;
    source = "manifest";
    reportedValue = value;
    reportedSource = source;
  } else if (configuredDistributionMode.value !== null) {
    value = configuredDistributionMode.value;
    source = "config";
    reportedValue = value;
    reportedSource = source;
  } else if (mode === "init") {
    value = "embedded";
    source = "default-new-install";
    reportedValue = value;
    reportedSource = source;
  } else if (previousManifest) {
    reportedValue = "embedded";
    reportedSource = "legacy-inferred";
    legacyInference = true;
  }

  return {
    value,
    source,
    reportedValue,
    reportedSource,
    legacyInference,
    persistToConfig: value !== null && (
      mode === "init"
      || source === "cli"
      || source === "manifest"
      || source === "config"
    )
  };
}

async function resolveMarionettistLanguageState(projectPath, options = {}) {
  const explicitValue = normalizeConfiguredStringValue(options.variables?.marionettistLanguage);
  const configuredValue = await readConfiguredMarionettistLanguage(projectPath);

  if (explicitValue !== null) {
    return {
      value: explicitValue,
      source: "prompt",
      persistToConfig: true
    };
  }

  if (configuredValue.value !== null) {
    return {
      value: configuredValue.value,
      source: "config",
      persistToConfig: true
    };
  }

  return {
    value: null,
    source: null,
    persistToConfig: false
  };
}

async function resolveOpencodeSurfaceAndPermissionState(projectPath, previousManifest, options = {}) {
  const configuredCommandSurface = await readConfiguredOpencodeCommandSurface(projectPath);
  const configuredPermissionMode = await readConfiguredOpencodePermissionMode(projectPath);
  const configuredPluginSource = await readConfiguredOpencodePluginSource(projectPath);
  const explicitCommandSurface = options.opencodeCommandSurface === null || options.opencodeCommandSurface === undefined
    ? null
    : normalizeOpencodeCommandSurface(options.opencodeCommandSurface, "--opencode-command-surface value");
  const explicitPermissionMode = options.opencodePermissionMode === null || options.opencodePermissionMode === undefined
    ? null
    : normalizeOpencodePermissionMode(options.opencodePermissionMode, "--opencode-permission-mode value");
  const explicitPluginSource = options.opencodePluginSource === null || options.opencodePluginSource === undefined
    ? null
    : normalizeOpencodePluginSource(options.opencodePluginSource, "--opencode-plugin-source value");
  const managedCommandSurface = inferManagedOpencodeCommandSurface(previousManifest);
  const managedPermissionMode = inferManagedOpencodePermissionMode(previousManifest);
  const managedPluginSource = inferManagedOpencodePluginSource(previousManifest);
  const hasOpencode = explicitCommandSurface !== null
    || explicitPermissionMode !== null
    || explicitPluginSource !== null
    || options.withOpencode === true
    || hasManagedOpencodeAssets(previousManifest)
    || configuredCommandSurface.value !== null
    || configuredPermissionMode.value !== null
    || configuredPluginSource.value !== null;

  let value = null;
  let source = null;
  let permissionMode = null;
  let permissionModeSource = null;
  let pluginSource = null;
  let pluginSourceSource = null;

  assertValidOpencodeCommandSurfaceSource(configuredCommandSurface, "config");
  assertValidOpencodePermissionModeSource(configuredPermissionMode, "config");
  assertValidOpencodePluginSourceSource(configuredPluginSource, "config");
  assertValidOpencodePermissionModeSource(validateOptionalOpencodePermissionMode(previousManifest?.opencodePermissionMode, "manifest opencodePermissionMode"), "manifest");
  assertValidOpencodePluginSourceSource(validateOptionalOpencodePluginSource(previousManifest?.opencodePluginSource, "manifest opencodePluginSource"), "manifest");

  if (explicitCommandSurface !== null) {
    value = explicitCommandSurface;
    source = "cli";
  } else if (configuredCommandSurface.value !== null) {
    value = configuredCommandSurface.value;
    source = "config";
  } else if (managedCommandSurface.value !== null) {
    value = managedCommandSurface.value;
    source = managedCommandSurface.source;
  } else if (hasManagedOpencodeAssets(previousManifest)) {
    value = "minimal";
    source = "existing-managed-assets";
  } else if (options.withOpencode === true) {
    value = "minimal";
    source = "default-new-install";
  }

  if (explicitPermissionMode !== null) {
    permissionMode = explicitPermissionMode;
    permissionModeSource = "cli";
  } else if (configuredPermissionMode.value !== null) {
    permissionMode = configuredPermissionMode.value;
    permissionModeSource = "config";
  } else if (managedPermissionMode.value !== null) {
    permissionMode = managedPermissionMode.value;
    permissionModeSource = managedPermissionMode.source;
  } else if (hasManagedOpencodeAssets(previousManifest) || options.withOpencode === true) {
    permissionMode = "default";
    permissionModeSource = hasManagedOpencodeAssets(previousManifest) ? "legacy-default" : "default-new-install";
  }

  if (explicitPluginSource !== null) {
    pluginSource = explicitPluginSource;
    pluginSourceSource = "cli";
  } else if (configuredPluginSource.value !== null) {
    pluginSource = configuredPluginSource.value;
    pluginSourceSource = "config";
  } else if (managedPluginSource.value !== null) {
    pluginSource = managedPluginSource.value;
    pluginSourceSource = managedPluginSource.source;
  } else if (options.withOpencode === true) {
    pluginSource = "package";
    pluginSourceSource = "default-new-install";
  }

  return {
    includeOpencode: options.withOpencode === false ? false : hasOpencode,
    value,
    source,
    permissionMode,
    permissionModeSource,
    pluginSource,
    pluginSourceSource,
    persistToConfig: value !== null && (
      source === "cli"
      || source === "config"
      || options.withOpencode === true
    ),
    persistPermissionModeToConfig: permissionMode !== null && (
      permissionModeSource === "cli"
      || permissionModeSource === "config"
      || options.withOpencode === true
    ),
    persistPluginSourceToConfig: pluginSource !== null && (
      pluginSourceSource === "cli"
      || pluginSourceSource === "config"
      || options.withOpencode === true
    )
  };
}

async function readConfiguredOpencodeCommandSurface(projectPath) {
  const configPath = path.join(projectPath, projectConfigRelative);
  if (!(await pathExists(configPath))) {
    return { value: null, error: null, rawValue: null, isLegacyAlias: false };
  }

  try {
    const parsed = parseSimpleYaml(await readText(configPath));
    const value = parsed?.opencode?.commandSurface;
    return validateOptionalOpencodeCommandSurface(value, `${projectConfigRelative} opencode.commandSurface`);
  } catch {
    return { value: null, error: null, rawValue: null, isLegacyAlias: false };
  }
}

async function readConfiguredOpencodePermissionMode(projectPath) {
  const configPath = path.join(projectPath, projectConfigRelative);
  if (!(await pathExists(configPath))) {
    return { value: null, error: null, rawValue: null };
  }

  try {
    const parsed = parseSimpleYaml(await readText(configPath));
    const value = parsed?.opencode?.permissionMode;
    return validateOptionalOpencodePermissionMode(value, `${projectConfigRelative} opencode.permissionMode`);
  } catch {
    return { value: null, error: null, rawValue: null };
  }
}

async function readConfiguredOpencodePluginSource(projectPath) {
  const configPath = path.join(projectPath, projectConfigRelative);
  if (!(await pathExists(configPath))) {
    return { value: null, error: null, rawValue: null };
  }

  try {
    const parsed = parseSimpleYaml(await readText(configPath));
    const value = parsed?.opencode?.pluginSource;
    return validateOptionalOpencodePluginSource(value, `${projectConfigRelative} opencode.pluginSource`);
  } catch {
    return { value: null, error: null, rawValue: null };
  }
}

function inferManagedOpencodeCommandSurface(previousManifest) {
  if (!hasManagedOpencodeAssets(previousManifest)) {
    return { value: null, source: null };
  }

  const recordedValues = (previousManifest?.managedFiles ?? [])
    .filter((file) => file.adapter === opencodeArtifactAdapter && typeof file.commandSurface === "string" && file.commandSurface.length > 0)
    .map((file) => validateOptionalOpencodeCommandSurface(file.commandSurface, `manifest managedFiles[${file.path}] commandSurface`))
    .filter((result) => result.value !== null);

  if (recordedValues.some((result) => result.value === "advanced")) {
    return { value: "advanced", source: recordedValues.some((result) => result.isLegacyAlias) ? "legacy-manifest" : "manifest-metadata" };
  }

  if (recordedValues.some((result) => result.value === "standard")) {
    return { value: "standard", source: "manifest-metadata" };
  }

  if (recordedValues.some((result) => result.value === "minimal")) {
    return { value: "minimal", source: "manifest-metadata" };
  }

  if (hasManagedAdvancedOpencodeCommands(previousManifest)) {
    return { value: "advanced", source: "legacy-manifest" };
  }

  if (hasManagedStandardOpencodeCommands(previousManifest)) {
    return { value: "standard", source: "existing-managed-assets" };
  }

  return { value: "minimal", source: "existing-managed-assets" };
}

function inferManagedOpencodePermissionMode(previousManifest) {
  const topLevel = validateOptionalOpencodePermissionMode(previousManifest?.opencodePermissionMode, "manifest opencodePermissionMode");
  if (topLevel.value !== null) {
    return { value: topLevel.value, source: "manifest" };
  }

  if (!hasManagedOpencodeAssets(previousManifest)) {
    return { value: null, source: null };
  }

  const recordedValues = (previousManifest?.managedFiles ?? [])
    .filter((file) => file.adapter === opencodeArtifactAdapter && typeof file.permissionMode === "string" && file.permissionMode.length > 0)
    .map((file) => validateOptionalOpencodePermissionMode(file.permissionMode, `manifest managedFiles[${file.path}] permissionMode`))
    .filter((result) => result.value !== null);

  if (recordedValues.some((result) => result.value === "loose")) {
    return { value: "loose", source: "manifest-metadata" };
  }

  if (recordedValues.some((result) => result.value === "moderate")) {
    return { value: "moderate", source: "manifest-metadata" };
  }

  if (recordedValues.some((result) => result.value === "default")) {
    return { value: "default", source: "manifest-metadata" };
  }

  return { value: "default", source: "legacy-default" };
}

function inferManagedOpencodePluginSource(previousManifest) {
  const topLevel = validateOptionalOpencodePluginSource(previousManifest?.opencodePluginSource, "manifest opencodePluginSource");
  if (topLevel.value !== null) {
    return { value: topLevel.value, source: "manifest" };
  }

  if (!hasManagedOpencodeAssets(previousManifest)) {
    return { value: null, source: null };
  }

  const recordedValues = (previousManifest?.managedFiles ?? [])
    .filter((file) => file.adapter === opencodeArtifactAdapter && typeof file.pluginSource === "string" && file.pluginSource.length > 0)
    .map((file) => validateOptionalOpencodePluginSource(file.pluginSource, `manifest managedFiles[${file.path}] pluginSource`))
    .filter((result) => result.value !== null);

  if (recordedValues.some((result) => result.value === "package")) {
    return { value: "package", source: "manifest-metadata" };
  }

  if (recordedValues.some((result) => result.value === "local")) {
    return { value: "local", source: "manifest-metadata" };
  }

  return { value: "local", source: "existing-managed-assets" };
}

async function readConfiguredDistributionMode(projectPath) {
  const configPath = path.join(projectPath, projectConfigRelative);
  if (!(await pathExists(configPath))) {
    return { value: null, error: null, rawValue: null };
  }

  try {
    const parsed = parseSimpleYaml(await readText(configPath));
    const value = parsed?.distribution?.mode;
    return validateOptionalDistributionMode(value, `${projectConfigRelative} distribution.mode`);
  } catch {
    return { value: null, error: null, rawValue: null };
  }
}

export async function readConfiguredMarionettistLanguage(projectPath) {
  const configPath = path.join(projectPath, projectConfigRelative);
  if (!(await pathExists(configPath))) {
    return { value: null, rawValue: null };
  }

  try {
    const parsed = parseSimpleYaml(await readText(configPath));
    const value = normalizeConfiguredStringValue(parsed?.marionettist?.language);
    return { value, rawValue: parsed?.marionettist?.language ?? null };
  } catch {
    return { value: null, rawValue: null };
  }
}

async function readProjectIdentityFromConfig(projectPath) {
  const configPath = path.join(projectPath, projectConfigRelative);
  if (!(await pathExists(configPath))) {
    return {};
  }

  try {
    const parsed = parseSimpleYaml(await readText(configPath));
    const identity = {};

    for (const [pathSegments, variableName] of projectIdentityConfigVariableMap.entries()) {
      const value = normalizeProjectIdentityConfigValue(readNestedProperty(parsed, pathSegments));
      if (value !== null) {
        identity[variableName] = value;
      }
    }

    return identity;
  } catch {
    return {};
  }
}

function readNestedProperty(value, pathSegments = []) {
  let current = value;
  for (const segment of pathSegments) {
    if (!current || typeof current !== "object") {
      return null;
    }
    current = current[segment];
  }
  return current;
}

function normalizeProjectIdentityConfigValue(value) {
  return normalizeConfiguredStringValue(value);
}

function normalizeConfiguredStringValue(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function assertValidDistributionModeSource(result, mode, sourceKind) {
  if (!result?.error) {
    return;
  }

  const subject = sourceKind === "manifest"
    ? ".marionettist/manifest.json distributionMode"
    : `${projectConfigRelative} distribution.mode`;
  throw new Error(
    `Cannot continue because ${subject} is invalid for marionettist ${mode}. ${result.error} Fix the recorded distribution mode or remove it before rerunning. Use \`marionettist doctor --project <path>\` for a detailed report.`
  );
}

function assertValidOpencodeCommandSurfaceSource(result, sourceKind) {
  if (!result?.error) {
    return;
  }

  const subject = sourceKind === "manifest"
    ? ".marionettist/manifest.json managedFiles[*].commandSurface"
    : `${projectConfigRelative} opencode.commandSurface`;
  throw new Error(
    `Cannot continue because ${subject} is invalid. ${result.error} Fix the recorded OpenCode command surface or remove it before rerunning. Use \`marionettist doctor --project <path>\` for a detailed report.`
  );
}

function assertValidOpencodePermissionModeSource(result, sourceKind) {
  if (!result?.error) {
    return;
  }

  const subject = sourceKind === "manifest"
    ? ".marionettist/manifest.json opencodePermissionMode"
    : `${projectConfigRelative} opencode.permissionMode`;
  throw new Error(
    `Cannot continue because ${subject} is invalid. ${result.error} Fix the recorded OpenCode permission mode or remove it before rerunning. Use \`marionettist doctor --project <path>\` for a detailed report.`
  );
}

function assertValidOpencodePluginSourceSource(result, sourceKind) {
  if (!result?.error) {
    return;
  }

  const subject = sourceKind === "manifest"
    ? ".marionettist/manifest.json opencodePluginSource"
    : `${projectConfigRelative} opencode.pluginSource`;
  throw new Error(
    `Cannot continue because ${subject} is invalid. ${result.error} Fix the recorded OpenCode plugin source or remove it before rerunning. Use \`marionettist doctor --project <path>\` for a detailed report.`
  );
}

function renderProjectConfigWithSelections(content, states = {}) {
  const sections = [];

  if (states.distributionModeState?.persistToConfig && states.distributionModeState.value) {
    sections.push(`distribution:\n  mode: "${states.distributionModeState.value}"`);
  }

  const opencodeLines = [];
  if (states.opencodeCommandSurfaceState?.persistToConfig && states.opencodeCommandSurfaceState.value) {
    opencodeLines.push(`  commandSurface: "${states.opencodeCommandSurfaceState.value}"`);
  }
  if (states.opencodePermissionModeState?.persistPermissionModeToConfig && states.opencodePermissionModeState.permissionMode) {
    opencodeLines.push(`  permissionMode: "${states.opencodePermissionModeState.permissionMode}"`);
  }
  if (states.opencodePluginSourceState?.persistPluginSourceToConfig && states.opencodePluginSourceState.pluginSource) {
    opencodeLines.push(`  pluginSource: "${states.opencodePluginSourceState.pluginSource}"`);
  }
  if (opencodeLines.length > 0) {
    sections.push(`opencode:\n${opencodeLines.join("\n")}`);
  }

  if (sections.length === 0) {
    return content;
  }

  const trimmed = content.replace(/\s*$/u, "");
  return `${trimmed}\n\n${sections.join("\n\n")}\n`;
}

function buildFrameworkAssetRenderState(sourceRelative, variables, states = {}) {
  if (sourceRelative === "marionettist.config.yaml") {
    return {
      variables: {
        ...variables,
        marionettistLanguage: states.marionettistLanguageState?.value ?? null
      },
      renderContext: {
        harnessConfigSelections: buildHarnessConfigRenderSelections(states)
      }
    };
  }

  return {
    variables,
    renderContext: null
  };
}

function buildMarionettistLanguageRenderBlock(marionettistLanguageState = {}) {
  if (!marionettistLanguageState?.persistToConfig || !marionettistLanguageState.value) {
    return "";
  }

  return `marionettist:\n  language: "${marionettistLanguageState.value}"`;
}

function buildHarnessConfigRenderSelections(states = {}) {
  return {
    marionettistLanguageState: states.marionettistLanguageState?.persistToConfig
      ? {
        value: states.marionettistLanguageState.value,
        persistToConfig: true
      }
      : {
        value: null,
        persistToConfig: false
      },
    distributionModeState: states.distributionModeState?.persistToConfig
      ? {
        value: states.distributionModeState.value,
        persistToConfig: true
      }
      : {
        value: null,
        persistToConfig: false
      },
    opencodeCommandSurfaceState: states.opencodeCommandSurfaceState?.persistToConfig
      ? {
        value: states.opencodeCommandSurfaceState.value,
        persistToConfig: true
      }
      : {
        value: null,
        persistToConfig: false
      },
    opencodePermissionModeState: states.opencodePermissionModeState?.persistPermissionModeToConfig
      ? {
        permissionMode: states.opencodePermissionModeState.permissionMode,
        persistPermissionModeToConfig: true
      }
      : {
        permissionMode: null,
        persistPermissionModeToConfig: false
      },
    opencodePluginSourceState: states.opencodePluginSourceState?.persistPluginSourceToConfig
      ? {
        pluginSource: states.opencodePluginSourceState.pluginSource,
        persistPluginSourceToConfig: true
      }
      : {
        pluginSource: null,
        persistPluginSourceToConfig: false
      }
  };
}

function finalizeFrameworkAssetRender({ content, renderContext }) {
  if (content.includes("__MARIONETTIST_LANGUAGE_BLOCK__")) {
    const marionettistLanguageBlock = buildMarionettistLanguageRenderBlock(
      renderContext?.harnessConfigSelections?.marionettistLanguageState
    );
    content = content.replace(
      /\n__MARIONETTIST_LANGUAGE_BLOCK__\n\n/u,
      marionettistLanguageBlock ? `\n${marionettistLanguageBlock}\n\n` : "\n"
    );
  }

  if (renderContext?.harnessConfigSelections) {
    return renderProjectConfigWithSelections(content, renderContext.harnessConfigSelections);
  }

  return content;
}

function normalizeKnowledgeVariables(variables = {}) {
  const knowledgeMode = normalizeKnowledgeMode(variables.knowledgeMode ?? "standard");
  const knowledgeMaturity = normalizeKnowledgeMaturity(variables.knowledgeMaturity ?? "L1");

  return {
    ...variables,
    knowledgeMode,
    knowledgeMaturity
  };
}

function normalizeKnowledgeMode(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!knowledgeModeValues.has(normalized)) {
    throw new Error(`Unsupported knowledge mode: ${value}`);
  }
  return normalized;
}

function normalizeKnowledgeMaturity(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!knowledgeMaturityValues.has(normalized)) {
    throw new Error(`Unsupported knowledge maturity: ${value}`);
  }
  return normalized;
}

function currentManagedContent(asset, currentContent) {
  if (asset.kind === "managed-block") {
    return extractManagedBlock(currentContent);
  }
  return currentContent;
}

function plannedContent(asset, currentContent) {
  if (asset.kind === "managed-block" && currentContent !== null) {
    return replaceManagedBlock(currentContent, asset.content);
  }
  return asset.content;
}

function statusForManagedAsset({ exists, previous, currentHash, frameworkHash }) {
  if (!exists) {
    return "missing";
  }

  const previousHash = getManagedFileHash(previous);
  const localChanged = currentHash !== previousHash;
  const frameworkChanged = frameworkHash !== previousHash;

  if (!localChanged && !frameworkChanged) {
    return "unchanged";
  }
  if (!localChanged && frameworkChanged) {
    return "update";
  }
  if (localChanged && !frameworkChanged) {
    return "modified-local";
  }
  return "conflict";
}

function shouldManageInitAsset(asset, exists) {
  return !exists || asset.kind === "managed-block";
}

async function operationForAsset(asset, mode, previousByPath, options = {}) {
  const exists = await pathExists(asset.targetPath);
  const currentContent = exists ? await readText(asset.targetPath) : null;
  const currentManaged = exists ? currentManagedContent(asset, currentContent) : null;
  const currentHash = currentManaged === null ? null : sha256(currentManaged);
  const previous = previousByPath.get(asset.targetRelative);

  if (mode === "init") {
    let status = exists ? "skip-project-local" : "new-managed";
    let action = status;
    let content = asset.content;
    let managed = shouldManageInitAsset(asset, exists);

    if (exists) {
      const strategy = options.conflictStrategies?.[asset.targetRelative];
      if (strategy === "backup") {
        status = "backup-and-write";
        action = "backup-and-write";
        managed = true;
      } else if (strategy === "overwrite") {
        status = "overwrite-local";
        action = "overwrite-local";
        managed = true;
      }
    }

    if (asset.kind === "file" && exists && currentHash === asset.frameworkHash) {
      status = "unchanged";
      action = "unchanged";
      managed = true;
    }

    if (asset.kind === "managed-block" && exists && status !== "backup-and-write" && status !== "overwrite-local") {
      status = currentHash === asset.frameworkHash ? "unchanged" : "update-managed-block";
      action = status;
      content = plannedContent(asset, currentContent);
    }

    return {
      type: "file",
      ...asset,
      content,
      exists,
      currentHash,
      previousHash: getManagedFileHash(previous),
      status,
      action,
      managed
    };
  }

  if (!previous) {
    return {
      type: "file",
      ...asset,
      exists,
      currentHash,
      previousHash: null,
      status: exists ? "skip-project-local" : "new-managed",
      action: exists ? "skip-project-local" : "new-managed",
      managed: !exists
    };
  }

  const status = statusForManagedAsset({
    exists,
    previous,
    currentHash,
    frameworkHash: asset.frameworkHash
  });

  return {
    type: "file",
    ...asset,
    content: plannedContent(asset, currentContent),
    exists,
    currentHash,
    previousHash: getManagedFileHash(previous),
    status,
    action: status,
    managed: true
  };
}

async function operationForOrphan(previous, projectPath) {
  const targetPath = path.join(projectPath, previous.path);
  const exists = await pathExists(targetPath);
  const currentContent = exists ? await readText(targetPath) : null;
  const currentManaged = previous.kind === "managed-block" && currentContent !== null
    ? extractManagedBlock(currentContent)
    : currentContent;

  return {
    type: "file",
    sourceRelative: previous.source,
    targetRelative: previous.path,
    targetPath,
    kind: previous.kind,
    adapter: previous.adapter,
    renderedHash: previous.renderedHash,
    templateHash: previous.templateHash,
    renderInputHash: previous.renderInputHash,
    commandSurface: previous.commandSurface,
    permissionMode: previous.permissionMode,
    pluginSource: previous.pluginSource,
    exists,
    currentHash: currentManaged === null ? null : sha256(currentManaged),
    previousHash: getManagedFileHash(previous),
    frameworkHash: getManagedFileHash(previous),
    status: "orphan-managed",
    action: "orphan-managed",
    managed: true
  };
}

export async function buildPlan(projectPath, mode, options = {}) {
  const version = (await readText(versionFile)).trim();
  const previousManifest = await readManifest(projectPath);

  if (mode !== "init" && !previousManifest) {
    throw new Error(`Marionettist manifest not found: ${path.join(projectPath, manifestRelative)}. Run marionettist init first.`);
  }

  const previousByPath = manifestFileMap(previousManifest);
  const piState = {
    enabled: options.withPi === true || (options.withPi !== false && previousManifest?.piPackageSource === piPackageSource),
    source: piPackageSource,
    scope: "project"
  };
  const operations = [];
  const marionettistLanguageState = await resolveMarionettistLanguageState(projectPath, options);
  const distributionModeState = await resolveDistributionModeState(projectPath, previousManifest, options, mode);
  const opencodeCommandSurfaceState = await resolveOpencodeSurfaceAndPermissionState(projectPath, previousManifest, options);
  const opencodePermissionModeState = {
    permissionMode: opencodeCommandSurfaceState.permissionMode,
    permissionModeSource: opencodeCommandSurfaceState.permissionModeSource,
    persistPermissionModeToConfig: opencodeCommandSurfaceState.persistPermissionModeToConfig
  };
  const opencodePluginSourceState = {
    pluginSource: opencodeCommandSurfaceState.pluginSource,
    pluginSourceSource: opencodeCommandSurfaceState.pluginSourceSource,
    persistPluginSourceToConfig: opencodeCommandSurfaceState.persistPluginSourceToConfig
  };
  const assets = await buildFrameworkAssets(projectPath, {
    ...options,
    marionettistLanguageState,
    includeOpencode: opencodeCommandSurfaceState.includeOpencode,
    distributionModeState,
    opencodeCommandSurfaceState,
    opencodePermissionModeState,
    opencodePluginSourceState
  });
  const assetPaths = new Set(assets.map((asset) => asset.targetRelative));

  for (const asset of assets) {
    operations.push(await operationForAsset(asset, mode, previousByPath, options));
  }

  if (previousManifest) {
    for (const previous of previousManifest.managedFiles) {
      if (!assetPaths.has(previous.path)) {
        operations.push(await operationForOrphan(previous, projectPath));
      }
    }
  }

  operations.push({
    type: "directory",
    targetRelative: ".task",
    targetPath: path.join(projectPath, ".task"),
    action: "ensure-directory",
    status: "ensure-directory"
  });

  const manifest = buildManifest({
    version,
    installedAt: new Date().toISOString(),
    previousManifest,
    operations,
    force: options.force,
    distributionMode: distributionModeState.value,
    opencodePermissionMode: opencodePermissionModeState.permissionMode,
    opencodePluginSource: opencodePluginSourceState.pluginSource,
    piPackageSource: piState.enabled ? piPackageSource : null
  });

  operations.push({
    type: "manifest",
    targetRelative: manifestRelative,
    targetPath: path.join(projectPath, manifestRelative),
    action: "write-manifest",
    status: "write-manifest",
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    manifest
  });

  return { version, previousManifest, manifest, operations, marionettistLanguageState, distributionModeState, opencodeCommandSurfaceState, opencodePermissionModeState, opencodePluginSourceState, piState };
}
