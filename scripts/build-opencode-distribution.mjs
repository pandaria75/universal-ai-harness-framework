import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");
const sourceRoot = path.join(repoRoot, "templates", "pathways", "opencode");
const distributionRoot = path.join(repoRoot, "distributions", "opencode");

const managedMappings = [
  { source: "agents", target: path.join("templates", "agents") },
  { source: "commands", target: path.join("templates", "commands") },
  { source: "pathway", target: "pathway" },
  { source: "pathway-skills", target: "pathway-skills" },
  { source: "plugin", target: "plugin" }
];

const managedFileMappings = [
  { source: "README.md", target: "README.md" }
];

const checkOnly = process.argv.includes("--check");

const expectedFiles = await buildExpectedFiles();

if (checkOnly) {
  const drift = await computeDrift(expectedFiles);
  if (drift.length > 0) {
    console.error("OpenCode distribution drift detected:");
    for (const entry of drift) {
      console.error(`- ${entry}`);
    }
    process.exitCode = 1;
  }
} else {
  await writeExpectedFiles(expectedFiles);
}

async function buildExpectedFiles() {
  const expected = new Map();

  for (const mapping of managedMappings) {
    const sourceDirectory = path.join(sourceRoot, mapping.source);
    const sourceFiles = await collectFiles(sourceDirectory);
    for (const [relative, content] of sourceFiles) {
      const targetRelative = toPosix(path.join(mapping.target, relative));
      expected.set(targetRelative, transformContent(mapping, relative, content));
    }
  }

  for (const mapping of managedFileMappings) {
    const content = await fs.readFile(path.join(sourceRoot, mapping.source), "utf8");
    expected.set(mapping.target, transformContent(mapping, mapping.source, content));
  }

  return expected;
}

function transformContent(mapping, relative, content) {
  if (mapping.source === "plugin" && relative === "opencode-tasks.js") {
    return content
      .replace(
        /import path from "node:path";(\r?\n)/u,
        'import path from "node:path";$1import { fileURLToPath } from "node:url";$1',
      )
      .replace('const prototypeSkillPath = ".opencode/pathway-skills";', 'const packageSkillPath = fileURLToPath(new URL("../pathway-skills", import.meta.url)).split(path.sep).join("/");')
      .replace('const registerPackagedStandardSurface = false;', 'const registerPackagedStandardSurface = true;')
      .replaceAll('../agents/', '../templates/agents/')
      .replaceAll('../commands/', '../templates/commands/')
      .replaceAll('prototypeSkillPath', 'packageSkillPath');
  }

  if (mapping.source === "pathway" || mapping.source === "pathway-skills") {
    return content
      .replaceAll('repository-local OpenCode pathway prototype', 'OpenCode pathway prototype')
      .replaceAll('Repository-local OpenCode pathway prototype', 'OpenCode pathway prototype')
      .replaceAll('repository-local OpenCode pathway plugin prototype', 'OpenCode pathway plugin prototype')
      .replaceAll('repository-local assets', 'package-local assets')
      .replaceAll('`.opencode/pathway-skills`', 'the package skill path')
      .replaceAll('.opencode/pathway-skills', 'the package skill path')
      .replaceAll('local marionettist plugin-first pathway seam', 'marionettist plugin-first pathway seam');
  }

  return content;
}

async function computeDrift(expectedFiles) {
  const drift = [];
  const actualFiles = new Map();

  for (const mapping of managedMappings) {
    const targetDirectory = path.join(distributionRoot, mapping.target);
    for (const [relative, content] of await collectFiles(targetDirectory, { allowMissing: true })) {
      actualFiles.set(toPosix(path.join(mapping.target, relative)), content);
    }
  }

  for (const mapping of managedFileMappings) {
    const targetPath = path.join(distributionRoot, mapping.target);
    try {
      actualFiles.set(mapping.target, await fs.readFile(targetPath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }
  }

  for (const [targetRelative, expectedContent] of expectedFiles) {
    if (!actualFiles.has(targetRelative)) {
      drift.push(`missing ${targetRelative}`);
      continue;
    }
    if (actualFiles.get(targetRelative) !== expectedContent) {
      drift.push(`content mismatch ${targetRelative}`);
    }
  }

  for (const targetRelative of actualFiles.keys()) {
    if (!expectedFiles.has(targetRelative)) {
      drift.push(`unexpected ${targetRelative}`);
    }
  }

  return drift.sort((left, right) => left.localeCompare(right));
}

async function writeExpectedFiles(expectedFiles) {
  for (const mapping of managedMappings) {
    const targetDirectory = path.join(distributionRoot, mapping.target);
    const existingFiles = await collectFiles(targetDirectory, { allowMissing: true });
    const expectedInDirectory = new Set(
      [...expectedFiles.keys()].filter((relative) => relative.startsWith(`${toPosix(mapping.target)}/`))
    );

    for (const [relative] of existingFiles) {
      const targetRelative = toPosix(path.join(mapping.target, relative));
      if (!expectedInDirectory.has(targetRelative)) {
        await fs.rm(path.join(distributionRoot, targetRelative), { force: true });
      }
    }
  }

  for (const [targetRelative, content] of expectedFiles) {
    const targetPath = path.join(distributionRoot, targetRelative);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, "utf8");
  }
}

async function collectFiles(root, options = {}) {
  if (options.allowMissing) {
    try {
      await fs.access(root);
    } catch {
      return [];
    }
  }

  const entries = [];
  await walk(root, "", entries);
  entries.sort(([left], [right]) => left.localeCompare(right));
  return entries;
}

async function walk(root, prefix, entries) {
  const children = await fs.readdir(root, { withFileTypes: true });
  for (const child of children) {
    const absolute = path.join(root, child.name);
    const relative = prefix ? `${prefix}/${child.name}` : child.name;
    if (child.isDirectory()) {
      await walk(absolute, relative, entries);
      continue;
    }
    entries.push([relative, await fs.readFile(absolute, "utf8")]);
  }
}

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}
