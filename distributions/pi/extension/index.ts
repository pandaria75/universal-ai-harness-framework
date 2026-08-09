import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const packageName = "marionettist-pathway-pi";
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const resourceRoot = path.join(packageRoot, "resources");
const roleNames = [
  "marionettist-builder",
  "marionettist-planner",
  "marionettist-coder",
  "marionettist-reviewer",
  "marionettist-critic",
  "marionettist-indexer",
  "marionettist-validator"
] as const;
const roleProfiles: Record<(typeof roleNames)[number], string> = {
  "marionettist-builder": "think",
  "marionettist-planner": "think",
  "marionettist-coder": "build",
  "marionettist-reviewer": "review",
  "marionettist-critic": "review",
  "marionettist-indexer": "run",
  "marionettist-validator": "run"
};
const roleTools: Record<(typeof roleNames)[number], string[]> = {
  "marionettist-builder": ["read", "grep", "find", "ls"],
  "marionettist-planner": ["read", "grep", "find", "ls"],
  "marionettist-coder": ["read", "edit", "write", "bash", "grep", "find", "ls"],
  "marionettist-reviewer": ["read", "bash", "grep", "find", "ls"],
  "marionettist-critic": ["read", "bash", "grep", "find", "ls"],
  "marionettist-indexer": ["read", "grep", "find", "ls"],
  "marionettist-validator": ["read", "bash", "grep", "find", "ls"]
};

type RoleName = (typeof roleNames)[number];

export default function marionettistPiPathway(pi: ExtensionAPI) {
  let activeProjectRoot: string | null = null;
  let warnedGlobalInstall = false;
  let toolRegistered = false;

  pi.on("session_start", async (_event, ctx) => {
    activeProjectRoot = await findProjectLocalInstall(ctx.cwd);
    if (activeProjectRoot && !toolRegistered) {
      toolRegistered = true;
      registerSubagentTool();
    }
    if (!activeProjectRoot && !warnedGlobalInstall) {
      warnedGlobalInstall = true;
      ctx.ui.notify(
        `${packageName} is disabled because it is not installed in this project's .pi/settings.json. Reinstall with: pi install -l npm:${packageName}`,
        "warning"
      );
    }
  });

  pi.on("resources_discover", async (event) => {
    activeProjectRoot = await findProjectLocalInstall(event.cwd);
    if (!activeProjectRoot) return {};
    return {
      skillPaths: [path.join(resourceRoot, "skills")],
      promptPaths: [path.join(resourceRoot, "prompts")]
    };
  });

  const registerSubagentTool = () => pi.registerTool({
    name: "marionettist_subagent",
    label: "Marionettist Subagent",
    description: "Delegate one bounded task to one of the seven fixed Marionettist roles in an isolated Pi process.",
    promptSnippet: "Use marionettist_subagent for bounded Marionettist role delegation",
    promptGuidelines: [
      "Use marionettist_subagent only after selecting a bounded role task and include the relevant taskEnvelope and artifact paths."
    ],
    parameters: Type.Object({
      role: Type.Union(roleNames.map((name) => Type.Literal(name))),
      task: Type.String({ minLength: 1 }),
      cwd: Type.Optional(Type.String())
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (process.env.MARIONETTIST_SUBAGENT_DEPTH) {
        return toolError("Recursive Marionettist subagent delegation is disabled.");
      }
      const projectRoot = activeProjectRoot ?? await findProjectLocalInstall(ctx.cwd);
      if (!projectRoot) {
        return toolError(`Global installation is not supported. Run: pi install -l npm:${packageName}`);
      }

      const role = params.role as RoleName;
      if (!roleNames.includes(role)) {
        return toolError(`Unsupported Marionettist role: ${String(params.role)}`);
      }

      const childCwd = path.resolve(ctx.cwd, params.cwd ?? ".");
      if (!(await isDirectory(childCwd))) {
        return toolError(`Subagent cwd is not a directory: ${childCwd}`);
      }
      const relativeCwd = path.relative(projectRoot, childCwd);
      if (relativeCwd === ".." || relativeCwd.startsWith(`..${path.sep}`) || path.isAbsolute(relativeCwd)) {
        return toolError(`Subagent cwd must stay inside the project: ${projectRoot}`);
      }

      try {
        const rolePrompt = stripFrontmatter(await readFile(path.join(resourceRoot, "agents", `${role}.md`), "utf8"));
        const profile = await resolveProfile(projectRoot, roleProfiles[role], role);
        const result = await runChildPi({
          cwd: childCwd,
          model: profile.model,
          tools: roleTools[role],
          prompt: `${rolePrompt.trim()}\n\n# Delegated Task\n\n${params.task.trim()}`,
          signal,
          onUpdate
        });
        return {
          content: [{ type: "text", text: result.text }],
          details: { role, model: profile.model, cwd: childCwd, exitCode: result.exitCode }
        };
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  });
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

async function hasGitBoundary(directory: string) {
  try {
    await stat(path.join(directory, ".git"));
    return true;
  } catch {
    return false;
  }
}

async function resolveProfile(projectRoot: string, profileName: string, role: string) {
  const canonicalPath = path.join(projectRoot, ".marionettist", "model-profiles.yml");
  const legacyPath = path.join(projectRoot, "marionettist.config.yaml");
  let content: string;
  try {
    content = await readFile(canonicalPath, "utf8");
  } catch {
    content = await readFile(legacyPath, "utf8");
  }

  const overrideModel = readIndentedYamlValue(content, ["profiles", profileName, "agentOverrides", role, "model"]);
  const defaultModel = readIndentedYamlValue(content, ["profiles", profileName, "default"]);
  const legacyDefault = readIndentedYamlValue(content, ["models", "profiles", profileName, "default"]);
  const model = overrideModel ?? defaultModel ?? legacyDefault;
  if (!model) throw new Error(`No model configured for Marionettist profile ${profileName} (${role}).`);
  return { model };
}

function readIndentedYamlValue(content: string, keys: string[]) {
  const stack: string[] = [];
  for (const rawLine of content.split(/\r?\n/u)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const indent = rawLine.match(/^ */u)?.[0].length ?? 0;
    const depth = Math.floor(indent / 2);
    stack.length = depth;
    const match = rawLine.trim().match(/^([^:]+):(?:\s*(.*))?$/u);
    if (!match) continue;
    const key = match[1].trim();
    const value = (match[2] ?? "").replace(/\s+#.*$/u, "").trim();
    stack[depth] = key;
    if (stack.join(".") === keys.join(".") && value) return value.replace(/^['"]|['"]$/gu, "");
  }
  return null;
}

function stripFrontmatter(content: string) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, "");
}

async function runChildPi(options: {
  cwd: string;
  model: string;
  tools: string[];
  prompt: string;
  signal?: AbortSignal;
  onUpdate?: (update: { content: Array<{ type: "text"; text: string }> }) => void;
}) {
  return await new Promise<{ text: string; exitCode: number }>((resolve, reject) => {
    const child = spawn("pi", [
      "--mode", "json",
      "--model", options.model,
      "--tools", options.tools.join(","),
      "--no-session",
      "--no-extensions",
      "-p"
    ], {
      cwd: options.cwd,
      env: { ...process.env, MARIONETTIST_SUBAGENT_DEPTH: "1" },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const abort = () => child.kill();
    options.signal?.addEventListener("abort", abort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      options.onUpdate?.({ content: [{ type: "text", text: `Running subagent… ${stdout.length} bytes received` }] });
    });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      options.signal?.removeEventListener("abort", abort);
      const text = extractAssistantText(stdout) || stdout.trim();
      if (code !== 0) {
        reject(new Error(`Pi subagent exited with code ${code}: ${stderr.trim() || text || "no diagnostic output"}`));
        return;
      }
      resolve({ text: truncate(text || "(no subagent output)"), exitCode: code ?? 0 });
    });
    child.stdin.end(options.prompt);
  });
}

function extractAssistantText(stdout: string) {
  const parts: string[] = [];
  for (const line of stdout.split(/\r?\n/u)) {
    try {
      const event = JSON.parse(line);
      const content = event?.message?.role === "assistant" ? event.message.content : null;
      if (typeof content === "string") parts.push(content);
      if (Array.isArray(content)) {
        for (const item of content) if (item?.type === "text" && typeof item.text === "string") parts.push(item.text);
      }
    } catch {
      // Ignore non-JSON diagnostic lines.
    }
  }
  return parts.join("\n").trim();
}

function truncate(text: string) {
  const limit = 50_000;
  return text.length <= limit ? text : `${text.slice(0, limit)}\n\n[output truncated]`;
}

async function isDirectory(candidate: string) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

function toolError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    details: { error: true },
    isError: true
  };
}
