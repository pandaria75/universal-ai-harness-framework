import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { piPackageSource, readPiProjectInstall } from "./pi-package.js";

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
