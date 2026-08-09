import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { buildResolvedOpencodeAgentModelConfigs, loadModelProfiles } from "./model-profiles.js";

export const piPackageName = "marionettist-pathway-pi";
export const piPackageSource = `npm:${piPackageName}`;
const piAgentModelBindings = [
  ["marionettist-builder", "harness-builder"],
  ["marionettist-planner", "harness-planner"],
  ["marionettist-coder", "harness-coder"],
  ["marionettist-reviewer", "harness-reviewer"],
  ["marionettist-critic", "harness-critic"],
  ["marionettist-indexer", "harness-indexer"],
  ["marionettist-validator", "harness-validator"]
];

export async function readPiProjectInstall(projectPath) {
  const settingsPath = path.join(projectPath, ".pi", "settings.json");
  try {
    const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
    const entry = Array.isArray(settings?.packages)
      ? settings.packages.find((candidate) => isPiPackageEntry(candidate))
      : null;
    return { installed: Boolean(entry), settingsPath, entry, parseError: null };
  } catch (error) {
    if (error?.code === "ENOENT") return { installed: false, settingsPath, entry: null, parseError: null };
    return { installed: false, settingsPath, entry: null, parseError: error };
  }
}

export async function ensurePiProjectPackage(projectPath, options = {}) {
  const source = options.source ?? piPackageSource;
  if (options.dryRun) return { command: `pi install -l ${source}`, skipped: true };
  const result = await runPi(["install", "-l", source], projectPath, options);
  await syncPiSubagentModelOverrides(projectPath);
  return result;
}

export async function syncPiSubagentModelOverrides(projectPath) {
  const settingsPath = path.join(projectPath, ".pi", "settings.json");
  const settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  const profiles = await loadModelProfiles(projectPath);
  const resolvedModels = buildResolvedOpencodeAgentModelConfigs(profiles);
  const existingSubagents = isPlainObject(settings.subagents) ? settings.subagents : {};
  const existingOverrides = isPlainObject(existingSubagents.agentOverrides)
    ? existingSubagents.agentOverrides
    : {};
  const agentOverrides = { ...existingOverrides };

  for (const [piAgentName, sharedAgentName] of piAgentModelBindings) {
    const existing = isPlainObject(agentOverrides[piAgentName]) ? agentOverrides[piAgentName] : {};
    agentOverrides[piAgentName] = {
      ...existing,
      model: resolvedModels[sharedAgentName].model
    };
  }

  settings.subagents = {
    ...existingSubagents,
    agentOverrides
  };
  await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return { settingsPath, agentOverrides };
}

export async function listPiModels(projectPath, options = {}) {
  return runPi(["--list-models"], projectPath, { ...options, captureOnly: true });
}

function isPiPackageEntry(entry) {
  const source = typeof entry === "string"
    ? entry
    : entry && typeof entry === "object"
      ? entry.source
      : null;
  const normalized = typeof source === "string" ? source.replace(/\\/gu, "/") : "";
  return source === piPackageName
    || source === piPackageSource
    || (typeof source === "string" && source.startsWith(`${piPackageSource}@`))
    || normalized.endsWith("/distributions/pi")
    || normalized === "./distributions/pi";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function runPi(args, cwd, options = {}) {
  const spawnImpl = options.spawn ?? spawn;
  return await new Promise((resolve, reject) => {
    const child = spawnImpl("pi", args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding?.("utf8");
    child.stderr?.setEncoding?.("utf8");
    child.stdout?.on?.("data", (chunk) => { stdout += chunk; });
    child.stderr?.on?.("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(`Unable to run pi ${args.join(" ")}: ${error.message}`)));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`pi ${args.join(" ")} failed with code ${code}: ${stderr.trim() || stdout.trim() || "no diagnostic output"}`));
        return;
      }
      resolve({ command: `pi ${args.join(" ")}`, stdout, stderr, exitCode: code ?? 0 });
    });
  });
}
