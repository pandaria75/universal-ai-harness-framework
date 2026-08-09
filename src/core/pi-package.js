import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export const piPackageName = "marionettist-pathway-pi";
export const piPackageSource = `npm:${piPackageName}`;

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
  return runPi(["install", "-l", source], projectPath, options);
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
