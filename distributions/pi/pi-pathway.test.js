import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const roles = ["builder", "planner", "coder", "reviewer", "critic", "indexer", "validator"];

test("Pi package exposes its guarded extension and package agents", async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.name, "marionettist-pathway-pi");
  assert.deepEqual(pkg.pi, {
    extensions: ["./extension/index.ts"],
    subagents: { agents: ["./resources/agents"] }
  });
  assert.equal(pkg.dependencies["pi-subagents"], "0.45.0");
  assert.equal(pkg.pi.skills, undefined);
  assert.equal(pkg.pi.prompts, undefined);
});
test("Pi distribution contains seven roles, workflows, and shared skills", async () => {
  for (const role of roles) {
    const content = await fs.readFile(path.join(root, "resources", "agents", `marionettist-${role}.md`), "utf8");
    assert.match(content, /description:/u);
    assert.match(content, new RegExp(`name: marionettist-${role}`, "u"));
    assert.match(content, /tools:/u);
    assert.doesNotMatch(content, /^model:/mu);
  }
  const mainPrompt = await fs.readFile(path.join(root, "resources", "prompts", "marionettist.md"), "utf8");
  assert.match(mainPrompt, /\$ARGUMENTS/u);
  const skill = await fs.readFile(path.join(root, "resources", "skills", "task-intake", "SKILL.md"), "utf8");
  assert.match(skill, /^---/u);
});

test("Pi package agents leave model selection open to shared settings overrides", async () => {
  const indexer = await fs.readFile(path.join(root, "resources", "agents", "marionettist-indexer.md"), "utf8");
  const reviewer = await fs.readFile(path.join(root, "resources", "agents", "marionettist-reviewer.md"), "utf8");
  assert.match(indexer, /^thinking: low$/mu);
  assert.match(reviewer, /^thinking: high$/mu);
  assert.doesNotMatch(indexer, /thinkingLevel|reasoning_effort/u);
  assert.doesNotMatch(reviewer, /thinkingLevel|reasoning_effort/u);
});

test("Pi extension enforces project-local activation and delegates discovery to pi-subagents", async () => {
  const extension = await fs.readFile(path.join(root, "extension", "index.ts"), "utf8");
  assert.match(extension, /\.pi["', ]+settings\.json/u);
  assert.match(extension, /pi install -l npm:/u);
  assert.match(extension, /import piSubagents from "pi-subagents"/u);
  assert.match(extension, /await piSubagents\(pi\)/u);
  assert.doesNotMatch(extension, /marionettist_subagent/u);
});

test("Pi workflows route Marionettist roles through the standard subagent tool", async () => {
  const mainPrompt = await fs.readFile(path.join(root, "resources", "prompts", "marionettist-feature.md"), "utf8");
  assert.match(mainPrompt, /`subagent` with `agent: "marionettist-indexer"`/u);
});
