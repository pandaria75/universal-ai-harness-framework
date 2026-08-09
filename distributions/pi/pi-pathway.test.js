import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const roles = ["builder", "planner", "coder", "reviewer", "critic", "indexer", "validator"];

test("Pi package exposes only its guarded extension statically", async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.name, "marionettist-pathway-pi");
  assert.deepEqual(pkg.pi, { extensions: ["./extension/index.ts"] });
  assert.equal(pkg.pi.skills, undefined);
  assert.equal(pkg.pi.prompts, undefined);
});
test("Pi distribution contains seven roles, workflows, and shared skills", async () => {
  for (const role of roles) {
    const content = await fs.readFile(path.join(root, "resources", "agents", `marionettist-${role}.md`), "utf8");
    assert.match(content, /description:/u);
  }
  const mainPrompt = await fs.readFile(path.join(root, "resources", "prompts", "marionettist.md"), "utf8");
  assert.match(mainPrompt, /\$ARGUMENTS/u);
  const skill = await fs.readFile(path.join(root, "resources", "skills", "task-intake", "SKILL.md"), "utf8");
  assert.match(skill, /^---/u);
});

test("Pi extension enforces project-local activation and fixed roles", async () => {
  const extension = await fs.readFile(path.join(root, "extension", "index.ts"), "utf8");
  assert.match(extension, /\.pi["', ]+settings\.json/u);
  assert.match(extension, /pi install -l npm:/u);
  assert.match(extension, /name: "marionettist_subagent"/u);
  for (const role of roles) assert.match(extension, new RegExp(`"marionettist-${role}"`, "u"));
});
