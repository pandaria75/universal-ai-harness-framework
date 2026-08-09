import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildPlan } from "./plan.js";

const rawProjectIdentityPlaceholderPattern = /\{\{PROJECT_NAME\}\}|\{\{PROJECT_TYPE\}\}|\{\{ARCHITECTURE\}\}|\{\{PRIMARY_LANGUAGE\}\}/;

function buildPlanOptions(overrides = {}) {
  return {
    project: overrides.project,
    auto: true,
    dryRun: true,
    force: false,
    variables: {
      projectName: "Smoke Project",
      projectType: "node",
      architecture: "monolith",
      primaryLanguage: "javascript",
      ...(overrides.variables ?? {})
    },
    withOpencode: false,
    conflictStrategies: {},
    ...overrides
  };
}

async function withTempProject(testContext, callback) {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "harness-plan-test-"));
  testContext.after(async () => {
    await fs.rm(projectPath, { recursive: true, force: true });
  });
  await callback(projectPath);
}

async function applyManagedOperations(plan) {
  for (const operation of plan.operations) {
    if (operation.type === "directory") {
      await fs.mkdir(operation.targetPath, { recursive: true });
      continue;
    }

    if (typeof operation.content !== "string") {
      continue;
    }

    if (operation.status === "modified-local" || operation.status === "conflict" || operation.status === "orphan-managed") {
      continue;
    }

    await fs.mkdir(path.dirname(operation.targetPath), { recursive: true });
    await fs.writeFile(operation.targetPath, operation.content, "utf8");
  }
}

test("buildPlan rerenders OpenCode agents when only model profile config changes", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const initPlan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath, withOpencode: true, opencodePluginSource: "local" }));
    await applyManagedOperations(initPlan);

    const initialBuilderOperation = initPlan.operations.find((operation) => operation.targetRelative === ".opencode/agents/marionettist-builder.md");
    const initialBuilderRecord = initPlan.manifest.managedFiles.find((file) => file.path === ".opencode/agents/marionettist-builder.md");
    assert(initialBuilderOperation, "expected initial OpenCode builder operation");
    assert(initialBuilderRecord, "expected initial OpenCode builder manifest record");

    const profilesPath = path.join(projectPath, ".marionettist", "model-profiles.yml");
    const originalProfiles = await fs.readFile(profilesPath, "utf8");
    await fs.writeFile(
      profilesPath,
      originalProfiles.replace(/default: "[^"]+"/, 'default: "config-only-rerender-think"'),
      "utf8"
    );

    const syncPlan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, withOpencode: true, opencodePluginSource: "local" }));
    const builderSyncOperation = syncPlan.operations.find((operation) => operation.targetRelative === ".opencode/agents/marionettist-builder.md");
    assert(builderSyncOperation, "expected sync plan OpenCode builder operation");
    assert.equal(builderSyncOperation.status, "update");
    assert(builderSyncOperation.content.includes("model: config-only-rerender-think"), "expected config-only model profile change to rerender builder model");
    assert.equal(builderSyncOperation.templateHash, initialBuilderRecord.templateHash, "expected config-only change to preserve templateHash");
    assert.notEqual(builderSyncOperation.renderInputHash, initialBuilderRecord.renderInputHash, "expected config-only change to alter renderInputHash");
    assert.notEqual(builderSyncOperation.renderedHash, initialBuilderOperation.renderedHash, "expected config-only change to alter renderedHash");
  });
});

test("buildPlan records pathway OpenCode sources for local fallback assets", async (t) => {
    const futureSource = path.join(process.cwd(), "templates", "pathways", "opencode", "commands", "slice-38-2-plan-source.md");

  t.after(async () => {
     await fs.rm(futureSource, { force: true });
   });

  await fs.mkdir(path.dirname(futureSource), { recursive: true });
  await fs.writeFile(futureSource, "future command", "utf8");

  await withTempProject(t, async (projectPath) => {
    const plan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath, withOpencode: true, opencodeCommandSurface: "advanced", opencodePluginSource: "local" }));
    const operation = plan.operations.find((entry) => entry.targetRelative === ".opencode/commands/slice-38-2-plan-source.md");
    assert(operation, "expected pathway command to be planned");
    assert.equal(operation.sourceRelative, "templates/pathways/opencode/commands/slice-38-2-plan-source.md");
    assert.equal(operation.content, "future command");
  });
});

test("buildPlan preserves user-owned OpenCode files during init", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const localCommandPath = path.join(projectPath, ".opencode", "commands", "marionettist.md");
    const localConfigPath = path.join(projectPath, "opencode.jsonc");

    await fs.mkdir(path.dirname(localCommandPath), { recursive: true });
    await fs.writeFile(localCommandPath, "local command", "utf8");
    await fs.writeFile(localConfigPath, "{\n  // local config\n}\n", "utf8");

    const plan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath, withOpencode: true, opencodeCommandSurface: "advanced", opencodePluginSource: "local" }));
    const commandOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/commands/marionettist.md");
    const configOperation = plan.operations.find((operation) => operation.targetRelative === "opencode.jsonc");

    assert(commandOperation, "expected OpenCode command operation");
    assert.equal(commandOperation.status, "skip-project-local");
    assert.equal(commandOperation.managed, false);

    assert(configOperation, "expected OpenCode config operation");
    assert.equal(configOperation.status, "skip-project-local");
    assert.equal(configOperation.managed, false);
  });
});

test("buildPlan preserves user-owned OpenCode files during sync when they are not manifest-managed", async (t) => {
  await withTempProject(t, async (projectPath) => {
    await fs.mkdir(path.join(projectPath, ".marionettist"), { recursive: true });
    await fs.writeFile(path.join(projectPath, ".marionettist", "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      frameworkVersion: "0.0.0-test",
      distributionMode: "embedded",
      installedAt: "2026-06-15T00:00:00.000Z",
      updatedAt: "2026-06-15T00:00:00.000Z",
      managedFiles: [{
        path: "AGENTS.md",
        source: "templates/AGENTS.md",
        kind: "managed-block",
        hash: "managed-agents-hash"
      }]
    }, null, 2)}\n`, "utf8");

    const localCommandPath = path.join(projectPath, ".opencode", "commands", "marionettist.md");
    const localConfigPath = path.join(projectPath, "opencode.jsonc");
    await fs.mkdir(path.dirname(localCommandPath), { recursive: true });
    await fs.writeFile(localCommandPath, "local command", "utf8");
    await fs.writeFile(localConfigPath, "{\n  // local config\n}\n", "utf8");

    const plan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, withOpencode: true, opencodeCommandSurface: "advanced", opencodePluginSource: "local" }));
    const commandOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/commands/marionettist.md");
    const configOperation = plan.operations.find((operation) => operation.targetRelative === "opencode.jsonc");

    assert(commandOperation, "expected OpenCode command operation");
    assert.equal(commandOperation.status, "skip-project-local");
    assert.equal(commandOperation.managed, false);

    assert(configOperation, "expected OpenCode config operation");
    assert.equal(configOperation.status, "skip-project-local");
    assert.equal(configOperation.managed, false);
  });
});

test("buildPlan rerenders OpenCode agents when resolved agent override values change in config only", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const initPlan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath, withOpencode: true, opencodePluginSource: "local" }));
    await applyManagedOperations(initPlan);

    const initialBuilderRecord = initPlan.manifest.managedFiles.find((file) => file.path === ".opencode/agents/marionettist-builder.md");
    assert(initialBuilderRecord, "expected initial OpenCode builder manifest record");

    const initialReviewerContent = await fs.readFile(path.join(projectPath, ".opencode", "agents", "marionettist-reviewer.md"), "utf8");

    const profilesPath = path.join(projectPath, ".marionettist", "model-profiles.yml");
    await fs.writeFile(profilesPath, [
      "profiles:",
      "  think:",
      "    description: \"Deep reasoning, planning, and gate decisions\"",
      "    default: \"openai/gpt-5.5\"",
      "    temperature: 0.1",
      "    agentOverrides:",
      "      harness-builder:",
      "        model: \"override/builder\"",
      "        temperature: 0.7",
      "  build:",
      "    description: \"Focused coding and implementation from approved task context\"",
      "    default: \"openai/gpt-5.4\"",
      "    temperature: 0.1",
      "  review:",
      "    description: \"Reflective, cautious, nuanced review\"",
      "    default: \"deepseek/deepseek-v4-pro\"",
      "    temperature: 0",
      "  run:",
      "    description: \"Fast utility work such as indexing and validation\"",
      "    default: \"deepseek/deepseek-v4-flash\"",
      "    temperature: 0",
      "",
    ].join("\n"), "utf8");

    const syncPlan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, withOpencode: true, opencodePluginSource: "local" }));
    const builderSyncOperation = syncPlan.operations.find((operation) => operation.targetRelative === ".opencode/agents/marionettist-builder.md");
    const reviewerSyncOperation = syncPlan.operations.find((operation) => operation.targetRelative === ".opencode/agents/marionettist-reviewer.md");
    assert(builderSyncOperation, "expected sync plan OpenCode builder operation");
    assert(reviewerSyncOperation, "expected sync plan OpenCode reviewer operation");

    assert.equal(builderSyncOperation.status, "update");
    assert(builderSyncOperation.content.includes("model: override/builder"), "expected builder override model to rerender");
    assert(builderSyncOperation.content.includes("temperature: 0.7"), "expected builder override temperature to rerender");
    assert.equal(builderSyncOperation.templateHash, initialBuilderRecord.templateHash, "expected config-only builder change to preserve templateHash");
    assert.notEqual(builderSyncOperation.renderInputHash, initialBuilderRecord.renderInputHash, "expected builder renderInputHash to change when resolved variables change");

    assert.equal(reviewerSyncOperation.status, "unchanged");
    assert.equal(reviewerSyncOperation.content, initialReviewerContent, "expected unrelated agent rendered content to remain stable");
  });
});

test("buildPlan tracks plugin-first OpenCode config render metadata through the shared model-profile seam", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const initPlan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath, withOpencode: true }));
    await applyManagedOperations(initPlan);

    const initialConfigOperation = initPlan.operations.find((operation) => operation.targetRelative === "opencode.jsonc");
    const initialConfigRecord = initPlan.manifest.managedFiles.find((file) => file.path === "opencode.jsonc");
    assert(initialConfigOperation, "expected initial OpenCode config operation");
    assert(initialConfigRecord, "expected initial OpenCode config manifest record");
    assert.equal(initialConfigOperation.content.trim(), '{\n  "$schema": "https://opencode.ai/config.json",\n  // Auto-enabled by marionettist --with-opencode so repositories can install a\n  // local OpenCode pathway plugin prototype without requiring global user config.\n  "plugin": ["marionettist-pathway-opencode"]\n}');

    const profilesPath = path.join(projectPath, ".marionettist", "model-profiles.yml");
    const originalProfiles = await fs.readFile(profilesPath, "utf8");
    await fs.writeFile(
      profilesPath,
      originalProfiles.replace(/default: "[^"]+"/, 'default: "config-only-opencode-config-think"'),
      "utf8"
    );

    const syncPlan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, withOpencode: true }));
    const configOperation = syncPlan.operations.find((operation) => operation.targetRelative === "opencode.jsonc");
    const configRecord = syncPlan.manifest.managedFiles.find((file) => file.path === "opencode.jsonc");
    assert(configOperation, "expected sync OpenCode config operation");
    assert(configRecord, "expected sync OpenCode config manifest record");

    assert.equal(configOperation.status, "unchanged");
    assert.equal(configOperation.content, initialConfigOperation.content);
    assert.equal(configOperation.templateHash, initialConfigRecord.templateHash);
    assert.notEqual(configOperation.renderInputHash, initialConfigRecord.renderInputHash);
    assert.notEqual(configRecord.renderInputHash, initialConfigRecord.renderInputHash);
  });
});

test("buildPlan defaults to package-based OpenCode plugin planning for new installs", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const plan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath, withOpencode: true }));

    const configOperation = plan.operations.find((operation) => operation.targetRelative === "opencode.jsonc");
    const pluginOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/plugin/opencode-tasks.js");
    const agentAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway/agents/marionettist-pathway-prototype.md");
    const commandAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway/commands/marionettist-pathway-prototype.md");
    const configCommandAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway/commands/marionettist-pathway-config.md");
    const skillAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway-skills/marionettist-pathway-prototype/SKILL.md");
    const configSkillAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway-skills/marionettist-pathway-config/SKILL.md");
    const fallbackCommandOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/commands/marionettist.md");

    assert(configOperation, "expected OpenCode config operation");
    assert.equal(plan.opencodePluginSourceState.pluginSource, "package");
    assert.equal(plan.manifest.opencodePluginSource, "package");
    assert.match(configOperation.content, /"plugin": \["marionettist-pathway-opencode"\]/);
    assert.equal(pluginOperation, undefined);
    assert.equal(agentAssetOperation, undefined);
    assert.equal(commandAssetOperation, undefined);
    assert.equal(configCommandAssetOperation, undefined);
    assert.equal(skillAssetOperation, undefined);
    assert.equal(configSkillAssetOperation, undefined);
    assert.equal(fallbackCommandOperation, undefined);
  });
});

test("buildPlan preserves repository-local OpenCode fallback planning when pluginSource is local", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const plan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath, withOpencode: true, opencodePluginSource: "local" }));

    const configOperation = plan.operations.find((operation) => operation.targetRelative === "opencode.jsonc");
    const pluginOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/plugin/opencode-tasks.js");
    const agentAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway/agents/marionettist-pathway-prototype.md");
    const commandAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway/commands/marionettist-pathway-prototype.md");
    const configCommandAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway/commands/marionettist-pathway-config.md");
    const skillAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway-skills/marionettist-pathway-prototype/SKILL.md");
    const configSkillAssetOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/pathway-skills/marionettist-pathway-config/SKILL.md");
    const fallbackCommandOperation = plan.operations.find((operation) => operation.targetRelative === ".opencode/commands/marionettist.md");

    assert(configOperation, "expected OpenCode config operation");
    assert(pluginOperation, "expected local plugin operation");
    assert(agentAssetOperation, "expected prototype agent asset operation");
    assert(commandAssetOperation, "expected prototype command asset operation");
    assert(configCommandAssetOperation, "expected pathway config command asset operation");
    assert(skillAssetOperation, "expected prototype skill asset operation");
    assert(configSkillAssetOperation, "expected pathway config skill asset operation");
    assert(fallbackCommandOperation, "expected fallback harness command operation");

    assert.equal(plan.opencodePluginSourceState.pluginSource, "local");
    assert.equal(plan.manifest.opencodePluginSource, "local");
    assert.equal(pluginOperation.sourceRelative, "templates/pathways/opencode/plugin/opencode-tasks.js");
    assert.equal(agentAssetOperation.sourceRelative, "templates/pathways/opencode/pathway/agents/marionettist-pathway-prototype.md");
    assert.equal(commandAssetOperation.sourceRelative, "templates/pathways/opencode/pathway/commands/marionettist-pathway-prototype.md");
    assert.equal(configCommandAssetOperation.sourceRelative, "templates/pathways/opencode/pathway/commands/marionettist-pathway-config.md");
    assert.equal(skillAssetOperation.sourceRelative, "templates/pathways/opencode/pathway-skills/marionettist-pathway-prototype/SKILL.md");
    assert.equal(configSkillAssetOperation.sourceRelative, "templates/pathways/opencode/pathway-skills/marionettist-pathway-config/SKILL.md");
    assert.equal(fallbackCommandOperation.sourceRelative, "templates/pathways/opencode/commands/marionettist.md");
    assert.match(configOperation.content, /"plugin": \["\.\/\.opencode\/plugin\/opencode-tasks\.js"\]/);

    await applyManagedOperations(plan);

    const syncPlan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, withOpencode: true }));
    const syncConfigCommandAssetOperation = syncPlan.operations.find((operation) => operation.targetRelative === ".opencode/pathway/commands/marionettist-pathway-config.md");
    const syncConfigSkillAssetOperation = syncPlan.operations.find((operation) => operation.targetRelative === ".opencode/pathway-skills/marionettist-pathway-config/SKILL.md");
    assert.equal(syncPlan.opencodePluginSourceState.pluginSource, "local");
    assert(syncConfigCommandAssetOperation, "expected sync plan pathway config command asset operation");
    assert(syncConfigSkillAssetOperation, "expected sync plan pathway config skill asset operation");
    assert.equal(syncConfigCommandAssetOperation.status, "unchanged");
    assert.equal(syncConfigSkillAssetOperation.status, "unchanged");

    const pluginModule = await import(`${pathToFileURL(path.join(projectPath, ".opencode", "plugin", "opencode-tasks.js")).href}?test=${Date.now()}`);
    const hooks = await pluginModule.default();
    const cfg = {
      skills: {
        paths: ["custom-skills"]
      }
    };

    hooks.config(cfg);

    assert.equal(cfg.agent["marionettist-pathway-prototype"].mode, "subagent");
    assert.match(cfg.agent["marionettist-pathway-prototype"].prompt, /repository-local OpenCode pathway prototype agent/i);
    assert.match(cfg.command["marionettist-pathway-prototype"].template, /Run a bounded inspection of the repository-local OpenCode pathway prototype/i);
    assert.match(cfg.command["marionettist-pathway-config"].template, /Pathway MVP configuration/i);
    assert.deepEqual(cfg.skills.paths, ["custom-skills", ".opencode/pathway-skills"]);
  });
});

test("buildPlan infers legacy local fallback planning from existing managed OpenCode assets", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const initPlan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath, withOpencode: true, opencodePluginSource: "local" }));
    await applyManagedOperations(initPlan);

    const manifestPath = path.join(projectPath, ".marionettist", "manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    delete manifest.opencodePluginSource;
    for (const file of manifest.managedFiles) {
      delete file.pluginSource;
    }
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const configPath = path.join(projectPath, "marionettist.config.yaml");
    const configContent = await fs.readFile(configPath, "utf8");
    await fs.writeFile(configPath, configContent.replace(/\n  pluginSource: "local"\n?/u, "\n"), "utf8");

    const syncPlan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, withOpencode: true }));
    const configOperation = syncPlan.operations.find((operation) => operation.targetRelative === "opencode.jsonc");
    const pluginOperation = syncPlan.operations.find((operation) => operation.targetRelative === ".opencode/plugin/opencode-tasks.js");

    assert.equal(syncPlan.opencodePluginSourceState.pluginSource, "local");
    assert.equal(syncPlan.opencodePluginSourceState.pluginSourceSource, "existing-managed-assets");
    assert(configOperation, "expected OpenCode config operation");
    assert(pluginOperation, "expected local plugin operation");
    assert.match(configOperation.content, /"plugin": \["\.\/\.opencode\/plugin\/opencode-tasks\.js"\]/);
  });
});

test("buildPlan renders marionettist.config.yaml from persisted plan selections", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const plan = await buildPlan(projectPath, "init", buildPlanOptions({
      project: projectPath,
      variables: {
        projectName: "Smoke Project",
        projectType: "node",
        architecture: "monolith",
        primaryLanguage: "javascript",
        marionettistLanguage: "en"
      },
      withOpencode: true,
      distributionMode: "adapter",
      opencodeCommandSurface: "standard",
      opencodePermissionMode: "moderate"
    }));

    const configOperation = plan.operations.find((operation) => operation.targetRelative === "marionettist.config.yaml");
    assert(configOperation, "expected marionettist.config.yaml operation");
    assert.match(configOperation.content, /taskState:\n  activeTask: "\.task\/active\.json"\n  taskDirectoryPattern: "\.task\/<yyyy-MM-dd>\/<task-slug>"\n  legacyContextPackFallback: "\.task\/context-pack\.md"\n\nmarionettist:\n  language: "en"\n\nmodels:/);
    assert(configOperation.content.includes('marionettist:\n  language: "en"'));
    assert.equal(configOperation.content.split('marionettist:\n  language: "en"').length - 1, 1);
    assert(configOperation.content.includes('distribution:\n  mode: "adapter"'));
    assert(configOperation.content.includes('opencode:\n  commandSurface: "standard"\n  permissionMode: "moderate"\n  pluginSource: "package"'));
    assert(configOperation.content.includes('docs:\n  language: "zh-CN"'));
    assert(typeof configOperation.renderInputHash === "string" && configOperation.renderInputHash.length > 0, "expected marionettist.config.yaml renderInputHash metadata");
  });
});

test("buildPlan preserves configured marionettist.language separately from docs.language", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const initPlan = await buildPlan(projectPath, "init", buildPlanOptions({
      project: projectPath,
      variables: {
        projectName: "Kept Project",
        projectType: "library",
        architecture: "modular",
        primaryLanguage: "typescript",
        marionettistLanguage: "zh-CN"
      }
    }));
    await applyManagedOperations(initPlan);

    const configPath = path.join(projectPath, "marionettist.config.yaml");
    const configContent = await fs.readFile(configPath, "utf8");
    await fs.writeFile(configPath, configContent.replace('docs:\n  language: "zh-CN"', 'docs:\n  language: "en"'), "utf8");

    const plan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, variables: undefined }));
    const configOperation = plan.operations.find((operation) => operation.targetRelative === "marionettist.config.yaml");
    assert(configOperation, "expected marionettist.config.yaml sync operation");
    assert.equal(configOperation.status, "modified-local");
    assert(configOperation.content.includes('marionettist:\n  language: "zh-CN"'));
    assert(configOperation.content.includes('docs:\n  language: "zh-CN"'));
    assert(!configOperation.content.includes('marionettist:\n  language: "en"'));
  });
});

test("buildPlan omits marionettist language block when no language is selected or preserved", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const plan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath }));
    const configOperation = plan.operations.find((operation) => operation.targetRelative === "marionettist.config.yaml");
    assert(configOperation, "expected marionettist.config.yaml operation");
    assert(!configOperation.content.includes("__MARIONETTIST_LANGUAGE_BLOCK__"));
    assert(!configOperation.content.includes("marionettist:\n  language:"));
    assert.match(configOperation.content, /taskState:\n  activeTask: "\.task\/active\.json"\n  taskDirectoryPattern: "\.task\/<yyyy-MM-dd>\/<task-slug>"\n  legacyContextPackFallback: "\.task\/context-pack\.md"\n\nmodels:/);
    assert(configOperation.content.includes('docs:\n  language: "zh-CN"'));
  });
});

test("buildPlan includes distribution mode in OpenCode config render metadata", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const embeddedPlan = await buildPlan(projectPath, "init", buildPlanOptions({
      project: projectPath,
      withOpencode: true,
      distributionMode: "embedded"
    }));
    const adapterPlan = await buildPlan(projectPath, "init", buildPlanOptions({
      project: projectPath,
      withOpencode: true,
      distributionMode: "adapter"
    }));

    const embeddedConfigOperation = embeddedPlan.operations.find((operation) => operation.targetRelative === "opencode.jsonc");
    const adapterConfigOperation = adapterPlan.operations.find((operation) => operation.targetRelative === "opencode.jsonc");
    assert(embeddedConfigOperation, "expected embedded OpenCode config operation");
    assert(adapterConfigOperation, "expected adapter OpenCode config operation");
    assert.equal(adapterConfigOperation.content, embeddedConfigOperation.content);
    assert.notEqual(adapterConfigOperation.renderInputHash, embeddedConfigOperation.renderInputHash);
  });
});

test("buildPlan renders canonical model profiles to .marionettist/model-profiles.yml", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const plan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath }));
    const modelProfilesOperation = plan.operations.find((operation) => operation.targetRelative === ".marionettist/model-profiles.yml");
    assert(modelProfilesOperation, "expected canonical model profiles operation");
    assert.equal(modelProfilesOperation.sourceRelative, "templates/.marionettist/model-profiles.yml");
    assert(modelProfilesOperation.content.includes('  think:\n    description: '), "expected canonical model profile content");
    assert(modelProfilesOperation.content.includes('    temperature: 0.1'));
    assert(!modelProfilesOperation.content.includes("{{MODEL_PROFILE_"), "expected legacy model profile render to finalize to concrete content");
  });
});

test("buildPlan does not import legacy harness.config selections into marionettist.config.yaml", async (t) => {
  await withTempProject(t, async (projectPath) => {
    await fs.writeFile(path.join(projectPath, "harness.config.yaml"), [
      'distribution:',
      '  mode: "adapter"',
      'opencode:',
      '  commandSurface: "standard"',
      '  permissionMode: "moderate"',
      ''
    ].join("\n"), "utf8");

    const plan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath }));
    const configOperation = plan.operations.find((operation) => operation.targetRelative === "marionettist.config.yaml");
    assert(configOperation, "expected marionettist.config.yaml operation");
    assert(!configOperation.content.includes('distribution:\n  mode: "adapter"'));
    assert(!configOperation.content.includes('commandSurface: "standard"'));
    assert(!configOperation.content.includes('permissionMode: "moderate"'));
  });
});

test("buildPlan preserves rendered project identity during sync when variables are omitted", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const initPlan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath }));
    await applyManagedOperations(initPlan);

    const initialConfigContent = await fs.readFile(path.join(projectPath, "marionettist.config.yaml"), "utf8");
    assert(!rawProjectIdentityPlaceholderPattern.test(initialConfigContent), "expected init to render project identity placeholders");

    const syncPlan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, variables: undefined }));
    const configOperation = syncPlan.operations.find((operation) => operation.targetRelative === "marionettist.config.yaml");
    assert(configOperation, "expected marionettist.config.yaml sync operation");
    assert.equal(configOperation.status, "unchanged");
    assert.equal(configOperation.content, initialConfigContent);
    assert(!rawProjectIdentityPlaceholderPattern.test(configOperation.content), "expected sync preservation path to avoid raw identity placeholders");
  });
});

test("buildPlan prefers explicit project identity variables over config-derived values during sync", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const initPlan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath }));
    await applyManagedOperations(initPlan);

    const syncPlan = await buildPlan(projectPath, "sync", buildPlanOptions({
      project: projectPath,
      variables: {
        projectName: "Explicit Project",
        projectType: "library",
        architecture: "modular",
        primaryLanguage: "typescript"
      }
    }));
    const configOperation = syncPlan.operations.find((operation) => operation.targetRelative === "marionettist.config.yaml");
    assert(configOperation, "expected marionettist.config.yaml sync operation");
    assert.equal(configOperation.status, "update");
    assert(configOperation.content.includes('name: "Explicit Project"'));
    assert(configOperation.content.includes('type: "library"'));
    assert(configOperation.content.includes('architecture: "modular"'));
    assert(configOperation.content.includes('primaryLanguage: "typescript"'));
    assert(!configOperation.content.includes('name: "Smoke Project"'));
  });
});

test("buildPlan skips malformed project identity values from config during sync", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const initPlan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath }));
    await applyManagedOperations(initPlan);

    await fs.writeFile(path.join(projectPath, "marionettist.config.yaml"), [
      "project:",
      "  name:",
      "    nested: \"not-a-string\"",
      "  type: true",
      "  architecture: \"   \"",
      ""
    ].join("\n"), "utf8");

    const syncPlan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, variables: undefined }));
    const configOperation = syncPlan.operations.find((operation) => operation.targetRelative === "marionettist.config.yaml");
    assert(configOperation, "expected marionettist.config.yaml sync operation");
    assert.equal(configOperation.status, "conflict");
    assert(configOperation.content.includes('name: "{{PROJECT_NAME}}"'));
    assert(configOperation.content.includes('type: "{{PROJECT_TYPE}}"'));
    assert(configOperation.content.includes('architecture: "{{ARCHITECTURE}}"'));
    assert(configOperation.content.includes('primaryLanguage: "{{PRIMARY_LANGUAGE}}"'));
    assert(!configOperation.content.includes('[object Object]'));
    assert(!configOperation.content.includes('type: "true"'));
  });
});

test("buildPlan preserves valid config-derived identity fields while skipping invalid ones during sync", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const initPlan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath }));
    await applyManagedOperations(initPlan);

    await fs.writeFile(path.join(projectPath, "marionettist.config.yaml"), [
      "project:",
      '  name: "Kept Project"',
      "  type:",
      '    nested: "not-a-string"',
      '  architecture: "modular"',
      '  primaryLanguage: "   "',
      ""
    ].join("\n"), "utf8");

    const syncPlan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath, variables: undefined }));
    const configOperation = syncPlan.operations.find((operation) => operation.targetRelative === "marionettist.config.yaml");
    assert(configOperation, "expected marionettist.config.yaml sync operation");
    assert.equal(configOperation.status, "conflict");
    assert(configOperation.content.includes('name: "Kept Project"'));
    assert(configOperation.content.includes('architecture: "modular"'));
    assert(configOperation.content.includes('type: "{{PROJECT_TYPE}}"'));
    assert(configOperation.content.includes('primaryLanguage: "{{PRIMARY_LANGUAGE}}"'));
    assert(!configOperation.content.includes('[object Object]'));
    assert(!configOperation.content.includes('type: "false"'));
    assert(!configOperation.content.includes('primaryLanguage: "   "'));
  });
});

test("buildPlan includes tier policy workflow design doc in core template targets", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const plan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath }));
    const operation = plan.operations.find((entry) => entry.targetRelative === "docs/project/tier-policy-workflow-design.md");

    assert(operation, "expected tier policy workflow design doc operation");
    assert.equal(operation.sourceRelative, "templates/docs/project/tier-policy-workflow-design.md");
    assert.equal(operation.status, "new-managed");
  });
});

test("buildPlan preserves orphan render metadata for removed managed records", async (t) => {
  await withTempProject(t, async (projectPath) => {
    await fs.mkdir(path.join(projectPath, ".marionettist"), { recursive: true });
    await fs.writeFile(path.join(projectPath, ".marionettist", "manifest.json"), `${JSON.stringify({
      schemaVersion: 1,
      frameworkVersion: "0.0.0-test",
      installedAt: "2026-06-15T00:00:00.000Z",
      updatedAt: "2026-06-15T00:00:00.000Z",
      managedFiles: [{
        path: "removed.txt",
        source: "templates/removed.txt",
        kind: "file",
        hash: "managed-compatibility-hash",
        renderedHash: "rendered-file-hash",
        templateHash: "template-hash",
        renderInputHash: "render-input-hash"
      }]
    }, null, 2)}\n`, "utf8");

    const plan = await buildPlan(projectPath, "sync", buildPlanOptions({ project: projectPath }));
    const orphanOperation = plan.operations.find((operation) => operation.targetRelative === "removed.txt");
    assert(orphanOperation, "expected orphan operation for removed managed record");
    assert.equal(orphanOperation.status, "orphan-managed");
    assert.equal(orphanOperation.previousHash, "managed-compatibility-hash");
    assert.equal(orphanOperation.frameworkHash, "managed-compatibility-hash");
    assert.equal(orphanOperation.renderedHash, "rendered-file-hash");
    assert.equal(orphanOperation.templateHash, "template-hash");
    assert.equal(orphanOperation.renderInputHash, "render-input-hash");
  });
});

test("buildPlan installs marionettist workflow doc from renamed template path", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const plan = await buildPlan(projectPath, "init", buildPlanOptions({ project: projectPath }));
    const operation = plan.operations.find((entry) => entry.targetRelative === "docs/project/marionettist-workflow.md");

    assert(operation, "expected marionettist workflow doc operation");
    assert.equal(operation.sourceRelative, "templates/docs/project/marionettist-workflow.md");
    assert.equal(operation.status, "new-managed");
  });
});
