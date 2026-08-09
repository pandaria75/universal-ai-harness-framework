import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildPlan } from "../src/core/plan.js";
import { parseSimpleYaml } from "../src/core/yaml.js";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const marionettistBin = path.join(repoRoot, "bin", "marionettist.js");
const frameworkVersion = (await fs.readFile(path.join(repoRoot, "VERSION"), "utf8")).trim();
const tempBase = process.env.HARNESS_SMOKE_TMP || os.tmpdir();
const dryRunProject = path.join(tempBase, `harness-smoke-dry-${process.pid}`);
const project = path.join(tempBase, `harness-smoke-${process.pid}`);
const distributionProject = path.join(tempBase, `harness-smoke-distribution-${process.pid}`);
const mudballProject = path.join(tempBase, `harness-smoke-mudball-${process.pid}`);
const existingLocalProject = path.join(tempBase, `harness-smoke-existing-${process.pid}`);
const opencodeProject = path.join(tempBase, `harness-smoke-opencode-${process.pid}`);
const backfillProject = path.join(tempBase, `harness-smoke-backfill-${process.pid}`);
const gradleProject = path.join(tempBase, `harness-smoke-gradle-${process.pid}`);
const legacyDistributionProject = path.join(tempBase, `harness-smoke-legacy-mode-${process.pid}`);
const gatePolicyProject = path.join(tempBase, `harness-smoke-gate-policy-${process.pid}`);
const tierPolicyProject = path.join(tempBase, `harness-smoke-tier-policy-${process.pid}`);
const clearWorkflowProject = path.join(tempBase, `harness-smoke-clear-${process.pid}`);
const clearManagedOnlyProject = path.join(tempBase, `harness-smoke-clear-managed-only-${process.pid}`);
const clearPartialFailureProject = path.join(tempBase, `harness-smoke-clear-partial-${process.pid}`);
const clearSymlinkEscapeProject = path.join(tempBase, `harness-smoke-clear-symlink-${process.pid}`);
const validatorSnippetPathText = ["templates", "pathways", "opencode", "agents", "validators"].join("/");
const prototypeOpencodeCommandName = "marionettist-pathway-prototype";
const pathwayConfigOpencodeCommandName = "marionettist-pathway-config";
const publishableScanRoots = ["README.md", "README.zh-CN.md", "docs", "templates", "skills", "src", "scripts", "package.json"];
const publishableScanExcludedDirectories = [path.join("docs", "blogs")];
const normalOpencodeCommands = [
  "marionettist.md",
  "marionettist-dev.md",
  "marionettist-incident.md",
  "marionettist-docs.md",
  "marionettist-config.md"
];
const standardOpencodeCommands = [
  "marionettist-context.md",
  "marionettist-status.md",
  "marionettist-continue.md"
];
const advancedOnlyOpencodeCommands = [
  "marionettist-feature.md",
  "marionettist-bugfix.md",
  "marionettist-refactor.md"
];
const nonMinimalOpencodeCommands = [...standardOpencodeCommands, ...advancedOnlyOpencodeCommands];
const forbiddenSensitivePatterns = [
  { label: "username fragment", regex: new RegExp(["haoyu", "gao"].join("\\."), "g") },
  { label: "C:\\Users\\", regex: /C:\\Users\\/g },
  { label: "E:\\KOTLIN_PROJECT", regex: /E:\\KOTLIN_PROJECT/g },
  { label: "E:\\AI_WORK", regex: /E:\\AI_WORK/g },
  { label: "legacy project prefix", regex: new RegExp(["unisic", ""].join("-"), "g") },
  { label: "legacy map term", regex: new RegExp(["module", "map"].join("-"), "g") },
  { label: validatorSnippetPathText, regex: /templates\/pathways\/opencode\/agents\/validators/g }
];
const binaryLikeExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".jar",
  ".class"
]);

try {
  await cleanupPaths(dryRunProject, project, distributionProject, mudballProject, existingLocalProject, opencodeProject, backfillProject, gradleProject, legacyDistributionProject, gatePolicyProject, tierPolicyProject, clearWorkflowProject, clearManagedOnlyProject, clearPartialFailureProject, clearSymlinkEscapeProject);

  const dryRunOutput = await harness("init", "--project", dryRunProject, "--dry-run", "--auto");
  assertIncludes(dryRunOutput, "distribution mode: embedded");
  assertIncludes(dryRunOutput, "new-managed: AGENTS.md");
  assertIncludes(dryRunOutput, "manifest-preview: .marionettist/manifest.json");
  assert(!(await pathExists(dryRunProject)), "init --dry-run must not create the target project directory");

  const initOutput = await harness("init", "--project", project, "--auto");
  assertIncludes(initOutput, "distribution mode: embedded");
  assertIncludes(initOutput, "write-manifest: .marionettist/manifest.json");
  assertIncludes(initOutput, "new-managed: .marionettist/tier-policy.yml");

  await assertKnowledgeInitAndManagedDocs(project, { mode: "standard", maturity: "L1" });
  await assertDistributionModeRecorded(project, "embedded");
  await assertFreshInitIdentityPreservation(project);
  await assertTierPolicyManagedInstallAndPreservation(project);

  const distributionOutput = await harness("init", "--project", distributionProject, "--auto", "--distribution-mode", "adapter");
  assertIncludes(distributionOutput, "distribution mode: adapter");
  await assertDistributionModeRecorded(distributionProject, "adapter");

  const mudballInitOutput = await harness("init", "--project", mudballProject, "--auto", "--knowledge-mode", "mudball", "--knowledge-maturity", "L0");
  assertIncludes(mudballInitOutput, "write-manifest: .marionettist/manifest.json");
  await assertKnowledgeInitAndManagedDocs(mudballProject, { mode: "mudball", maturity: "L0" });
  await assertManagedDocsLocalPreservation(mudballProject);
  await assertManagedDocsMissingDetection(mudballProject);

  await assertInitPreservesExistingLocalKnowledge(existingLocalProject);
  await assertSyncPreservesRecordedDistributionMode(distributionProject, "adapter");
  await assertLegacyDistributionModeReportingAndNoInjection(legacyDistributionProject);
  await assertGatePolicyDoctorValidation(gatePolicyProject);
  await assertTierPolicyConflictDoctorValidation(tierPolicyProject);

  const doctorOutput = await assertProjectDoctorBaseline(project, "baseline project");
  assertIncludes(doctorOutput, "PASS  marionettist.config.yaml parsed");
  assertIncludes(doctorOutput, "PASS  .marionettist/tier-policy.yml parsed");
  assertIncludes(doctorOutput, "PASS  distribution mode: embedded (manifest)");
  assertIncludes(doctorOutput, "PASS  gate policy default mode: balanced (marionettist.config.yaml)");
  assertIncludes(doctorOutput, "WARN  .task/active.json not found; no active task selected");

  await assertTaskStateContractTemplate();
  await assertP1DocsAndTemplateCoverage();

  const manifestPath = path.join(project, ".marionettist", "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  assert(manifest.schemaVersion === 1, "manifest schemaVersion must be 1");
  assert(manifest.frameworkVersion === frameworkVersion, "manifest must record framework version");
  assert(manifest.managedFiles.some((file) => file.path === "AGENTS.md" && file.kind === "managed-block"), "manifest must include AGENTS.md as a managed block");
  assert(!manifest.managedFiles.some((file) => file.path.startsWith(".opencode/")), "manifest must not include OpenCode assets when init runs without --with-opencode");
  await assertCoreManifestRenderMetadata(project, manifest);

  const cleanDiffOutput = await harness("diff", "--project", project);
  assertIncludes(cleanDiffOutput, "distribution mode: embedded");
  assertIncludes(cleanDiffOutput, "unchanged: AGENTS.md");
  assertIncludes(cleanDiffOutput, "unchanged: .aiassistant/rules/workflow-rules.md");

  const managedRulePath = path.join(project, ".aiassistant", "rules", "workflow-rules.md");
  await fs.appendFile(managedRulePath, "\nLocal validation change.\n", "utf8");
  const modifiedRuleContent = await fs.readFile(managedRulePath, "utf8");

  const modifiedDiffOutput = await harness("diff", "--project", project);
  assertIncludes(modifiedDiffOutput, "modified-local: .aiassistant/rules/workflow-rules.md");

  const syncDryRunOutput = await harness("sync", "--project", project, "--dry-run");
  assertIncludes(syncDryRunOutput, "distribution mode: embedded");
  assertIncludes(syncDryRunOutput, "modified-local: .aiassistant/rules/workflow-rules.md");
  const afterSyncDryRunRuleContent = await fs.readFile(managedRulePath, "utf8");
  assert(afterSyncDryRunRuleContent === modifiedRuleContent, "sync --dry-run must not overwrite local modifications");

  const agentsPath = path.join(project, "AGENTS.md");
  await fs.appendFile(agentsPath, "\nProject local note.\n", "utf8");
  const localAgentsDiffOutput = await harness("diff", "--project", project);
  assertIncludes(localAgentsDiffOutput, "unchanged: AGENTS.md");

  const missingFilePath = path.join(project, "docs", "project", "marionettist-workflow.md");
  await fs.rm(missingFilePath);
  const missingDiffOutput = await harness("diff", "--project", project);
  assertIncludes(missingDiffOutput, "missing: docs/project/marionettist-workflow.md");

  await assertDoctorFailures(project);

  manifest.managedFiles.push({
    path: ".agents/skills/old-core/SKILL.md",
    source: "skills/old-core/SKILL.md",
    kind: "file",
    hash: "orphan-hash"
  });
  await fs.mkdir(path.join(project, ".agents", "skills", "old-core"), { recursive: true });
  await fs.writeFile(path.join(project, ".agents", "skills", "old-core", "SKILL.md"), "# Old Core\n", "utf8");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const orphanDiffOutput = await harness("diff", "--project", project);
  assertIncludes(orphanDiffOutput, "orphan-managed: .agents/skills/old-core/SKILL.md");

  await assertOpencodeInstall(opencodeProject);
  await assertExplicitFalseSkipsOpencode(opencodeProject);
  await assertOpencodeBackfill(backfillProject);
  await assertGradleValidatorGuidance(gradleProject);
  await assertClearWorkflowAndMigration(clearWorkflowProject);
  await assertManagedOnlyAgentsClearApply(clearManagedOnlyProject);
  await assertClearPartialFailureSemantics(clearPartialFailureProject);
  await assertClearSymlinkEscape(clearSymlinkEscapeProject);
  await assertPublishableSensitiveScan();

  console.log("smoke: PASS");
} finally {
  await cleanupPaths(dryRunProject, project, distributionProject, mudballProject, existingLocalProject, opencodeProject, backfillProject, gradleProject, legacyDistributionProject, gatePolicyProject, tierPolicyProject, clearWorkflowProject, clearManagedOnlyProject, clearPartialFailureProject, clearSymlinkEscapeProject);
}

async function assertClearWorkflowAndMigration(projectPath) {
  await cleanupPaths(projectPath);
  const initOutput = await harness("init", "--project", projectPath, "--auto", "--with-opencode");
  assertIncludes(initOutput, "write-manifest: .marionettist/manifest.json");

  const agentsPath = path.join(projectPath, "AGENTS.md");
  await fs.appendFile(agentsPath, "\n## Local Clear Note\n\nKeep this note after clear.\n", "utf8");

  const manifest = await readManifest(projectPath);
  const opencodeManaged = manifest.managedFiles.find((file) => file.adapter === "opencode" && file.kind === "file");
  assert(opencodeManaged, "clear smoke requires at least one manifest-managed OpenCode file");

  const previewOutput = await harness("clear", "--project", projectPath, "--scope", "all");
  assertIncludes(previewOutput, "marionettist clear (preview)");
  assertIncludes(previewOutput, "scope: all");
  assertIncludes(previewOutput, "manifest: .marionettist/manifest.json");
  assertIncludes(previewOutput, `remove: ${opencodeManaged.path}`);
  assertIncludes(previewOutput, "edit: AGENTS.md");
  assertIncludes(previewOutput, "dry-run: preview only; no files will be changed");
  assert(await pathExists(path.join(projectPath, opencodeManaged.path)), "clear preview must not remove managed OpenCode files");
  assertIncludes(await fs.readFile(agentsPath, "utf8"), "Keep this note after clear.");

  const opencodePreviewOutput = await harness("clear", "--project", projectPath, "--scope", "opencode");
  assertIncludes(opencodePreviewOutput, "scope: opencode");
  assertIncludes(opencodePreviewOutput, `remove: ${opencodeManaged.path}`);
  assertExcludes(opencodePreviewOutput, "edit: AGENTS.md");

  const applyOutput = await harness("uninstall", "--project", projectPath, "--scope", "all", "--apply");
  assertIncludes(applyOutput, "marionettist clear (apply)");
  assertIncludes(applyOutput, "scope: all");
  assertIncludes(applyOutput, `applied remove: ${opencodeManaged.path}`);
  assertIncludes(applyOutput, "applied edit: AGENTS.md");
  const backupRootRelative = parseBackupRoot(applyOutput);
  assert(await pathExists(path.join(projectPath, backupRootRelative)), "clear apply must create a backup root inside the project");
  assert(await pathExists(path.join(projectPath, backupRootRelative, opencodeManaged.path)), "clear apply must back up removed OpenCode files");
  assert(await pathExists(path.join(projectPath, backupRootRelative, "AGENTS.md")), "clear apply must back up AGENTS.md before editing it");
  assert(!(await pathExists(path.join(projectPath, opencodeManaged.path))), "clear apply must remove the managed OpenCode file");
  const clearedAgents = await fs.readFile(agentsPath, "utf8");
  assertIncludes(clearedAgents, "Keep this note after clear.");
  assertExcludes(clearedAgents, "<!-- marionettist-kit:start -->");

  const reinitOutput = await harness("init", "--project", projectPath, "--auto", "--with-opencode");
  assertIncludes(reinitOutput, "write-manifest: .marionettist/manifest.json");
  assert(await pathExists(path.join(projectPath, opencodeManaged.path)), "re-init after clear must restore managed OpenCode files");
  const reinitAgents = await fs.readFile(agentsPath, "utf8");
  assertIncludes(reinitAgents, "Keep this note after clear.");
}

async function assertManagedOnlyAgentsClearApply(projectPath) {
  await cleanupPaths(projectPath);
  await fs.mkdir(path.join(projectPath, ".marionettist"), { recursive: true });
  await fs.writeFile(path.join(projectPath, "AGENTS.md"), "<!-- marionettist-kit:start -->\n\nManaged only.\n\n<!-- marionettist-kit:end -->\n", "utf8");
  await writeManifest(projectPath, {
    schemaVersion: 1,
    frameworkVersion: frameworkVersion,
    installedAt: "2026-06-16T00:00:00.000Z",
    updatedAt: "2026-06-16T00:00:00.000Z",
    managedFiles: [
      {
        path: "AGENTS.md",
        source: "templates/AGENTS.md",
        kind: "managed-block",
        hash: "managed-only-agents"
      }
    ]
  });

  const applyOutput = await harness("clear", "--project", projectPath, "--scope", "all", "--apply");
  assertIncludes(applyOutput, "applied edit: AGENTS.md (managed block removed; safe empty file kept)");
  assert((await fs.readFile(path.join(projectPath, "AGENTS.md"), "utf8")) === "# AGENTS\n", "managed-only AGENTS clear must keep a safe placeholder file");
  const backupRootRelative = parseBackupRoot(applyOutput);
  assert(await pathExists(path.join(projectPath, backupRootRelative, "AGENTS.md")), "managed-only AGENTS clear must back up the original file");
}

async function assertClearPartialFailureSemantics(projectPath) {
  await cleanupPaths(projectPath);
  await fs.mkdir(path.join(projectPath, ".marionettist"), { recursive: true });
  await fs.writeFile(path.join(projectPath, "A.txt"), "first\n", "utf8");
  await fs.mkdir(path.join(projectPath, "broken-dir"), { recursive: true });
  await writeManifest(projectPath, {
    schemaVersion: 1,
    frameworkVersion: frameworkVersion,
    installedAt: "2026-06-16T00:00:00.000Z",
    updatedAt: "2026-06-16T00:00:00.000Z",
    managedFiles: [
      {
        path: "A.txt",
        source: "templates/A.txt",
        kind: "file",
        hash: "a-hash"
      },
      {
        path: "broken-dir",
        source: "templates/broken-dir",
        kind: "file",
        hash: "broken-hash"
      }
    ]
  });

  const result = await harnessAllowFailure("clear", "--project", projectPath, "--scope", "all", "--apply");
  assert(result.code !== 0, "clear apply must fail when a later backup target cannot be copied");
  assert(result.stderr.length > 0, "clear apply partial failure should surface the raw filesystem error");
  assert(!(await pathExists(path.join(projectPath, "A.txt"))), "clear apply is non-atomic; earlier removals may already be applied");

  const backupsRoot = path.join(projectPath, ".marionettist", "backups");
  const backupEntries = await fs.readdir(backupsRoot);
  assert(backupEntries.length === 1, "clear apply partial failure should still create one backup root");
  const backupRootPath = path.join(backupsRoot, backupEntries[0]);
  assert(await pathExists(path.join(backupRootPath, "A.txt")), "clear apply partial failure must preserve backups for already-applied removals");
  assert(await pathExists(path.join(projectPath, "broken-dir")), "failed later targets must remain in place after partial failure");
}

async function assertClearSymlinkEscape(projectPath) {
  await cleanupPaths(projectPath);
  await fs.mkdir(path.join(projectPath, ".marionettist"), { recursive: true });
  const outsidePath = path.join(tempBase, `harness-smoke-clear-symlink-outside-${process.pid}.txt`);
  await fs.writeFile(outsidePath, "outside\n", "utf8");
  try {
    await fs.symlink(outsidePath, path.join(projectPath, "linked.txt"));
    await writeManifest(projectPath, {
      schemaVersion: 1,
      frameworkVersion: frameworkVersion,
      installedAt: "2026-06-16T00:00:00.000Z",
      updatedAt: "2026-06-16T00:00:00.000Z",
      managedFiles: [
        {
          path: "linked.txt",
          source: "templates/linked.txt",
          kind: "file",
          hash: "linked-hash"
        }
      ]
    });

    const result = await harnessAllowFailure("clear", "--project", projectPath, "--scope", "all", "--apply");
    assert(result.code !== 0, "clear apply must reject symlink targets that resolve outside the project root");
    assertIncludes(result.stderr, "Target path resolves outside project root: linked.txt");
    assert((await fs.readFile(outsidePath, "utf8")) === "outside\n", "clear apply must not mutate the symlink destination outside the project root");
    assert(await pathExists(path.join(projectPath, "linked.txt")), "clear apply must leave the symlink untouched after rejecting it");
  } finally {
    await fs.rm(outsidePath, { force: true });
  }
}

async function assertKnowledgeInitAndManagedDocs(projectPath, { mode, maturity }) {
  const config = parseSimpleYaml(await fs.readFile(path.join(projectPath, "marionettist.config.yaml"), "utf8"));
  assert(config.knowledge?.mode === mode, `Expected knowledge.mode=${mode}, got ${config.knowledge?.mode}`);
  assert(config.knowledge?.maturity === maturity, `Expected knowledge.maturity=${maturity}, got ${config.knowledge?.maturity}`);

  const currentDocRelative = path.join("docs", "current", "system-map.md");
  const targetDocRelative = path.join("docs", "target", "architecture-intent.md");
  assert(await pathExists(path.join(projectPath, currentDocRelative)), `${currentDocRelative} must exist after init`);
  assert(await pathExists(path.join(projectPath, targetDocRelative)), `${targetDocRelative} must exist after init`);

  const manifest = await readManifest(projectPath);
  assert(manifest.managedFiles.some((file) => file.path === toPosix(currentDocRelative)), `manifest must include ${currentDocRelative}`);
  assert(manifest.managedFiles.some((file) => file.path === toPosix(targetDocRelative)), `manifest must include ${targetDocRelative}`);

  const diffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(diffOutput, `unchanged: ${toPosix(currentDocRelative)}`);
  assertIncludes(diffOutput, `unchanged: ${toPosix(targetDocRelative)}`);
}

async function assertDistributionModeRecorded(projectPath, expectedMode) {
  const manifest = await readManifest(projectPath);
  assert(manifest.distributionMode === expectedMode, `Expected manifest distributionMode=${expectedMode}, got ${manifest.distributionMode}`);

  const config = parseSimpleYaml(await fs.readFile(path.join(projectPath, "marionettist.config.yaml"), "utf8"));
  assert(config.distribution?.mode === expectedMode, `Expected marionettist.config.yaml distribution.mode=${expectedMode}, got ${config.distribution?.mode}`);
}

async function assertTierPolicyManagedInstallAndPreservation(projectPath) {
  const tierPolicyRelative = path.join(".marionettist", "tier-policy.yml");
  const tierPolicyPath = path.join(projectPath, tierPolicyRelative);
  assert(await pathExists(tierPolicyPath), `${tierPolicyRelative} must exist after init`);

  const manifest = await readManifest(projectPath);
  assert(manifest.managedFiles.some((file) => file.path === toPosix(tierPolicyRelative)), `manifest must include ${tierPolicyRelative}`);

  const cleanDiffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(cleanDiffOutput, `unchanged: ${toPosix(tierPolicyRelative)}`);

  await fs.appendFile(tierPolicyPath, "\n# Local tier policy note.\n", "utf8");
  const localTierPolicyContent = await fs.readFile(tierPolicyPath, "utf8");

  const modifiedDiffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(modifiedDiffOutput, `modified-local: ${toPosix(tierPolicyRelative)}`);

  const syncDryRunOutput = await harness("sync", "--project", projectPath, "--dry-run");
  assertIncludes(syncDryRunOutput, `modified-local: ${toPosix(tierPolicyRelative)}`);
  assert((await fs.readFile(tierPolicyPath, "utf8")) === localTierPolicyContent, "sync --dry-run must preserve local tier-policy bytes");
}

async function assertSyncPreservesRecordedDistributionMode(projectPath, expectedMode) {
  const diffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(diffOutput, `distribution mode: ${expectedMode}`);

  const syncDryRunOutput = await harness("sync", "--project", projectPath, "--dry-run");
  assertIncludes(syncDryRunOutput, `distribution mode: ${expectedMode}`);

  await harness("sync", "--project", projectPath);
  const manifest = await readManifest(projectPath);
  assert(manifest.distributionMode === expectedMode, `Expected sync to preserve manifest distributionMode=${expectedMode}, got ${manifest.distributionMode}`);
}

async function assertFreshInitIdentityPreservation(projectPath) {
  const configPath = path.join(projectPath, "marionettist.config.yaml");
  const initialConfig = await fs.readFile(configPath, "utf8");

  for (const placeholder of ["{{PROJECT_NAME}}", "{{PROJECT_TYPE}}", "{{ARCHITECTURE}}", "{{PRIMARY_LANGUAGE}}"] ) {
    assertExcludes(initialConfig, placeholder);
  }

  const parsedInitialConfig = parseSimpleYaml(initialConfig);
  assert(parsedInitialConfig.project?.name?.length > 0, "fresh init must render project.name");
  assert(parsedInitialConfig.project?.type?.length > 0, "fresh init must render project.type");
  assert(parsedInitialConfig.project?.architecture?.length > 0, "fresh init must render project.architecture");
  assert(parsedInitialConfig.project?.primaryLanguage?.length > 0, "fresh init must render project.primaryLanguage");

  const diffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(diffOutput, "unchanged: marionettist.config.yaml");
  for (const statusPrefix of ["update:", "modified-local:", "missing:", "conflict:"]) {
    assertExcludes(diffOutput, `${statusPrefix} marionettist.config.yaml`);
  }

  const syncOutput = await harness("sync", "--project", projectPath);
  const syncedConfig = await fs.readFile(configPath, "utf8");
  assert(syncedConfig === initialConfig, "fresh init -> sync must not rewrite marionettist.config.yaml identity fields");
  assertIncludes(syncOutput, "unchanged: marionettist.config.yaml");
  for (const placeholder of ["{{PROJECT_NAME}}", "{{PROJECT_TYPE}}", "{{ARCHITECTURE}}", "{{PRIMARY_LANGUAGE}}"] ) {
    assertExcludes(syncedConfig, placeholder);
  }
}

async function assertLegacyDistributionModeReportingAndNoInjection(projectPath) {
  await cleanupPaths(projectPath);
  await harness("init", "--project", projectPath, "--auto");

  const manifestPath = path.join(projectPath, ".marionettist", "manifest.json");
  const manifest = await readManifest(projectPath);
  delete manifest.distributionMode;
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const configPath = path.join(projectPath, "marionettist.config.yaml");
  const configWithoutDistribution = removeTopLevelYamlSection(await fs.readFile(configPath, "utf8"), "distribution");
  await fs.writeFile(configPath, configWithoutDistribution, "utf8");

  const diffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(diffOutput, "distribution mode: embedded (legacy inferred; manifest unchanged)");

  const syncDryRunOutput = await harness("sync", "--project", projectPath, "--dry-run");
  assertIncludes(syncDryRunOutput, "distribution mode: embedded (legacy inferred; manifest unchanged)");

  await harness("sync", "--project", projectPath);
  const syncedManifest = await readManifest(projectPath);
  assert(!Object.prototype.hasOwnProperty.call(syncedManifest, "distributionMode"), "legacy sync must not inject manifest distributionMode when no source exists");

  const doctorResult = await assertProjectDoctorBaselineResult(projectPath, "legacy distribution fallback");
  assertIncludes(doctorResult.stdout, "WARN  distribution mode: embedded (legacy inferred; manifest missing distributionMode)");

  manifest.distributionMode = "surprise";
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  let invalidPlan = await harnessAllowFailure("diff", "--project", projectPath);
  assert(invalidPlan.code !== 0, "diff must fail clearly when manifest distributionMode is invalid");
  assertIncludes(invalidPlan.stderr, "Cannot continue because .marionettist/manifest.json distributionMode is invalid for marionettist sync.");
  assertIncludes(invalidPlan.stderr, "Unsupported manifest distributionMode: surprise. Expected embedded, hybrid, or adapter.");

  invalidPlan = await harnessAllowFailure("sync", "--project", projectPath, "--dry-run");
  assert(invalidPlan.code !== 0, "sync --dry-run must fail clearly when manifest distributionMode is invalid");
  assertIncludes(invalidPlan.stderr, "Cannot continue because .marionettist/manifest.json distributionMode is invalid for marionettist sync.");

  let invalidDoctor = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(invalidDoctor.code !== 0, "doctor must fail when manifest distributionMode is invalid");
  assertIncludes(invalidDoctor.stdout, "FAIL  Unsupported .marionettist/manifest.json distributionMode: surprise. Expected embedded, hybrid, or adapter.");

  delete manifest.distributionMode;
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(configPath, `${configWithoutDistribution.replace(/\s*$/u, "")}\n\ndistribution:\n  mode: "surprise"\n`, "utf8");

  invalidPlan = await harnessAllowFailure("diff", "--project", projectPath);
  assert(invalidPlan.code !== 0, "diff must fail clearly when marionettist.config.yaml distribution.mode is invalid");
  assertIncludes(invalidPlan.stderr, "Cannot continue because marionettist.config.yaml distribution.mode is invalid for marionettist sync.");
  assertIncludes(invalidPlan.stderr, "Unsupported marionettist.config.yaml distribution.mode: surprise. Expected embedded, hybrid, or adapter.");

  invalidPlan = await harnessAllowFailure("sync", "--project", projectPath, "--dry-run");
  assert(invalidPlan.code !== 0, "sync --dry-run must fail clearly when marionettist.config.yaml distribution.mode is invalid");
  assertIncludes(invalidPlan.stderr, "Cannot continue because marionettist.config.yaml distribution.mode is invalid for marionettist sync.");

  invalidDoctor = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(invalidDoctor.code !== 0, "doctor must fail when marionettist.config.yaml distribution.mode is invalid");
  assertIncludes(invalidDoctor.stdout, "FAIL  Unsupported marionettist.config.yaml distribution.mode: surprise. Expected embedded, hybrid, or adapter.");
}

async function assertGatePolicyDoctorValidation(projectPath) {
  await cleanupPaths(projectPath);
  await harness("init", "--project", projectPath, "--auto");

  const configPath = path.join(projectPath, "marionettist.config.yaml");
  const originalConfig = await fs.readFile(configPath, "utf8");
  const withoutGatePolicy = removeTopLevelYamlSection(originalConfig, "gatePolicy");
  await fs.writeFile(configPath, withoutGatePolicy, "utf8");

  let doctor = await assertProjectDoctorBaselineResult(projectPath, "gate policy config omitted");
  assertExcludes(doctor.stdout, "gate policy default mode:");

  const invalidConfig = `${withoutGatePolicy.replace(/\s*$/u, "")}\n\ngatePolicy:\n  defaultMode: "surprise"\n`;
  await fs.writeFile(configPath, invalidConfig, "utf8");

  doctor = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(doctor.code !== 0, "doctor must fail when gatePolicy.defaultMode is invalid");
  assertIncludes(doctor.stdout, "FAIL  Unsupported marionettist.config.yaml gatePolicy.defaultMode: surprise. Expected strict, balanced, or autonomous.");
}

async function assertTierPolicyConflictDoctorValidation(projectPath) {
  await cleanupPaths(projectPath);
  await harness("init", "--project", projectPath, "--auto");

  const tierPolicyPath = path.join(projectPath, ".marionettist", "tier-policy.yml");
  await fs.rm(tierPolicyPath, { force: true });

  // Keep Tier-policy smoke coverage grouped here because the MVP intentionally
  // exercises multiple policy outcomes in one place: missing-file fallback,
  // accepted refinements/overrides, soft conflicts, hard conflicts, and parse
  // failure. If this area grows further, consider splitting fixture helpers
  // rather than broadening unrelated smoke sections.

  let doctor = await assertProjectDoctorBaselineResult(projectPath, "missing tier policy fallback");
  assertIncludes(doctor.stdout, "WARN  .marionettist/tier-policy.yml missing; task intake will use framework defaults");

  await writeProjectTierPolicy(projectPath, `schemaVersion: "1"
tiers:
  S:
    description: "Clearly scoped localized low-risk work with no boundary ambiguity"
    matchRules:
      - "single or very small localized low-risk change"
      - "typo, comment, docs-only correction, small test/example update, or harmless config text change"
      - "clear scope with no workflow, compatibility, security, production, or boundary impact"
      - "project-local micro-change with extra guardrails"
    minTier: null
    maxTier: "S"
    workflowHint: "direct"
    gateHint: "default"
    reviewLevel: "standard"
    modelProfileHint: "build"
  M:
    description: "Standard clear-scope work that benefits from analysis context before coding"
    matchRules:
      - "small or medium feature, bugfix, refactor, docs, or config task with clear scope"
      - "more than trivial complexity but no real boundary ambiguity or sensitive production/security/compatibility impact"
    minTier: "M"
    maxTier: "M"
    workflowHint: "analysis-context"
    gateHint: "default"
    reviewLevel: "critic-required"
    modelProfileHint: "build"
  L:
    description: "Local L description override"
    matchRules:
      - "multi-area or cross-boundary workflow-sensitive change"
      - "architecture-sensitive, security-sensitive, production-sensitive, compatibility-sensitive, or approval-sensitive work"
      - "unclear ownership or real boundary ambiguity"
      - "project-specific escalation wording"
    minTier: "L"
    maxTier: null
    workflowHint: "full-harness"
    gateHint: "prefer-strict"
    reviewLevel: "critic-required"
    modelProfileHint: "review"
`);

  doctor = await assertProjectDoctorBaselineResult(projectPath, "tier policy refinements");
  assertIncludes(doctor.stdout, "PASS  .marionettist/tier-policy.yml parsed");
  assertIncludes(doctor.stdout, "PASS  .marionettist/tier-policy.yml tiers.S.matchRules refinement accepted");
  assertIncludes(doctor.stdout, "PASS  .marionettist/tier-policy.yml tiers.M.reviewLevel refinement accepted");
  assertIncludes(doctor.stdout, "WARN  .marionettist/tier-policy.yml tiers.L.description explicit override accepted");
  assertIncludes(doctor.stdout, "WARN  .marionettist/tier-policy.yml tiers.L.modelProfileHint explicit override accepted");

  await writeProjectTierPolicy(projectPath, `schemaVersion: "1"
tiers:
  S:
    description: "Clearly scoped localized low-risk work with no boundary ambiguity"
    matchRules:
      - "single or very small localized low-risk change"
    minTier: null
    maxTier: "S"
    workflowHint: "direct"
    gateHint: "default"
    reviewLevel: "standard"
    modelProfileHint: "build"
  M:
    description: "Standard clear-scope work that benefits from analysis context before coding"
    matchRules:
      - "more than trivial complexity but no real boundary ambiguity or sensitive production/security/compatibility impact"
    minTier: "M"
    maxTier: "M"
    workflowHint: "analysis-context"
    gateHint: "default"
    reviewLevel: "standard"
    modelProfileHint: "build"
  L:
    description: "Complex, cross-cutting, boundary-sensitive, or concretely high-risk work"
    matchRules:
      - "multi-area or cross-boundary workflow-sensitive change"
      - "architecture-sensitive, security-sensitive, production-sensitive, compatibility-sensitive, or approval-sensitive work"
    minTier: "L"
    maxTier: null
    workflowHint: "full-harness"
    gateHint: "default"
    reviewLevel: "critic-required"
    modelProfileHint: "think"
`);

  doctor = await assertProjectDoctorBaselineResult(projectPath, "tier policy soft conflicts");
  assertIncludes(doctor.stdout, "WARN  .marionettist/tier-policy.yml tiers.M.matchRules soft conflict accepted with explanation");
  assertIncludes(doctor.stdout, "WARN  .marionettist/tier-policy.yml tiers.L.gateHint soft conflict accepted with explanation");

  await writeProjectTierPolicy(projectPath, `schemaVersion: "1"
tiers:
  S:
    description: "Clearly scoped localized low-risk work with no boundary ambiguity"
    matchRules:
      - "single or very small localized low-risk change"
      - "typo, comment, docs-only correction, small test/example update, or harmless config text change"
      - "clear scope with no workflow, compatibility, security, production, or boundary impact"
    minTier: null
    maxTier: "M"
    workflowHint: "direct"
    gateHint: "default"
    reviewLevel: "standard"
    modelProfileHint: "build"
  M:
    description: "Standard clear-scope work that benefits from analysis context before coding"
    matchRules:
      - "small or medium feature, bugfix, refactor, docs, or config task with clear scope"
      - "more than trivial complexity but no real boundary ambiguity or sensitive production/security/compatibility impact"
    minTier: "M"
    maxTier: "M"
    workflowHint: "analysis-context"
    gateHint: "default"
    reviewLevel: "standard"
    modelProfileHint: "build"
  L:
    description: "Complex, cross-cutting, boundary-sensitive, or concretely high-risk work"
    matchRules:
      - "multi-area or cross-boundary workflow-sensitive change"
      - "architecture-sensitive, security-sensitive, production-sensitive, compatibility-sensitive, or approval-sensitive work"
      - "unclear ownership or real boundary ambiguity"
    minTier: "L"
    maxTier: null
    workflowHint: "analysis-context"
    gateHint: "prefer-strict"
    reviewLevel: "critic-required"
    modelProfileHint: "think"
`);

  doctor = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(doctor.code !== 0, "doctor must fail for hard conflicts and attempted risk downgrades");
  assertIncludes(doctor.stdout, "FAIL  .marionettist/tier-policy.yml tiers.S.maxTier hard conflict");
  assertIncludes(doctor.stdout, "WARN  .marionettist/tier-policy.yml tiers.L.workflowHint explicit override accepted.");
  assertIncludes(doctor.stdout, "WARN  .marionettist/tier-policy.yml invalid; task intake will fall back to safe defaults where needed");

  await fs.writeFile(tierPolicyPath, `schemaVersion: "1"
  S:
    description: "broken"
   matchRules:
      - "oops"
`, "utf8");

  doctor = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(doctor.code !== 0, "doctor must fail for malformed tier policy");
  assertIncludes(doctor.stdout, "FAIL  .marionettist/tier-policy.yml parse failed:");
}

async function writeProjectTierPolicy(projectPath, content) {
  const tierPolicyPath = path.join(projectPath, ".marionettist", "tier-policy.yml");
  await fs.mkdir(path.dirname(tierPolicyPath), { recursive: true });
  await fs.writeFile(tierPolicyPath, content, "utf8");
}

async function assertManagedDocsLocalPreservation(projectPath) {
  const currentDocPath = path.join(projectPath, "docs", "current", "system-map.md");
  const targetDocPath = path.join(projectPath, "docs", "target", "architecture-intent.md");

  await fs.appendFile(currentDocPath, "\nLocal current-state note.\n", "utf8");
  await fs.appendFile(targetDocPath, "\nLocal target-state note.\n", "utf8");
  const currentDocContent = await fs.readFile(currentDocPath, "utf8");
  const targetDocContent = await fs.readFile(targetDocPath, "utf8");

  const diffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(diffOutput, "modified-local: docs/current/system-map.md");
  assertIncludes(diffOutput, "modified-local: docs/target/architecture-intent.md");

  const syncDryRunOutput = await harness("sync", "--project", projectPath, "--dry-run");
  assertIncludes(syncDryRunOutput, "modified-local: docs/current/system-map.md");
  assertIncludes(syncDryRunOutput, "modified-local: docs/target/architecture-intent.md");
  assert((await fs.readFile(currentDocPath, "utf8")) === currentDocContent, "sync --dry-run must preserve local docs/current bytes");
  assert((await fs.readFile(targetDocPath, "utf8")) === targetDocContent, "sync --dry-run must preserve local docs/target bytes");
}

async function assertManagedDocsMissingDetection(projectPath) {
  const currentDocPath = path.join(projectPath, "docs", "current", "system-map.md");
  const targetDocPath = path.join(projectPath, "docs", "target", "architecture-intent.md");
  await fs.rm(currentDocPath);
  await fs.rm(targetDocPath);

  const diffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(diffOutput, "missing: docs/current/system-map.md");
  assertIncludes(diffOutput, "missing: docs/target/architecture-intent.md");
}

async function assertInitPreservesExistingLocalKnowledge(projectPath) {
  await fs.mkdir(path.join(projectPath, "docs", "current"), { recursive: true });
  await fs.mkdir(path.join(projectPath, ".aiassistant", "rules"), { recursive: true });
  await fs.writeFile(path.join(projectPath, "marionettist.config.yaml"), "knowledge:\n  mode: \"local-only\"\n", "utf8");
  await fs.writeFile(path.join(projectPath, "docs", "current", "system-map.md"), "# Local System Map\n\nKeep me.\n", "utf8");
  await fs.writeFile(path.join(projectPath, ".aiassistant", "rules", "00-repository-rules.md"), "# Local Rules\n\nKeep me.\n", "utf8");

  const initOutput = await harness("init", "--project", projectPath, "--auto");
  assertIncludes(initOutput, "skip-project-local: marionettist.config.yaml");
  assertIncludes(initOutput, "skip-project-local: docs/current/system-map.md");
  assertIncludes(initOutput, "skip-project-local: .aiassistant/rules/00-repository-rules.md");

  assert((await fs.readFile(path.join(projectPath, "marionettist.config.yaml"), "utf8")) === "knowledge:\n  mode: \"local-only\"\n", "init must preserve local marionettist.config.yaml");
  assert((await fs.readFile(path.join(projectPath, "docs", "current", "system-map.md"), "utf8")) === "# Local System Map\n\nKeep me.\n", "init must preserve local docs/current/system-map.md");
  assert((await fs.readFile(path.join(projectPath, ".aiassistant", "rules", "00-repository-rules.md"), "utf8")) === "# Local Rules\n\nKeep me.\n", "init must preserve local .aiassistant/rules/00-repository-rules.md");
}

async function assertOpencodeInstall(projectPath) {
  const initOutput = await harness("init", "--project", projectPath, "--auto", "--with-opencode");
  assertIncludes(initOutput, "new-managed: opencode.jsonc");
  assertIncludes(initOutput, "note: project-level opencode pathway prototype is enabled via opencode.jsonc");

  const packageManifest = await readManifest(projectPath);
  assert(packageManifest.opencodePluginSource === "package", "default OpenCode install must record package plugin source");
  assert(packageManifest.managedFiles.some((file) => file.path === "opencode.jsonc"), "default OpenCode install must manage opencode.jsonc");
  assert(!packageManifest.managedFiles.some((file) => file.path.startsWith(".opencode/")), "default OpenCode install must not manage generated fallback assets");

  const packageHarnessConfig = await fs.readFile(path.join(projectPath, "marionettist.config.yaml"), "utf8");
  assertIncludes(packageHarnessConfig, 'opencode:\n  commandSurface: "minimal"');
  assertIncludes(packageHarnessConfig, 'pluginSource: "package"');

  const packageProjectConfig = await fs.readFile(path.join(projectPath, "opencode.jsonc"), "utf8");
  assertIncludes(packageProjectConfig, '"plugin": ["marionettist-pathway-opencode"]');
  assert(!(await pathExists(path.join(projectPath, ".opencode"))), "default OpenCode install must not create generated local fallback assets");

  const localFallbackSyncOutput = await switchProjectToLocalOpencodeFallback(projectPath, { commandSurface: "minimal" });
  assertIncludes(localFallbackSyncOutput, "new-managed: .opencode/commands/marionettist.md");
  assertIncludes(localFallbackSyncOutput, "new-managed: .opencode/commands/marionettist-dev.md");
  assertIncludes(localFallbackSyncOutput, "new-managed: .opencode/commands/marionettist-incident.md");
  assertIncludes(localFallbackSyncOutput, "new-managed: .opencode/agents/marionettist-validator.md");
  assertIncludes(localFallbackSyncOutput, "update: opencode.jsonc");

  await assertMinimalOpencodeCommandsAndAgents(projectPath);
  await assertRenderedOpencodeModels(projectPath);
  await assertCanonicalProfileOverridesRender(projectPath);

  const doctorOutput = await assertProjectDoctorBaseline(projectPath, "minimal opencode install");
  assertIncludes(doctorOutput, "PASS  opencode.jsonc parsed");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [minimal] required normal commands present");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [minimal] non-minimal commands absent");
  assertIncludes(doctorOutput, "PASS  .opencode/commands/marionettist-incident.md frontmatter parsed");
  assertIncludes(doctorOutput, "PASS  OpenCode model [OK] .opencode/agents/marionettist-builder.md model openai/gpt-5.5 matches .marionettist/model-profiles.yml profile think.default.");
  assertIncludes(doctorOutput, "PASS  OpenCode model [OK] .opencode/agents/marionettist-coder.md model openai/gpt-5.4 matches .marionettist/model-profiles.yml profile build.default.");
  assertIncludes(doctorOutput, "PASS  OpenCode model [OK] .opencode/agents/marionettist-reviewer.md model deepseek/deepseek-v4-pro matches .marionettist/model-profiles.yml profile review.default.");
  assertIncludes(doctorOutput, "PASS  OpenCode model [OK] .opencode/agents/marionettist-validator.md model deepseek/deepseek-v4-flash matches .marionettist/model-profiles.yml profile run.default.");

  await assertDoctorModelDriftStates(projectPath);
  await assertLegacyProfileFallbackRender(projectPath);

  const manifest = await readManifest(projectPath);
  assert(manifest.managedFiles.some((file) => file.path === ".opencode/commands/marionettist.md"), "manifest must include minimal OpenCode commands");
  assert(!manifest.managedFiles.some((file) => file.path === ".opencode/commands/marionettist-feature.md"), "minimal install must not include advanced OpenCode commands in manifest");
  assert(manifest.managedFiles.some((file) => file.path === ".opencode/agents/marionettist-validator.md"), "manifest must include marionettist validator agent");
  assert(manifest.managedFiles.some((file) => file.path === "opencode.jsonc"), "manifest must include project OpenCode config");
  assert(!manifest.managedFiles.some((file) => file.path.startsWith(".opencode/agents/validators/")), "manifest must not install validator snippet assets");
  await assertOpencodeManifestMetadataAndSafety(projectPath, manifest);

  const harnessConfig = await fs.readFile(path.join(projectPath, "marionettist.config.yaml"), "utf8");
  assertIncludes(harnessConfig, 'opencode:\n  commandSurface: "minimal"');

  const projectConfig = await fs.readFile(path.join(projectPath, "opencode.jsonc"), "utf8");
  assertIncludes(projectConfig, '"plugin": ["./.opencode/plugin/opencode-tasks.js"]');
  assert(await pathExists(path.join(projectPath, ".opencode", "plugin", "opencode-tasks.js")), "OpenCode install must include repository-local plugin prototype");
  assert(await pathExists(path.join(projectPath, ".opencode", "pathway-skills", "marionettist-pathway-prototype", "SKILL.md")), "OpenCode install must include repository-local pathway skill prototype");
  assert(await pathExists(path.join(projectPath, ".opencode", "pathway", "commands", "marionettist-pathway-config.md")), "OpenCode install must include repository-local pathway config command");
  assert(await pathExists(path.join(projectPath, ".opencode", "pathway-skills", "marionettist-pathway-config", "SKILL.md")), "OpenCode install must include repository-local pathway config skill");
  assert(await pathExists(path.join(projectPath, ".marionettist", "model-profiles.yml")), "OpenCode install must include .marionettist/model-profiles.yml");
  await assertOpencodeCommandSmoke(projectPath, prototypeOpencodeCommandName, "prototype");
  await assertOpencodeCommandSmoke(projectPath, pathwayConfigOpencodeCommandName, "pathway-config");

  const validatorContent = await fs.readFile(path.join(projectPath, ".opencode", "agents", "marionettist-validator.md"), "utf8");
  assertIncludes(validatorContent, "# Generic Validator Guidance");
  assertIncludes(validatorContent, "# Scheduled Validator Guidance");
  assertIncludes(validatorContent, "model: deepseek/deepseek-v4-flash");
  assertExcludes(validatorContent, validatorSnippetPathText);
  assert(!(await pathExists(path.join(projectPath, ".opencode", "agents", "validators"))), "project must not contain installed validator snippet directory");

  await assertStandardOpencodeInstall(path.join(path.dirname(projectPath), `${path.basename(projectPath)}-standard`));
  await assertAdvancedOpencodeInstall(path.join(path.dirname(projectPath), `${path.basename(projectPath)}-advanced`));
}

async function assertOpencodeManifestMetadataAndSafety(projectPath, manifest = null) {
  const currentManifest = manifest ?? await readManifest(projectPath);
  const commandEntry = currentManifest.managedFiles.find((file) => file.path === ".opencode/commands/marionettist.md");
  const builderEntry = currentManifest.managedFiles.find((file) => file.path === ".opencode/agents/marionettist-builder.md");
  const projectConfigEntry = currentManifest.managedFiles.find((file) => file.path === "opencode.jsonc");

  for (const entry of [commandEntry, builderEntry, projectConfigEntry]) {
    assert(entry, "expected OpenCode manifest entry to exist");
    assert(entry.adapter === "opencode", `expected ${entry.path} adapter metadata`);
    assert(typeof entry.templateHash === "string" && entry.templateHash.length > 0, `expected ${entry.path} templateHash metadata`);
    assert(typeof entry.renderedHash === "string" && entry.renderedHash.length > 0, `expected ${entry.path} renderedHash metadata`);
    assert(typeof entry.renderInputHash === "string" && entry.renderInputHash.length > 0, `expected ${entry.path} renderInputHash metadata`);
    assert(entry.hash === entry.renderedHash, `expected ${entry.path} hash to mirror renderedHash for schemaVersion 1 compatibility`);
    assert(entry.commandSurface === "minimal", `expected ${entry.path} commandSurface metadata to record minimal install`);
  }

  const builderPath = path.join(projectPath, ".opencode", "agents", "marionettist-builder.md");
  const profilesPath = path.join(projectPath, ".marionettist", "model-profiles.yml");
  const commandPath = path.join(projectPath, ".opencode", "commands", "marionettist-dev.md");
  const originalBuilder = await fs.readFile(builderPath, "utf8");
  const originalProfiles = await fs.readFile(profilesPath, "utf8");
  const originalCommand = await fs.readFile(commandPath, "utf8");

  try {
    await fs.writeFile(builderPath, `${originalBuilder}\nLocal OpenCode edit.\n`, "utf8");

    let diffOutput = await harness("diff", "--project", projectPath, "--with-opencode");
    assertIncludes(diffOutput, "modified-local: .opencode/agents/marionettist-builder.md");

    let syncDryRunOutput = await harness("sync", "--project", projectPath, "--dry-run", "--with-opencode");
    assertIncludes(syncDryRunOutput, "modified-local: .opencode/agents/marionettist-builder.md");
    assert((await fs.readFile(builderPath, "utf8")) === `${originalBuilder}\nLocal OpenCode edit.\n`, "sync --dry-run must preserve locally modified OpenCode file bytes");

    await fs.writeFile(profilesPath, originalProfiles.replace('default: "openai/gpt-5.5"', 'default: "smoke/conflict-think"'), "utf8");
    diffOutput = await harness("diff", "--project", projectPath, "--with-opencode");
    assertIncludes(diffOutput, "conflict: .opencode/agents/marionettist-builder.md");

    syncDryRunOutput = await harness("sync", "--project", projectPath, "--dry-run", "--with-opencode");
    assertIncludes(syncDryRunOutput, "conflict: .opencode/agents/marionettist-builder.md");
    assert((await fs.readFile(builderPath, "utf8")) === `${originalBuilder}\nLocal OpenCode edit.\n`, "conflict dry-run must preserve locally modified OpenCode file bytes");

    await fs.rm(commandPath);
    diffOutput = await harness("diff", "--project", projectPath, "--with-opencode");
    assertIncludes(diffOutput, "missing: .opencode/commands/marionettist-dev.md");
  } finally {
    await fs.writeFile(builderPath, originalBuilder, "utf8");
    await fs.writeFile(profilesPath, originalProfiles, "utf8");
    await fs.writeFile(commandPath, originalCommand, "utf8");
  }
}

async function assertCoreManifestRenderMetadata(projectPath, manifest = null) {
  const currentManifest = manifest ?? await readManifest(projectPath);
  const agentsEntry = currentManifest.managedFiles.find((file) => file.path === "AGENTS.md");
  const configEntry = currentManifest.managedFiles.find((file) => file.path === "marionettist.config.yaml");

  assert(agentsEntry, "expected AGENTS.md manifest entry to exist");
  assert(typeof agentsEntry.templateHash === "string" && agentsEntry.templateHash.length > 0, "expected AGENTS.md templateHash metadata");
  assert(typeof agentsEntry.renderedHash === "string" && agentsEntry.renderedHash.length > 0, "expected AGENTS.md renderedHash metadata");
  assert(typeof agentsEntry.renderInputHash === "string" && agentsEntry.renderInputHash.length > 0, "expected AGENTS.md renderInputHash metadata");
  assert(agentsEntry.hash !== agentsEntry.renderedHash, "expected AGENTS.md managed-block hash to differ from full renderedHash");

  assert(configEntry, "expected marionettist.config.yaml manifest entry to exist");
  assert(typeof configEntry.templateHash === "string" && configEntry.templateHash.length > 0, "expected marionettist.config.yaml templateHash metadata");
  assert(typeof configEntry.renderedHash === "string" && configEntry.renderedHash.length > 0, "expected marionettist.config.yaml renderedHash metadata");
  assert(typeof configEntry.renderInputHash === "string" && configEntry.renderInputHash.length > 0, "expected marionettist.config.yaml renderInputHash metadata");
  assert(configEntry.hash === configEntry.renderedHash, "expected marionettist.config.yaml file hash to mirror renderedHash");
}

async function assertDoctorFailures(projectPath) {
  const activePath = path.join(projectPath, ".task", "active.json");
  await fs.writeFile(activePath, `${JSON.stringify({ taskId: "2099-01-01/missing-task", phase: "analysis", allowedToCode: false }, null, 2)}\n`, "utf8");
  const missingTaskDoctor = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(missingTaskDoctor.code !== 0, "doctor must fail when active task directory is missing");
  assertIncludes(missingTaskDoctor.stdout, "FAIL  .task/2099-01-01/missing-task missing");

  const skillPath = path.join(projectPath, ".agents", "skills", "bad-smoke-skill", "SKILL.md");
  await fs.mkdir(path.dirname(skillPath), { recursive: true });
  await fs.writeFile(skillPath, "---\ndescription: Missing name for smoke test.\n---\n\n# Bad Smoke Skill\n", "utf8");
  const badSkillDoctor = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(badSkillDoctor.code !== 0, "doctor must fail when skill name is missing");
  assertIncludes(badSkillDoctor.stdout, "FAIL  .agents/skills/bad-smoke-skill/SKILL.md missing required frontmatter: name");

  await fs.rm(path.dirname(skillPath), { recursive: true, force: true });
  await fs.rm(activePath, { force: true });
}

async function assertExplicitFalseSkipsOpencode(projectPath) {
  const plan = await buildPlan(projectPath, "init", {
    project: projectPath,
    auto: true,
    dryRun: true,
    force: false,
    variables: {
      projectName: path.basename(projectPath),
      projectType: "unknown",
      architecture: "unknown",
      primaryLanguage: "unknown"
    },
    withOpencode: false,
    conflictStrategies: {}
  });

  const directOpencodeOps = plan.operations.filter((operation) => operation.targetRelative?.startsWith(".opencode/"));
  assert(directOpencodeOps.length > 0, "explicit false plan should still account for previously managed OpenCode paths via orphan handling");
  assert(directOpencodeOps.every((operation) => operation.status === "orphan-managed"), "explicit false must not silently include or update OpenCode assets");
  assert(!directOpencodeOps.some((operation) => operation.status === "unchanged" || operation.status === "update" || operation.status === "new-managed"), "explicit false must not treat OpenCode assets as active install targets");
}

async function assertOpencodeBackfill(projectPath) {
  await harness("init", "--project", projectPath, "--auto");
  const manifestBeforeBackfill = await readManifest(projectPath);
  assert(!manifestBeforeBackfill.managedFiles.some((file) => file.path.startsWith(".opencode/")), "backfill baseline manifest must start without OpenCode assets");

  const initOutput = await harness("init", "--project", projectPath, "--auto", "--with-opencode");
  assertIncludes(initOutput, "new-managed: opencode.jsonc");
  assertExcludes(initOutput, "new-managed: .opencode/commands/marionettist.md");

  const diffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(diffOutput, "unchanged: opencode.jsonc");

  const manifest = await readManifest(projectPath);
  assert(manifest.opencodePluginSource === "package", "default OpenCode backfill must record package plugin source");
  assert(manifest.managedFiles.some((file) => file.path === "opencode.jsonc"), "backfill must add project OpenCode config to manifest");
  assert(!manifest.managedFiles.some((file) => file.path.startsWith(".opencode/")), "default OpenCode backfill must not add generated fallback assets to manifest");
}

async function assertGradleValidatorGuidance(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.writeFile(path.join(projectPath, "settings.gradle.kts"), "rootProject.name = \"smoke\"\n", "utf8");

  await initProjectWithLocalOpencodeFallback(projectPath, { preserveExisting: true });

  const validatorContent = await fs.readFile(path.join(projectPath, ".opencode", "agents", "marionettist-validator.md"), "utf8");
  assertIncludes(validatorContent, "# Generic Validator Guidance");
  assertIncludes(validatorContent, "# Scheduled Validator Guidance");
  assertIncludes(validatorContent, "# Gradle Or Kotlin Validator Guidance");
  assertExcludes(validatorContent, validatorSnippetPathText);
}

async function assertMinimalOpencodeCommandsAndAgents(projectPath) {
  await assertCommandSurface(projectPath, { mode: "minimal" });
  const commandFiles = await listCommandFiles(projectPath);
  assert(commandFiles.length === normalOpencodeCommands.length, "minimal OpenCode install must expose exactly the five builder-first commands");
  assert(await pathExists(path.join(projectPath, ".opencode", "agents", "marionettist-builder.md")), "OpenCode marionettist-builder agent must exist");
  assert(await pathExists(path.join(projectPath, ".opencode", "agents", "marionettist-critic.md")), "OpenCode marionettist-critic agent must exist");
  assert(await pathExists(path.join(projectPath, ".opencode", "agents", "marionettist-indexer.md")), "OpenCode marionettist-indexer agent must exist");
  assert(await pathExists(path.join(projectPath, ".opencode", "agents", "marionettist-planner.md")), "OpenCode marionettist-planner agent must exist");
  assert(await pathExists(path.join(projectPath, ".opencode", "agents", "marionettist-reviewer.md")), "OpenCode marionettist-reviewer agent must exist");
  assert(await pathExists(path.join(projectPath, ".opencode", "agents", "marionettist-validator.md")), "OpenCode marionettist-validator agent must exist");

  const builderAgent = await fs.readFile(path.join(projectPath, ".opencode", "agents", "marionettist-builder.md"), "utf8");
  const plannerAgent = await fs.readFile(path.join(projectPath, ".opencode", "agents", "marionettist-planner.md"), "utf8");
  const reviewerAgent = await fs.readFile(path.join(projectPath, ".opencode", "agents", "marionettist-reviewer.md"), "utf8");
  const criticAgent = await fs.readFile(path.join(projectPath, ".opencode", "agents", "marionettist-critic.md"), "utf8");
  assertIncludes(builderAgent, "frozen `gateClass` and supplemental `risk_score`");
  assertIncludes(plannerAgent, "- `risk_score`: integer `1` through `5` as stricter supplemental metadata for the slice or group");
  assertIncludes(reviewerAgent, "Treat per-slice `risk_score` as supplemental stricter metadata only");
  assertIncludes(criticAgent, "Treat per-slice `risk_score` as supplemental stricter metadata only");
}

async function assertStandardOpencodeInstall(projectPath) {
  const { syncOutput: initOutput } = await initProjectWithLocalOpencodeFallback(projectPath, { commandSurface: "standard" });
  for (const command of standardOpencodeCommands) {
    assertIncludes(initOutput, `new-managed: .opencode/commands/${command}`);
  }

  const harnessConfig = await fs.readFile(path.join(projectPath, "marionettist.config.yaml"), "utf8");
  assertIncludes(harnessConfig, 'opencode:\n  commandSurface: "standard"');

  await assertCommandSurface(projectPath, { mode: "standard" });

  const manifest = await readManifest(projectPath);
  const standardCommandEntry = manifest.managedFiles.find((file) => file.path === ".opencode/commands/marionettist-status.md");
  assert(standardCommandEntry?.adapter === "opencode", "standard install manifest must retain OpenCode adapter metadata");
  assert(standardCommandEntry?.commandSurface === "standard", "standard install manifest must record standard command surface metadata");

  const doctorOutput = await assertProjectDoctorBaseline(projectPath, "standard opencode install");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [standard] required normal commands present");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [standard] standard helper commands present");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [standard] advanced-only commands absent");

  const continueCommand = await fs.readFile(path.join(projectPath, ".opencode", "commands", "marionettist-continue.md"), "utf8");
  assertIncludes(continueCommand, "Supplemental `risk_score`");
  assertIncludes(continueCommand, "must never weaken `gateClass`");

  const diffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(diffOutput, "unchanged: .opencode/commands/marionettist-context.md");
  assertIncludes(diffOutput, "unchanged: .opencode/commands/marionettist-status.md");
}

async function assertAdvancedOpencodeInstall(projectPath) {
  const { syncOutput: initOutput } = await initProjectWithLocalOpencodeFallback(projectPath, { commandSurface: "advanced" });
  for (const command of [...standardOpencodeCommands, ...advancedOnlyOpencodeCommands]) {
    assertIncludes(initOutput, `new-managed: .opencode/commands/${command}`);
  }

  const harnessConfig = await fs.readFile(path.join(projectPath, "marionettist.config.yaml"), "utf8");
  assertIncludes(harnessConfig, 'opencode:\n  commandSurface: "advanced"');

  await assertCommandSurface(projectPath, { mode: "advanced" });

  const manifest = await readManifest(projectPath);
  const fullCommandEntry = manifest.managedFiles.find((file) => file.path === ".opencode/commands/marionettist-feature.md");
  assert(fullCommandEntry?.adapter === "opencode", "full install manifest must retain OpenCode adapter metadata");
  assert(fullCommandEntry?.commandSurface === "advanced", "full alias install must record normalized advanced command surface metadata");

  let doctorOutput = await assertProjectDoctorBaseline(projectPath, "advanced opencode install");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [advanced] required normal commands present");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [advanced] standard helper commands present");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [advanced] advanced commands present");

  const diffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(diffOutput, "unchanged: .opencode/commands/marionettist-feature.md");
  assertIncludes(diffOutput, "unchanged: .opencode/commands/marionettist-status.md");

  const legacyAliasConfig = harnessConfig.replace('commandSurface: "advanced"', 'commandSurface: "full"');
  await fs.writeFile(path.join(projectPath, "marionettist.config.yaml"), legacyAliasConfig, "utf8");

  doctorOutput = await assertProjectDoctorBaseline(projectPath, "advanced opencode legacy full alias");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [legacy-full] required normal commands present");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [legacy-full] standard helper commands present");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [legacy-full] advanced commands present");

  await fs.writeFile(path.join(projectPath, "marionettist.config.yaml"), harnessConfig, "utf8");
  const noConfig = harnessConfig.replace(/\n\nopencode:\n  commandSurface: "advanced"\n/u, "\n");
  await fs.writeFile(path.join(projectPath, "marionettist.config.yaml"), noConfig, "utf8");

  const legacyDiffOutput = await harness("diff", "--project", projectPath);
  assertIncludes(legacyDiffOutput, "unchanged: .opencode/commands/marionettist-feature.md");
  assertIncludes(legacyDiffOutput, "unchanged: .opencode/commands/marionettist-status.md");

  doctorOutput = await assertProjectDoctorBaseline(projectPath, "advanced opencode inferred legacy full");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [legacy-full] required normal commands present");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [legacy-full] standard helper commands present");
  assertIncludes(doctorOutput, "PASS  OpenCode command surface [legacy-full] advanced commands present");

  const minimalSurfaceDiff = await harness("diff", "--project", projectPath, "--with-opencode", "--opencode-command-surface", "minimal");
  assertIncludes(minimalSurfaceDiff, "orphan-managed: .opencode/commands/marionettist-feature.md");
  assertIncludes(minimalSurfaceDiff, "orphan-managed: .opencode/commands/marionettist-status.md");

  const minimalSurfaceSyncDryRun = await harness("sync", "--project", projectPath, "--dry-run", "--with-opencode", "--opencode-command-surface", "minimal");
  assertIncludes(minimalSurfaceSyncDryRun, "orphan-managed: .opencode/commands/marionettist-feature.md");
  assertIncludes(minimalSurfaceSyncDryRun, "orphan-managed: .opencode/commands/marionettist-status.md");
  assert(await pathExists(path.join(projectPath, ".opencode", "commands", "marionettist-feature.md")), "surface reduction dry-run must preserve advanced orphan command files");
  assert(await pathExists(path.join(projectPath, ".opencode", "commands", "marionettist-status.md")), "surface reduction dry-run must preserve standard orphan command files");

  const invalidConfig = `${noConfig.replace(/\s*$/u, "")}\n\nopencode:\n  commandSurface: "surprise"\n`;
  await fs.writeFile(path.join(projectPath, "marionettist.config.yaml"), invalidConfig, "utf8");
  let invalidDoctor = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(invalidDoctor.code !== 0, "doctor must fail when opencode.commandSurface is invalid");
  assertIncludes(invalidDoctor.stdout, "FAIL  marionettist.config.yaml opencode.commandSurface invalid: expected minimal|standard|advanced|full, got surprise");

  await fs.writeFile(path.join(projectPath, "marionettist.config.yaml"), harnessConfig, "utf8");
  await fs.rm(path.join(projectPath, ".opencode", "commands", "marionettist.md"));
  invalidDoctor = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(invalidDoctor.code !== 0, "doctor must fail when a required normal command is missing");
  assertIncludes(invalidDoctor.stdout, "FAIL  OpenCode command surface [advanced] missing required normal command(s): .opencode/commands/marionettist.md");
}

async function assertOpencodeCommandSmoke(projectPath, commandName, label = commandName) {
  const helpCommand = ["run", "--help"];
  const helpResult = await execAllowFailure("opencode", helpCommand, repoRoot, {
    timeout: 30_000
  });

  if (helpResult.code === "ENOENT") {
    console.log(`opencode-command-smoke:${label}: NOT_RUN opencode CLI unavailable (${formatCommand("opencode", helpCommand)})`);
    return;
  }

  const helpOutput = [helpResult.stdout, helpResult.stderr].filter(Boolean).join("\n");
  if (!helpOutput.includes("--command")) {
    console.log([
      `opencode-command-smoke:${label}: NOT_RUN current opencode CLI syntax does not advertise --command support`,
      `evidence command: ${formatCommand("opencode", helpCommand)}`,
      `evidence exit: ${String(helpResult.code)}`,
      helpOutput ? `evidence output:\n${helpOutput}` : "evidence output: <empty>"
    ].join("\n"));
    return;
  }

  assert(helpResult.code === 0, [
    "OpenCode run help check failed before command smoke.",
    `command: ${formatCommand("opencode", helpCommand)}`,
    `exit: ${String(helpResult.code)}`,
    `stdout:\n${helpResult.stdout}`,
    `stderr:\n${helpResult.stderr}`
  ].join("\n"));

  const smokeCommand = ["run", "--dir", projectPath, "--format", "json", "--command", commandName, "smoke validation"];
  console.log(`opencode-command-smoke:${label}: attempting ${formatCommand("opencode", smokeCommand)}`);
  const runResult = await execAllowFailureWithPty("opencode", smokeCommand, repoRoot, {
    timeout: 120_000,
    env: {
      ...process.env,
      OPENCODE_DISABLE_AUTOUPDATE: "1"
    }
  });

  assert(runResult.code === 0, [
    `OpenCode ${label} command smoke failed.`,
    `command: ${formatCommand("opencode", smokeCommand)}`,
    `exit: ${String(runResult.code)}`,
    `stdout:\n${runResult.stdout}`,
    `stderr:\n${runResult.stderr}`
  ].join("\n"));

  const combinedOutput = [runResult.stdout, runResult.stderr].filter(Boolean).join("\n");
  assert(combinedOutput.trim().length > 0, [
    `OpenCode ${label} command smoke returned no output.`,
    `command: ${formatCommand("opencode", smokeCommand)}`
  ].join("\n"));
  assert(!combinedOutput.includes('"type":"error"') && !combinedOutput.includes("Unexpected server error"), [
    `OpenCode ${label} command smoke reported an in-band runtime error.`,
    `command: ${formatCommand("opencode", smokeCommand)}`,
    `stdout:\n${runResult.stdout}`,
    `stderr:\n${runResult.stderr}`
  ].join("\n"));

  console.log(`opencode-command-smoke:${label}: PASS ${formatCommand("opencode", smokeCommand)}`);
}

async function assertCommandSurface(projectPath, { mode }) {
  const commandsRoot = path.join(projectPath, ".opencode", "commands");
  for (const command of normalOpencodeCommands) {
    assert(await pathExists(path.join(commandsRoot, command)), `${mode} OpenCode install must include ${command}`);
  }

  for (const command of standardOpencodeCommands) {
    const exists = await pathExists(path.join(commandsRoot, command));
    if (mode === "minimal") {
      assert(!exists, `minimal OpenCode install must not include ${command}`);
    } else {
      assert(exists, `${mode} OpenCode install must include ${command}`);
    }
  }

  for (const command of advancedOnlyOpencodeCommands) {
    const exists = await pathExists(path.join(commandsRoot, command));
    if (mode === "advanced") {
      assert(exists, `advanced OpenCode install must include ${command}`);
    } else {
      assert(!exists, `${mode} OpenCode install must not include ${command}`);
    }
  }
}

async function listCommandFiles(projectPath) {
  const commandsRoot = path.join(projectPath, ".opencode", "commands");
  return (await fs.readdir(commandsRoot)).filter((name) => name.endsWith(".md")).sort();
}

async function assertRenderedOpencodeModels(projectPath) {
  const expectedModels = await readExpectedAgentModels(projectPath);

  for (const [agentName, expectedModel] of Object.entries(expectedModels)) {
    assert(typeof expectedModel === "string" && expectedModel.length > 0, `Expected model profile default for ${agentName}`);
    const agentContent = await fs.readFile(path.join(projectPath, ".opencode", "agents", `${agentName}.md`), "utf8");
    assertIncludes(agentContent, `model: ${expectedModel}`);
    assertExcludes(agentContent, "{{MODEL_PROFILE_");
  }
}

async function assertCanonicalProfileOverridesRender(projectPath) {
  const modelProfilesPath = path.join(projectPath, ".marionettist", "model-profiles.yml");
  const builderManifestPath = ".opencode/agents/marionettist-builder.md";
  const originalProfiles = await fs.readFile(modelProfilesPath, "utf8");
  const originalManifest = await readManifest(projectPath);
  const originalBuilderEntry = originalManifest.managedFiles.find((file) => file.path === builderManifestPath);
  const overriddenProfiles = originalProfiles
    .replace("default: \"openai/gpt-5.5\"", "default: \"smoke/think-override\"")
    .replace(/default: "(?:openai\/gpt-5\.4|openai\/gpt-5\.3-codex)"/, "default: \"smoke/build-override\"")
    .replace("default: \"deepseek/deepseek-v4-pro\"", "default: \"smoke/review-override\"")
    .replace("default: \"deepseek/deepseek-v4-flash\"", "default: \"smoke/run-override\"");
  assert(overriddenProfiles !== originalProfiles, "Expected canonical profile override fixture to change model defaults");

  try {
    await fs.writeFile(modelProfilesPath, overriddenProfiles, "utf8");
    const diffOutput = await harness("diff", "--project", projectPath, "--with-opencode");
    assertIncludes(diffOutput, "update: .opencode/agents/marionettist-builder.md");
    assertIncludes(diffOutput, "update: .opencode/agents/marionettist-coder.md");
    assertIncludes(diffOutput, "update: .opencode/agents/marionettist-reviewer.md");
    assertIncludes(diffOutput, "update: .opencode/agents/marionettist-validator.md");

    await harness("sync", "--project", projectPath, "--with-opencode");
    const updatedManifest = await readManifest(projectPath);
    const updatedBuilderEntry = updatedManifest.managedFiles.find((file) => file.path === builderManifestPath);
    assert(updatedBuilderEntry?.renderedHash !== originalBuilderEntry?.renderedHash, "canonical profile sync must update builder renderedHash metadata");
    const overriddenModels = await readExpectedAgentModels(projectPath);
    for (const [agentName, expectedModel] of Object.entries(overriddenModels)) {
      const agentContent = await fs.readFile(path.join(projectPath, ".opencode", "agents", `${agentName}.md`), "utf8");
      assertIncludes(agentContent, `model: ${expectedModel}`);
    }
  } finally {
    await fs.writeFile(modelProfilesPath, originalProfiles, "utf8");
    await harness("sync", "--project", projectPath, "--with-opencode");
    await assertRenderedOpencodeModels(projectPath);
  }
}

async function assertDoctorModelDriftStates(projectPath) {
  const builderPath = path.join(projectPath, ".opencode", "agents", "marionettist-builder.md");
  const reviewerPath = path.join(projectPath, ".opencode", "agents", "marionettist-reviewer.md");
  const configPath = path.join(projectPath, "marionettist.config.yaml");
  const expectedModels = await readExpectedAgentModels(projectPath);

  const originalBuilder = await fs.readFile(builderPath, "utf8");
  const originalReviewer = await fs.readFile(reviewerPath, "utf8");
  const originalConfig = await fs.readFile(configPath, "utf8");

  const driftedBuilder = originalBuilder.replace(`model: ${expectedModels["marionettist-builder"]}`, "model: smoke/drifted-think");
  assert(driftedBuilder !== originalBuilder, "Expected marionettist-builder test fixture replacement to change the model");

  try {
    await fs.writeFile(builderPath, driftedBuilder, "utf8");
    let doctor = await assertProjectDoctorBaselineResult(projectPath, "model drift warning");
    assertIncludes(doctor.stdout, `WARN  OpenCode model [DRIFTED] .opencode/agents/marionettist-builder.md model drifted to smoke/drifted-think; expected ${expectedModels["marionettist-builder"]} from .marionettist/model-profiles.yml profile think.default.`);

    await fs.writeFile(builderPath, originalBuilder.replace(`model: ${expectedModels["marionettist-builder"]}`, "model: {{MODEL_PROFILE_THINK}}"), "utf8");
    doctor = await harnessAllowFailure("doctor", "--project", projectPath);
    assert(doctor.code !== 0, "doctor must fail when unresolved placeholders remain in runtime OpenCode files");
    assertIncludes(doctor.stdout, "FAIL  OpenCode placeholder [UNRESOLVED] .opencode/agents/marionettist-builder.md still contains MODEL_PROFILE placeholders.");

    await fs.writeFile(builderPath, originalBuilder, "utf8");
    await fs.rm(reviewerPath);
    doctor = await assertProjectDoctorBaselineResult(projectPath, "config fallback preserves canonical profile");
    assertIncludes(doctor.stdout, `WARN  OpenCode model [MISSING] .opencode/agents/marionettist-reviewer.md missing; expected model ${expectedModels["marionettist-reviewer"]} from .marionettist/model-profiles.yml profile review.default.`);

    await fs.writeFile(reviewerPath, originalReviewer, "utf8");
    await fs.writeFile(configPath, originalConfig.replace("default: \"openai/gpt-5.5\"", "default: \"legacy/conflict-think\""), "utf8");
    doctor = await harnessAllowFailure("doctor", "--project", projectPath);
    assertIncludes(doctor.stdout, `PASS  OpenCode model [OK] .opencode/agents/marionettist-builder.md model ${expectedModels["marionettist-builder"]} matches .marionettist/model-profiles.yml profile think.default.`);
  } finally {
    await fs.writeFile(builderPath, originalBuilder, "utf8");
    await fs.writeFile(reviewerPath, originalReviewer, "utf8");
    await fs.writeFile(configPath, originalConfig, "utf8");
  }
}

async function assertLegacyProfileFallbackRender(projectPath) {
  const canonicalPath = path.join(projectPath, ".marionettist", "model-profiles.yml");
  const configPath = path.join(projectPath, "marionettist.config.yaml");
  const builderPath = path.join(projectPath, ".opencode", "agents", "marionettist-builder.md");
  const coderPath = path.join(projectPath, ".opencode", "agents", "marionettist-coder.md");
  const originalCanonical = await fs.readFile(canonicalPath, "utf8");
  const originalConfig = await fs.readFile(configPath, "utf8");

  const legacyThink = "legacy/fallback-think";
  const legacyBuild = "legacy/fallback-build";
  const legacyReview = "legacy/fallback-review";
  const legacyRun = "legacy/fallback-run";

  try {
    await fs.rm(canonicalPath);
    const legacyConfig = originalConfig
      .replace('default: "openai/gpt-5.5"', `default: "${legacyThink}"`)
      .replace(/default: "(?:openai\/gpt-5\.4|openai\/gpt-5\.3-codex)"/, `default: "${legacyBuild}"`)
      .replace('default: "deepseek/deepseek-v4-pro"', `default: "${legacyReview}"`)
      .replace('default: "deepseek/deepseek-v4-flash"', `default: "${legacyRun}"`);
    await fs.writeFile(configPath, legacyConfig, "utf8");

    const diffOutput = await harness("diff", "--project", projectPath, "--with-opencode");
    assertIncludes(diffOutput, "missing: .marionettist/model-profiles.yml");
    assertIncludes(diffOutput, "conflict: marionettist.config.yaml");

    let doctor = await assertProjectDoctorBaselineResult(projectPath, "missing canonical profiles warning");
    assertIncludes(doctor.stdout, "WARN  OpenCode model [MISSING] .opencode/agents/marionettist-builder.md cannot determine expected model because .marionettist/model-profiles.yml is missing for profile think.");

    await harness("sync", "--project", projectPath, "--with-opencode");

    const canonicalAfterSync = await fs.readFile(canonicalPath, "utf8");
    assertIncludes(canonicalAfterSync, 'default: "openai/gpt-5.5"');
    assertIncludes(canonicalAfterSync, 'default: "openai/gpt-5.4"');
    assertIncludes(await fs.readFile(builderPath, "utf8"), "model: openai/gpt-5.5");
    assertIncludes(await fs.readFile(coderPath, "utf8"), "model: openai/gpt-5.4");

    doctor = await assertProjectDoctorBaselineResult(projectPath, "canonical profiles restored after sync");
    assertIncludes(doctor.stdout, "PASS  OpenCode model [OK] .opencode/agents/marionettist-builder.md model openai/gpt-5.5 matches .marionettist/model-profiles.yml profile think.default.");
  } finally {
    await fs.writeFile(configPath, originalConfig, "utf8");
    await fs.writeFile(canonicalPath, originalCanonical, "utf8");
    await harness("sync", "--project", projectPath, "--with-opencode");
  }
}

async function readExpectedAgentModels(projectPath) {
  const profileSource = parseSimpleYaml(await fs.readFile(path.join(projectPath, ".marionettist", "model-profiles.yml"), "utf8"));
  return {
    "marionettist-builder": profileSource.profiles?.think?.default,
    "marionettist-planner": profileSource.profiles?.think?.default,
    "marionettist-coder": profileSource.profiles?.build?.default,
    "marionettist-reviewer": profileSource.profiles?.review?.default,
    "marionettist-critic": profileSource.profiles?.review?.default,
    "marionettist-validator": profileSource.profiles?.run?.default,
    "marionettist-indexer": profileSource.profiles?.run?.default
  };
}

async function assertP1DocsAndTemplateCoverage() {
  const harnessConfigTemplate = await fs.readFile(path.join(repoRoot, "templates", "marionettist.config.yaml"), "utf8");
  const targetAgentsTemplate = await fs.readFile(path.join(repoRoot, "templates", "AGENTS.md"), "utf8");
  const builderTemplate = await fs.readFile(path.join(repoRoot, "templates", "pathways", "opencode", "agents", "marionettist-builder.md"), "utf8");
  const coderTemplate = await fs.readFile(path.join(repoRoot, "templates", "pathways", "opencode", "agents", "marionettist-coder.md"), "utf8");
  const criticTemplate = await fs.readFile(path.join(repoRoot, "templates", "pathways", "opencode", "agents", "marionettist-critic.md"), "utf8");
  const reviewerTemplate = await fs.readFile(path.join(repoRoot, "templates", "pathways", "opencode", "agents", "marionettist-reviewer.md"), "utf8");
  const continueCommand = await fs.readFile(path.join(repoRoot, "templates", "pathways", "opencode", "commands", "marionettist-continue.md"), "utf8");
  const workflowTemplate = await fs.readFile(path.join(repoRoot, "templates", "docs", "project", "marionettist-workflow.md"), "utf8");
  const incidentCommand = await fs.readFile(path.join(repoRoot, "templates", "pathways", "opencode", "commands", "marionettist-incident.md"), "utf8");
  const incidentSkill = await fs.readFile(path.join(repoRoot, "skills", "incident-pack-builder", "SKILL.md"), "utf8");
  const hypothesisSkill = await fs.readFile(path.join(repoRoot, "skills", "hypothesis-critic", "SKILL.md"), "utf8");
  const contextPackSkill = await fs.readFile(path.join(repoRoot, "skills", "context-pack-builder", "SKILL.md"), "utf8");
  const workspaceKnowledgeSkill = await fs.readFile(path.join(repoRoot, "skills", "workspace-knowledge-manager", "SKILL.md"), "utf8");
  const knowledgeMapTemplate = await fs.readFile(path.join(repoRoot, "templates", "docs", "project", "knowledge-map.md"), "utf8");
  const repositoryRulesTemplate = await fs.readFile(path.join(repoRoot, "templates", "rules", "00-repository-rules.md"), "utf8");
  const workflowRulesTemplate = await fs.readFile(path.join(repoRoot, "templates", "rules", "workflow-rules.md"), "utf8");

  assertIncludes(harnessConfigTemplate, "knowledge:");
  assertIncludes(harnessConfigTemplate, 'mode: "{{KNOWLEDGE_MODE}}"');
  assertIncludes(harnessConfigTemplate, 'maturity: "{{KNOWLEDGE_MATURITY}}"');
  assertIncludes(criticTemplate, "model: {{HARNESS_CRITIC_MODEL}}");
  assertIncludes(criticTemplate, "temperature: {{HARNESS_CRITIC_TEMPERATURE}}");
  assertIncludes(criticTemplate, "Your model field is rendered from `.marionettist/model-profiles.yml` profile `profiles.review.default` when present, with legacy fallback to `marionettist.config.yaml` `models.profiles.review.default` only when needed.");
  assertIncludes(coderTemplate, "Your responsibility is implementation plus lightweight self-check, not independent review.");
  assertIncludes(coderTemplate, "Do not perform broad `git diff` review, repository-wide search, gate audit, requirement audit, or docs/knowledge-map review");
  assertIncludes(coderTemplate, "When the caller provides a `taskEnvelope`, it takes precedence over implicit `.task/active.json` lookup.");
  assertIncludes(coderTemplate, "When `marionettist-builder` provides a preflighted `taskEnvelope`, treat it as the authoritative delegated task-context source");
  assertIncludes(coderTemplate, "Use `taskEnvelope.artifactPaths` for bounded task-artifact reads.");
  assertIncludes(coderTemplate, "Read `.task/active.json` only when the caller explicitly included it in `artifactPaths` for a narrow consistency check.");
  assertIncludes(coderTemplate, "If `taskEnvelope` is missing, inaccessible, stale, or ambiguous, or if the referenced artifacts do not provide enough bounded context to implement safely, stop immediately and return this exact structure instead of continuing:");
  assertIncludes(coderTemplate, "## Verdict\n\nCONTEXT_UNAVAILABLE\n\n## Reason\n\ndelegated coding context missing, stale, inaccessible, or ambiguous");
  assertIncludes(coderTemplate, "## Suggested Builder Action\n\nrefresh and resend a complete taskEnvelope with usable artifactPaths");
  assertIncludes(coderTemplate, "Do not retry on your own and do not loop trying to rediscover context.");
  assertIncludes(reviewerTemplate, "## Diff-First Review Protocol");
  assertIncludes(reviewerTemplate, "Do not re-review requirement freezing, implementation-plan quality, context-pack sufficiency, or Marionettist gate state");
  assertIncludes(reviewerTemplate, "Repository-wide search is an exception, not the default.");
  assertIncludes(criticTemplate, "The caller must state the critic mode:");
  assertIncludes(criticTemplate, "`plan-review`: runs before coding for Tier L or high-risk work.");
  assertIncludes(criticTemplate, "`pre-done`: runs after coding, validation, and `marionettist-reviewer` for the current approved slice or group.");
  assertIncludes(criticTemplate, "Do not read full code diffs in `pre-done` unless reviewer evidence is missing");
  assertIncludes(criticTemplate, "PASS | PASS_WITH_WARNINGS | BLOCKED");
  assertIncludes(builderTemplate, "For `marionettist-coder`, request implementation plus lightweight self-check only.");
  assertIncludes(builderTemplate, "For `marionettist-reviewer`, request `diff-review` of the current slice or repair and provide changed files.");
  assertIncludes(builderTemplate, "For `marionettist-critic`, always state `plan-review` or `pre-done`.");
  assertIncludes(builderTemplate, "frozen `gateClass` and supplemental `risk_score`");
  assertIncludes(builderTemplate, "include both the controlling `gateClass` and any `risk_score` threshold or `gateReasons` evidence");
  assertIncludes(builderTemplate, "Build and pass an explicit compact `taskEnvelope` with every coding, reviewer, or critic delegation.");
  assertIncludes(builderTemplate, "Include at minimum: `worktreeRoot`, `taskId`, `phase`, `allowedToCode`, the current approved `currentSlice` or approved parallel group, `artifactPaths`, and allowed/forbidden scope when relevant.");
  assertIncludes(builderTemplate, "Use `taskEnvelope` terminology literally and consistently in delegation prompts.");
  assertIncludes(builderTemplate, "stop and report `CONTEXT_UNAVAILABLE` instead of delegating on guessed context");
  assertIncludes(builderTemplate, "Treat `.task/active.json` as a local repository-root or worktree pointer only, not as implicit cross-worktree delegation context.");
  assertIncludes(builderTemplate, "Make delegated agents use the provided `taskEnvelope` and bounded artifact reads instead of rediscovering task state from `.task/active.json`.");
  assertIncludes(builderTemplate, "This prompt contract is a delegation-safety layer only. Do not claim or imply full runtime git-worktree scheduling support.");
  assertIncludes(builderTemplate, "If a delegation returns empty output or is cancelled, retry at most once");
  assertIncludes(builderTemplate, "If the retry also returns empty, cancelled, or `CONTEXT_UNAVAILABLE`, stop and report an orchestrator-level failure instead of looping.");
  assertIncludes(criticTemplate, "The caller must also provide a preflighted `taskEnvelope` for delegated critic work.");
  assertIncludes(criticTemplate, "`taskEnvelope` with `worktreeRoot`, `taskId`, `phase`, `allowedToCode`, current slice or approved group, and `artifactPaths`");
  assertIncludes(criticTemplate, "Use bounded reads against the files referenced by `taskEnvelope.artifactPaths`.");
  assertIncludes(criticTemplate, "Do not start by rediscovering the active task from `.task/active.json`.");
  assertIncludes(criticTemplate, "If `taskEnvelope` is missing, inaccessible, stale, or ambiguous, or if the referenced task artifacts cannot be read well enough to establish safe review context, stop immediately and return this exact structure instead of continuing:");
  assertIncludes(criticTemplate, "## Verdict\n\nCONTEXT_UNAVAILABLE\n\n## Reason");
  assertIncludes(criticTemplate, "Do not retry on your own and do not loop trying to rediscover context.");
  assertIncludes(reviewerTemplate, "For delegated review work, the caller must provide a preflighted `taskEnvelope`.");
  assertIncludes(reviewerTemplate, "Start from caller-provided `taskEnvelope`, `changedFiles`, `allowedFiles`, `forbiddenFiles`, validation evidence, and the current slice identifier.");
  assertIncludes(reviewerTemplate, "Use `taskEnvelope.artifactPaths` for bounded task-artifact reads");
  assertIncludes(reviewerTemplate, "Do not start with implicit `.task/active.json` lookup.");
  assertIncludes(reviewerTemplate, "If `taskEnvelope` is missing, inaccessible, stale, or ambiguous, or if the referenced artifacts do not provide enough bounded context to review safely, stop immediately and return this exact structure instead of continuing:");
  assertIncludes(reviewerTemplate, "## Recommendation\n\nCONTEXT_UNAVAILABLE\n\n## Reason");
  assertIncludes(reviewerTemplate, "Do not retry on your own and do not loop trying to rediscover context.");
  assertIncludes(continueCommand, "If coding is complete but review has not passed, route to `marionettist-reviewer` for the current slice or group.");
  assertIncludes(continueCommand, "Use the reviewer’s bounded high-risk two-stage mode when the task or current slice/group is Tier L, high-risk, boundary-sensitive, workflow-sensitive, or critic-required.");
  assertIncludes(continueCommand, "Otherwise use the reviewer’s standard bounded diff-review mode by default.");
  assertIncludes(continueCommand, "route to `marionettist-critic` in `pre-done` mode");
  assertIncludes(continueCommand, "Supplemental `risk_score` is stricter metadata.");
  assertIncludes(continueCommand, "must never weaken `gateClass`");
  assertIncludes(workflowTemplate, "Review is diff-first and bounded to the current approved slice or group.");
  assertIncludes(workflowTemplate, "The coding agent may perform lightweight self-check");
  assertIncludes(workflowTemplate, "read `knowledge.mode` and `knowledge.maturity`");
  assertIncludes(workflowTemplate, "docs/current/...");
  assertIncludes(workflowTemplate, "docs/target/...");
  assertIncludes(workflowTemplate, "**L0 — Minimal capture**");
  assertIncludes(workflowTemplate, "**L4 — Strict governance**");
  assertIncludes(workflowTemplate, "`risk_score` is supplemental per-slice gate metadata with an integer range from `1` to `5`:");
  assertIncludes(workflowTemplate, "Use `risk_score` only to preserve or strengthen the safer pause behavior relative to `gateClass`.");
  assertExcludes(workflowTemplate, "numeric risk scoring is deferred");
  assertExcludes(workflowTemplate, "without any numeric score field");

  const incidentFrontmatter = parseSimpleFrontmatter(incidentCommand);
  assert(incidentFrontmatter.description?.length > 0, "marionettist-incident template must declare description frontmatter");
  assert(incidentFrontmatter.agent === "marionettist-builder", "marionettist-incident template must route to marionettist-builder");

  const incidentSkillFrontmatter = parseSimpleFrontmatter(incidentSkill);
  assert(incidentSkillFrontmatter.name === "incident-pack-builder", "incident-pack-builder skill must declare its name");
  assert(incidentSkillFrontmatter.description?.length > 0, "incident-pack-builder skill must declare description frontmatter");

  const hypothesisSkillFrontmatter = parseSimpleFrontmatter(hypothesisSkill);
  assert(hypothesisSkillFrontmatter.name === "hypothesis-critic", "hypothesis-critic skill must declare its name");
  assert(hypothesisSkillFrontmatter.description?.length > 0, "hypothesis-critic skill must declare description frontmatter");

  assertIncludes(contextPackSkill, "Read `docs/project/knowledge-map.md` to route only the most relevant docs and rules.");
  assertIncludes(contextPackSkill, "load only nearby `MODULE_RULES.md`, `AGENTS.md`, or `HARNESS_RULES.md` files");
  assertIncludes(contextPackSkill, "### Global Rules");
  assertIncludes(contextPackSkill, "### Knowledge Map Matches");
  assertIncludes(contextPackSkill, "### Path-Proximity Rules");
  assertIncludes(contextPackSkill, "### Excluded Context");
  assertIncludes(contextPackSkill, "knowledge.mode: mudball");
  assertIncludes(contextPackSkill, "knowledge.maturity");

  assertIncludes(workspaceKnowledgeSkill, "read `marionettist.config.yaml` when it exists");
  assertIncludes(workspaceKnowledgeSkill, "knowledge.mode");
  assertIncludes(workspaceKnowledgeSkill, "knowledge.maturity");
  assertIncludes(workspaceKnowledgeSkill, "L0-L1 are valid adoption levels");

  assertIncludes(targetAgentsTemplate, "knowledge.mode");
  assertIncludes(targetAgentsTemplate, "knowledge.maturity");
  assertIncludes(targetAgentsTemplate, "docs/current/");
  assertIncludes(targetAgentsTemplate, "do not treat target docs as evidence of current behavior");
  assertIncludes(targetAgentsTemplate, "Do not silently upgrade `observed` or `target` rules into stronger constraints.");
  assertIncludes(targetAgentsTemplate, "supplemental `risk_score`");
  assertIncludes(targetAgentsTemplate, "For this workflow, the `gateClass` vocabulary is intentionally frozen to `simple`, `standard`, `boundary-sensitive`, and `high-risk`.");
  assertIncludes(targetAgentsTemplate, "When delegating across parallel flows or multiple worktrees, the primary agent should preflight context once and pass explicit delegation context such as `worktreeRoot`, `taskId`, `phase`, `allowedToCode`, the current approved slice or group, and `artifactPaths`.");
  assertIncludes(targetAgentsTemplate, "Delegated agents should use bounded reads against those provided artifacts, return `CONTEXT_UNAVAILABLE` for missing, stale, inaccessible, or ambiguous context, and stop after bounded empty or cancelled delegation outcomes instead of looping.");
  assertIncludes(targetAgentsTemplate, "This is a delegation-safety boundary, not full runtime git-worktree scheduling support.");
  assertExcludes(targetAgentsTemplate, "Do not add numeric scoring");
  assertExcludes(targetAgentsTemplate, "without any numeric score field");

  const opencodeReadmeTemplate = await fs.readFile(path.join(repoRoot, "templates", "pathways", "opencode", "README.md"), "utf8");
  assertIncludes(opencodeReadmeTemplate, "low/moderate-risk `gateClass: standard` slice/group with `risk_score <= 3`");
  assertIncludes(opencodeReadmeTemplate, "whose supplemental `risk_score` reflects concrete elevated risk");

  assertIncludes(workflowRulesTemplate, "low/moderate-risk `gateClass: standard` slice with `risk_score <= 3`");

  assertIncludes(repositoryRulesTemplate, "type: observed | confirmed | target | hard");
  assertIncludes(repositoryRulesTemplate, "confidence: low | medium | high");
  assertIncludes(repositoryRulesTemplate, "source: <where this came from>");
  assertIncludes(repositoryRulesTemplate, "Do not silently promote `observed` or `target` rules into `confirmed` or `hard` constraints.");
  assertIncludes(workflowRulesTemplate, "type: hard");
  assertIncludes(workflowRulesTemplate, "type: confirmed");
  assertIncludes(workflowRulesTemplate, "marked `observed` describe how the project currently appears to operate");
  assertIncludes(workflowRulesTemplate, "marked `target` describe desired future process");

  assertIncludes(knowledgeMapTemplate, "docs/current/");
  assertIncludes(knowledgeMapTemplate, "docs/target/");
  assertIncludes(knowledgeMapTemplate, "knowledge.mode: mudball");
  assertIncludes(knowledgeMapTemplate, "type`, `confidence`, and `source`");
  assertIncludes(knowledgeMapTemplate, "Do not silently upgrade `observed` or `target` rules into enforceable hard constraints.");

  for (const field of ["- Areas:", "- Tags:", "- Docs:", "- Rules:", "- Read When:", "- Boundaries:", "- Validation:"]) {
    assertIncludes(knowledgeMapTemplate, field);
  }
}

function toPosix(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

async function readManifest(projectPath) {
  return JSON.parse(await fs.readFile(path.join(projectPath, ".marionettist", "manifest.json"), "utf8"));
}

async function writeManifest(projectPath, manifest) {
  await fs.writeFile(path.join(projectPath, ".marionettist", "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function parseBackupRoot(output) {
  const match = output.match(/^backup root: (.+)$/m);
  assert(match, `Expected clear output to include backup root. Actual output:\n${output}`);
  return match[1];
}

async function assertPublishableSensitiveScan() {
  const exclusions = [];
  const filesToScan = [];

  for (const relativeRoot of publishableScanRoots) {
    const absoluteRoot = path.join(repoRoot, relativeRoot);
    if (!(await pathExists(absoluteRoot))) {
      continue;
    }

    const stat = await fs.stat(absoluteRoot);
    if (stat.isDirectory()) {
      await collectTextFiles(absoluteRoot, relativeRoot, filesToScan, exclusions);
      continue;
    }

    if (!isBinaryLikePath(relativeRoot)) {
      filesToScan.push(relativeRoot);
    }
  }

  const matches = [];

  for (const relativeFile of filesToScan) {
    const absoluteFile = path.join(repoRoot, relativeFile);
    const content = await fs.readFile(absoluteFile, "utf8");
    for (const pattern of forbiddenSensitivePatterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(content)) {
        matches.push({ file: relativeFile, pattern: pattern.label });
      }
    }
  }

  if (exclusions.length > 0) {
    console.log(`sensitive-scan: excluded ${exclusions.join(", ")}`);
  }

  assert(matches.length === 0, `Sensitive publishable asset matches found:\n${matches.map((match) => `- ${match.file}: ${match.pattern}`).join("\n")}`);
  console.log(`sensitive-scan: PASS (${filesToScan.length} files checked)`);
}

async function assertTaskStateContractTemplate() {
  const workflowTemplate = await fs.readFile(path.join(repoRoot, "templates", "docs", "project", "marionettist-workflow.md"), "utf8");
  assertIncludes(workflowTemplate, "## Task State Contract");
  assertIncludes(workflowTemplate, "`taskId` is a relative task path under `.task/`, using `yyyy-MM-dd/task-slug`");
  assertIncludes(workflowTemplate, "### `.task/active.json`");
  assertIncludes(workflowTemplate, "### `.task/<task-id>/state.json`");
  assertIncludes(workflowTemplate, "| `taskId` | string | yes | Active task path. |");
  assertIncludes(workflowTemplate, "| `status` | string | no | Task status: `in_progress`, `completed`, or `blocked`. |");
  assertIncludes(workflowTemplate, "| `gateClass` | string | no | Frozen gate hint vocabulary. Use only `simple`, `standard`, `boundary-sensitive`, or `high-risk`. |");
  assertIncludes(workflowTemplate, "| `risk_score` | integer | no | Supplemental per-slice risk score from `1` to `5`.");
  assertIncludes(workflowTemplate, "| `gateReasons` | string[] | no | Short reason labels that explain the gate posture for the slice or group");
  assertIncludes(workflowTemplate, '  "gateClass": "boundary-sensitive",');
  assertIncludes(workflowTemplate, '  "risk_score": 4,');
  assertIncludes(workflowTemplate, "Its `taskId` must match `.task/active.json.taskId`.");
  assertIncludes(workflowTemplate, "### Delegation Boundary For Parallel Or Worktree-Aware Execution");
  assertIncludes(workflowTemplate, "Cross-worktree delegation should use an explicit compact `taskEnvelope`");
  assertIncludes(workflowTemplate, "- `worktreeRoot`");
  assertIncludes(workflowTemplate, "- `artifactPaths`");
  assertIncludes(workflowTemplate, "- return `CONTEXT_UNAVAILABLE` when context is missing, inaccessible, stale, or ambiguous");
  assertIncludes(workflowTemplate, "- treat empty or cancelled delegation as a bounded stop condition rather than retrying in a loop");
  assertIncludes(workflowTemplate, "The primary agent remains responsible for surfacing bounded delegation failure clearly");
  assertIncludes(workflowTemplate, "this workflow does not by itself implement full runtime git-worktree scheduling");
}

async function collectTextFiles(absoluteDirectory, relativeDirectory, filesToScan, exclusions) {
  if (shouldExcludeFromPublishableScan(relativeDirectory)) {
    exclusions.push(relativeDirectory.replace(/\\/g, "/"));
    return;
  }

  const entries = await fs.readdir(absoluteDirectory, { withFileTypes: true });
  for (const entry of entries) {
    const childRelativePath = path.join(relativeDirectory, entry.name);
    const childAbsolutePath = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      await collectTextFiles(childAbsolutePath, childRelativePath, filesToScan, exclusions);
      continue;
    }
    if (!isBinaryLikePath(childRelativePath)) {
      filesToScan.push(childRelativePath);
    }
  }
}

function shouldExcludeFromPublishableScan(relativePath) {
  return publishableScanExcludedDirectories.some((excludedDirectory) => relativePath === excludedDirectory || relativePath.startsWith(`${excludedDirectory}${path.sep}`));
}

function parseSimpleFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert(match, "Expected Markdown file to start with frontmatter");
  const frontmatter = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    frontmatter[key] = value;
  }
  return frontmatter;
}

function removeTopLevelYamlSection(content, sectionName) {
  const lines = content.split(/\r?\n/);
  const filtered = [];
  let skipping = false;

  for (const line of lines) {
    const isTopLevel = line.length > 0 && !/^\s/.test(line);
    const isTargetSection = isTopLevel && line === `${sectionName}:`;

    if (isTargetSection) {
      skipping = true;
      continue;
    }

    if (skipping && isTopLevel) {
      skipping = false;
    }

    if (!skipping) {
      filtered.push(line);
    }
  }

  return `${filtered.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s*$/u, "")}\n`;
}

function isBinaryLikePath(relativePath) {
  return binaryLikeExtensions.has(path.extname(relativePath).toLowerCase());
}

async function cleanupPaths(...pathsToRemove) {
  await Promise.all(pathsToRemove.map((targetPath) => fs.rm(targetPath, { recursive: true, force: true })));
}

async function harness(...args) {
  return exec(process.execPath, [marionettistBin, ...args], repoRoot);
}

async function assertProjectDoctorBaseline(projectPath, label) {
  const result = await assertProjectDoctorBaselineResult(projectPath, label);
  return result.stdout;
}

async function assertProjectDoctorBaselineResult(projectPath, label) {
  const result = await harnessAllowFailure("doctor", "--project", projectPath);
  assert(result.code === 0, `doctor must pass for ${label}`);
  assertIncludes(result.stdout, "PASS  AGENTS.md managed block found");
  return result;
}

async function initProjectWithLocalOpencodeFallback(projectPath, { commandSurface = "minimal", preserveExisting = false } = {}) {
  if (!preserveExisting) {
    await cleanupPaths(projectPath);
  }

  const initArgs = ["init", "--project", projectPath, "--auto", "--with-opencode"];
  if (commandSurface === "standard") {
    initArgs.push("--opencode-command-surface", "standard");
  } else if (commandSurface === "advanced") {
    initArgs.push("--opencode-command-surface", "full");
  }

  const initOutput = await harness(...initArgs);
  const syncOutput = await switchProjectToLocalOpencodeFallback(projectPath, { commandSurface });
  return { initOutput, syncOutput };
}

async function switchProjectToLocalOpencodeFallback(projectPath, { commandSurface = "minimal" } = {}) {
  const configPath = path.join(projectPath, "marionettist.config.yaml");
  let harnessConfig = await fs.readFile(configPath, "utf8");
  harnessConfig = harnessConfig.replace('pluginSource: "package"', 'pluginSource: "local"');

  if (!harnessConfig.includes('pluginSource: "local"')) {
    const opencodeBlock = commandSurface === "minimal"
      ? '\nopencode:\n  commandSurface: "minimal"\n  pluginSource: "local"\n'
      : `\nopencode:\n  commandSurface: "${commandSurface}"\n  pluginSource: "local"\n`;
    harnessConfig = `${harnessConfig.replace(/\s*$/u, "")}${opencodeBlock}`;
  }

  await fs.writeFile(configPath, harnessConfig, "utf8");

  const syncArgs = ["sync", "--project", projectPath, "--with-opencode"];
  if (commandSurface === "standard") {
    syncArgs.push("--opencode-command-surface", "standard");
  } else if (commandSurface === "advanced") {
    syncArgs.push("--opencode-command-surface", "full");
  }

  return harness(...syncArgs);
}

async function harnessAllowFailure(...args) {
  return execAllowFailure(process.execPath, [marionettistBin, ...args], repoRoot);
}

async function exec(command, args, cwd, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd,
      encoding: "utf8",
      timeout: options.timeout,
      env: options.env
    }, (error, stdout, stderr) => {
      if (error) {
        error.message = `${error.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function execAllowFailure(command, args, cwd, options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, {
      cwd,
      encoding: "utf8",
      timeout: options.timeout,
      env: options.env
    }, (error, stdout, stderr) => {
      resolve({ code: error?.code ?? 0, stdout, stderr });
    });
  });
}

async function execAllowFailureWithPty(command, args, cwd, options = {}) {
  const scriptPath = "/usr/bin/script";
  if (process.platform === "win32" || !(await pathExists(scriptPath))) {
    return execAllowFailure(command, args, cwd, options);
  }

  return execAllowFailure(scriptPath, ["-qefc", formatCommand(command, args), "/dev/null"], cwd, options);
}

function formatCommand(command, args) {
  return [command, ...args].map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(content, expected) {
  const normalizedContent = String(content).replaceAll("\r\n", "\n");
  const normalizedExpected = String(expected).replaceAll("\r\n", "\n");
  assert(normalizedContent.includes(normalizedExpected), `Expected output to include: ${expected}\nActual output:\n${content}`);
}

function assertExcludes(content, unexpected) {
  assert(!content.includes(unexpected), `Expected output to exclude: ${unexpected}\nActual output:\n${content}`);
}
