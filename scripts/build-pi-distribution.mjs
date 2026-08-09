import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const piSourceRoot = path.join(repoRoot, "templates", "pathways", "pi");
const opencodeSourceRoot = path.join(repoRoot, "templates", "pathways", "opencode");
const skillsRoot = path.join(repoRoot, "skills");
const distributionRoot = path.join(repoRoot, "distributions", "pi");
const checkOnly = process.argv.includes("--check");
const agentTools = {
  "marionettist-builder": "read, grep, find, ls",
  "marionettist-planner": "read, grep, find, ls",
  "marionettist-coder": "read, edit, write, bash, grep, find, ls",
  "marionettist-reviewer": "read, bash, grep, find, ls",
  "marionettist-critic": "read, bash, grep, find, ls",
  "marionettist-indexer": "read, grep, find, ls",
  "marionettist-validator": "read, bash, grep, find, ls"
};

const expected = new Map();
await addTree(path.join(piSourceRoot, "extension"), "extension");
await addTree(skillsRoot, path.join("resources", "skills"));
await addTransformedTree(path.join(opencodeSourceRoot, "agents"), path.join("resources", "agents"), transformAgent, (relative) => !relative.startsWith("validators/"));
await addTransformedTree(path.join(opencodeSourceRoot, "commands"), path.join("resources", "prompts"), transformPrompt);
expected.set("README.md", await fs.readFile(path.join(piSourceRoot, "README.md"), "utf8"));

if (checkOnly) {
  const drift = await computeDrift();
  if (drift.length) {
    console.error("Pi distribution drift detected:");
    for (const entry of drift) console.error(`- ${entry}`);
    process.exitCode = 1;
  }
} else {
  await writeExpected();
}

async function addTree(sourceRoot, targetRoot) {
  for (const [relative, content] of await collectFiles(sourceRoot)) {
    expected.set(toPosix(path.join(targetRoot, relative)), content);
  }
}

async function addTransformedTree(sourceRoot, targetRoot, transform, include = () => true) {
  for (const [relative, content] of await collectFiles(sourceRoot)) {
    if (include(relative)) expected.set(toPosix(path.join(targetRoot, relative)), transform(content, relative));
  }
}

function transformAgent(content, relative) {
  const name = path.basename(relative, ".md");
  const tools = agentTools[name];
  if (!tools) throw new Error(`Missing Pi subagent metadata for ${relative}`);

  const transformed = content
    .replace(/^mode:.*\r?\n/gmu, "")
    .replace(/^model:.*\r?\n/gmu, "")
    .replace(/^temperature:.*\r?\n/gmu, "")
    .replace(/^thinkingLevel:/gmu, "thinking:")
    .replace(/^reasoning_effort:/gmu, "thinking:")
    .replace(/^permission:[\s\S]*?(?=^---$)/gmu, "")
    .replace(/^\{\{OPENCODE_PERMISSION_BLOCK_[A-Z_]+\}\}\r?\n/gmu, "")
    .replaceAll("OpenCode", "Pi")
    .replaceAll("opencode.permissionMode", "Pi tool permissions")
    .replaceAll(".opencode/", ".pi/")
    .replace(/^Your model field is rendered from .*\r?\n\r?\n/gmu, "")
    .replace(/^Pi permission policy notes[\s\S]*?\{\{OPENCODE_PERMISSION_WARNINGS_MARKDOWN\}\}\r?\n?/gmu, "");
  const extra = [
    `name: ${name}`,
    `tools: ${tools}`,
    "systemPromptMode: replace",
    "inheritProjectContext: true",
    "inheritSkills: true",
    `acceptanceRole: ${name === "marionettist-coder" ? "writer" : "read-only"}`,
    ...(new Set(["marionettist-reviewer", "marionettist-critic", "marionettist-validator"]).has(name)
      ? ["completionGuard: false"]
      : [])
  ];
  return transformed.replace(/^(---\r?\n)/u, `$1${extra.join("\n")}\n`);
}

function transformPrompt(content) {
  return content
    .replace(/^agent:.*\r?\n/gmu, "")
    .replaceAll("OpenCode", "Pi")
    .replaceAll("opencode.permissionMode", "Pi tool permissions")
    .replace(/`(marionettist-(?:builder|planner|coder|reviewer|critic|indexer|validator))`/gu, '`subagent` with `agent: "$1"`');
}

async function computeDrift() {
  const actual = new Map(await collectFiles(distributionRoot, true));
  const drift = [];
  for (const [relative, content] of expected) {
    if (!actual.has(relative)) drift.push(`missing ${relative}`);
    else if (actual.get(relative) !== content) drift.push(`content mismatch ${relative}`);
  }
  for (const relative of actual.keys()) {
    if (!expected.has(relative) && !["package.json", "index.js", "pi-pathway.test.js"].includes(relative)) drift.push(`unexpected ${relative}`);
  }
  return drift.sort();
}

async function writeExpected() {
  await fs.mkdir(distributionRoot, { recursive: true });
  const actual = new Map(await collectFiles(distributionRoot, true));
  for (const relative of actual.keys()) {
    if (!expected.has(relative) && !["package.json", "index.js", "pi-pathway.test.js"].includes(relative)) {
      await fs.rm(path.join(distributionRoot, relative), { force: true });
    }
  }
  for (const [relative, content] of expected) {
    const target = path.join(distributionRoot, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
  }
}

async function collectFiles(root, allowMissing = false) {
  try {
    const entries = [];
    await walk(root, "", entries);
    return entries.sort(([left], [right]) => left.localeCompare(right));
  } catch (error) {
    if (allowMissing && error?.code === "ENOENT") return [];
    throw error;
  }
}

async function walk(root, prefix, entries) {
  for (const child of await fs.readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, child.name);
    const relative = toPosix(path.join(prefix, child.name));
    if (child.isDirectory()) await walk(absolute, relative, entries);
    else entries.push([relative, await fs.readFile(absolute, "utf8")]);
  }
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}
