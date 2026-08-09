import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { piPackageSource, readPiProjectInstall, syncPiSubagentModelOverrides } from "./pi-package.js";

test("readPiProjectInstall recognizes project-local npm package entries", async () => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "marionettist-pi-package-"));
  try {
    await fs.mkdir(path.join(project, ".pi"), { recursive: true });
    await fs.writeFile(path.join(project, ".pi", "settings.json"), JSON.stringify({
      packages: ["npm:another-package", piPackageSource]
    }), "utf8");
    const state = await readPiProjectInstall(project);
    assert.equal(state.installed, true);
    assert.equal(state.parseError, null);
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});
test("readPiProjectInstall reports malformed settings without treating them as installed", async () => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "marionettist-pi-package-"));
  try {
    await fs.mkdir(path.join(project, ".pi"), { recursive: true });
    await fs.writeFile(path.join(project, ".pi", "settings.json"), "{", "utf8");
    const state = await readPiProjectInstall(project);
    assert.equal(state.installed, false);
    assert(state.parseError instanceof Error);
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test("syncPiSubagentModelOverrides preserves project settings and maps shared profiles to Pi agents", async () => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), "marionettist-pi-package-"));
  try {
    await fs.mkdir(path.join(project, ".pi"), { recursive: true });
    await fs.mkdir(path.join(project, ".marionettist"), { recursive: true });
    await fs.writeFile(path.join(project, ".pi", "settings.json"), JSON.stringify({
      packages: [piPackageSource],
      subagents: {
        agentOverrides: {
          "marionettist-coder": { thinking: "high" }
        }
      }
    }), "utf8");
    await fs.writeFile(path.join(project, ".marionettist", "model-profiles.yml"), [
      "profiles:",
      "  think:",
      "    default: \"test/think\"",
      "  build:",
      "    default: \"test/build\"",
      "  review:",
      "    default: \"test/review\"",
      "  run:",
      "    default: \"test/run\"",
      ""
    ].join("\n"), "utf8");

    await syncPiSubagentModelOverrides(project);
    const settings = JSON.parse(await fs.readFile(path.join(project, ".pi", "settings.json"), "utf8"));
    assert.deepEqual(settings.packages, [piPackageSource]);
    assert.deepEqual(settings.subagents.agentOverrides["marionettist-coder"], {
      thinking: "high",
      model: "test/build"
    });
    assert.equal(settings.subagents.agentOverrides["marionettist-indexer"].model, "test/run");
    assert.equal(settings.subagents.agentOverrides["marionettist-reviewer"].model, "test/review");
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});
