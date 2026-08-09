import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initCommand } from "./init.js";

async function withTempProject(testContext, callback) {
  const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "marionettist-init-test-"));
  testContext.after(async () => {
    await fs.rm(projectPath, { recursive: true, force: true });
  });
  await callback(projectPath);
}

function buildStubPlan() {
  return { operations: [] };
}

test("initCommand keeps --auto prompt-free and without marionettist language selection", async (t) => {
  await withTempProject(t, async (projectPath) => {
    let promptCalled = false;
    const buildPlanCalls = [];

    await initCommand(["--project", projectPath, "--auto", "--dry-run"], {
      promptConfig: async () => {
        promptCalled = true;
        throw new Error("promptConfig should not be called for --auto");
      },
      buildPlan: async (_projectPath, _mode, options) => {
        buildPlanCalls.push(options);
        return buildStubPlan();
      },
      printPlan: () => {},
      applyPlan: async () => {},
      log: () => {},
    });

    assert.equal(promptCalled, false);
    assert.equal(buildPlanCalls.length, 2);
    assert.equal(buildPlanCalls[0].variables.marionettistLanguage, undefined);
    assert.equal(buildPlanCalls[1].variables.marionettistLanguage, undefined);
  });
});

test("initCommand suppresses new language selection when marionettist.language already exists", async (t) => {
  await withTempProject(t, async (projectPath) => {
    await fs.writeFile(path.join(projectPath, "marionettist.config.yaml"), [
      "marionettist:",
      '  language: "zh-CN"',
      "docs:",
      '  language: "en"',
      ""
    ].join("\n"), "utf8");

    const logs = [];
    const buildPlanCalls = [];

    await initCommand(["--project", projectPath, "--dry-run"], {
      promptConfig: async (_defaultProjectName, options) => {
        assert.equal(options.skipMarionettistLanguagePrompt, true);
        assert.equal(options.marionettistLanguage, "zh-CN");
        return {
          projectName: "demo",
          projectType: "node",
          architecture: "monolith",
          primaryLanguage: "javascript",
          knowledgeMode: "standard",
          knowledgeMaturity: "L1",
          marionettistLanguage: "zh-CN",
          marionettistLanguageWasSelected: false
        };
      },
      promptWithOpencode: async () => false,
      promptDistributionMode: async () => "embedded",
      buildPlan: async (_projectPath, _mode, options) => {
        buildPlanCalls.push(options);
        return buildStubPlan();
      },
      printPlan: () => {},
      applyPlan: async () => {},
      log: (message) => logs.push(message),
    });

    assert.equal(buildPlanCalls[0].variables.marionettistLanguage, undefined);
    assert.equal(buildPlanCalls[1].variables.marionettistLanguage, undefined);
    assert.equal(logs.some((message) => message.includes("Marionettist will use") || message.includes("Marionettist 将使用中文")), false);
  });
});

test("initCommand prints guide text only after a new marionettist language selection", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const logs = [];
    const buildPlanCalls = [];

    await initCommand(["--project", projectPath, "--dry-run"], {
      promptConfig: async (_defaultProjectName, options) => {
        assert.equal(options.skipMarionettistLanguagePrompt, false);
        return {
          projectName: "demo",
          projectType: "node",
          architecture: "monolith",
          primaryLanguage: "javascript",
          knowledgeMode: "standard",
          knowledgeMaturity: "L1",
          marionettistLanguage: "en",
          marionettistLanguageWasSelected: true
        };
      },
      promptWithOpencode: async () => false,
      promptDistributionMode: async () => "embedded",
      buildPlan: async (_projectPath, _mode, options) => {
        buildPlanCalls.push(options);
        return buildStubPlan();
      },
      printPlan: () => {},
      applyPlan: async () => {},
      log: (message) => logs.push(message),
    });

    assert.equal(buildPlanCalls[0].variables.marionettistLanguage, "en");
    assert.equal(buildPlanCalls[1].variables.marionettistLanguage, "en");
    assert.deepEqual(logs, ["Marionettist will use English for Marionettist CLI guidance and agent replies."]);
  });
});

test("initCommand reconciles the Pi package only when --with-pi is selected", async (t) => {
  await withTempProject(t, async (projectPath) => {
    const calls = [];
    const logs = [];
    await initCommand(["--project", projectPath, "--auto", "--dry-run", "--with-pi"], {
      buildPlan: async () => buildStubPlan(),
      printPlan: () => {},
      applyPlan: async () => {},
      ensurePiProjectPackage: async (project, options) => {
        calls.push({ project, options });
        return { command: "pi install -l npm:marionettist-pathway-pi" };
      },
      log: (message) => logs.push(message)
    });
    assert.deepEqual(calls, [{ project: projectPath, options: { dryRun: true } }]);
    assert(logs.includes("would run: pi install -l npm:marionettist-pathway-pi"));
  });
});
