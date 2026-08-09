import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import piSubagents from "pi-subagents";

const packageName = "marionettist-pathway-pi";
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const resourceRoot = path.join(packageRoot, "resources");
const piSubagentsRoot = path.dirname(fileURLToPath(import.meta.resolve("pi-subagents")));

export default async function marionettistPiPathway(pi: ExtensionAPI) {
  const projectRoot = await findProjectLocalInstall(process.cwd());
  if (!projectRoot) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify(
        `${packageName} is disabled because it is not installed in this project's .pi/settings.json. Reinstall with: pi install -l npm:${packageName}`,
        "warning"
      );
    });
    pi.on("resources_discover", async () => ({}));
    return;
  }

  const externalPiSubagents = await hasConfiguredPiSubagents(projectRoot);
  if (!externalPiSubagents) await piSubagents(pi);
  pi.on("resources_discover", async () => ({
    skillPaths: [
      path.join(resourceRoot, "skills"),
      ...(externalPiSubagents ? [] : [path.join(piSubagentsRoot, "skills")])
    ],
    promptPaths: [
      path.join(resourceRoot, "prompts"),
      ...(externalPiSubagents ? [] : [path.join(piSubagentsRoot, "prompts")])
    ]
  }));
}

async function hasConfiguredPiSubagents(projectRoot: string) {
  const userAgentDir = process.env.PI_CODING_AGENT_DIR ?? path.join(homedir(), ".pi", "agent");
  const settingsPaths = [
    path.join(projectRoot, ".pi", "settings.json"),
    path.join(userAgentDir, "settings.json")
  ];
  for (const settingsPath of settingsPaths) {
    try {
      const settings = JSON.parse(await readFile(settingsPath, "utf8"));
      if (Array.isArray(settings?.packages) && settings.packages.some(isPiSubagentsPackage)) return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") continue;
    }
  }
  return false;
}

async function findProjectLocalInstall(start: string) {
  let current = path.resolve(start);
  while (true) {
    const settingsPath = path.join(current, ".pi", "settings.json");
    try {
      const settings = JSON.parse(await readFile(settingsPath, "utf8"));
      if (Array.isArray(settings?.packages) && settings.packages.some(isThisPackage)) return current;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") return null;
    }
    const parent = path.dirname(current);
    if (parent === current || await hasGitBoundary(current)) return null;
    current = parent;
  }
}

function isThisPackage(entry: unknown) {
  const source = typeof entry === "string"
    ? entry
    : entry && typeof entry === "object" && "source" in entry
      ? String((entry as { source: unknown }).source)
      : "";
  const normalized = source.replace(/\\/gu, "/");
  return source === packageName
    || source === `npm:${packageName}`
    || source.startsWith(`npm:${packageName}@`)
    || normalized.endsWith("/distributions/pi")
    || normalized === "./distributions/pi";
}

function isPiSubagentsPackage(entry: unknown) {
  const source = typeof entry === "string"
    ? entry
    : entry && typeof entry === "object" && "source" in entry
      ? String((entry as { source: unknown }).source)
      : "";
  const normalized = source.replace(/\\/gu, "/");
  return source === "pi-subagents"
    || source === "npm:pi-subagents"
    || source.startsWith("npm:pi-subagents@")
    || normalized.endsWith("/pi-subagents");
}

async function hasGitBoundary(directory: string) {
  try {
    await stat(path.join(directory, ".git"));
    return true;
  } catch {
    return false;
  }
}
