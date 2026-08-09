import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import piSubagents from "pi-subagents";
import { parse as parseYaml } from "yaml";

const packageName = "marionettist-pathway-pi";
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const resourceRoot = path.join(packageRoot, "resources");
const piSubagentsRoot = path.dirname(fileURLToPath(import.meta.resolve("pi-subagents")));
const builderAgentPath = path.join(resourceRoot, "agents", "marionettist-builder.md");
const builderModeEntryType = "marionettist-builder-mode";

let builderModeActive = false;
let builderInstructions: string | undefined;

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

  builderInstructions = await loadBuilderInstructions();
  pi.on("session_start", async (_event, ctx) => {
    builderModeActive = restoreBuilderMode(ctx.sessionManager.getEntries());
  });
  pi.on("before_agent_start", async (event) => {
    if (!builderModeActive || !builderInstructions) return undefined;
    return {
      systemPrompt: `${event.systemPrompt}\n\n${builderParentContract}\n\n${builderInstructions}`
    };
  });
  pi.registerCommand("marionettist", {
    description: "Start or resume the Marionettist parent-builder workflow",
    handler: async (args, ctx) => {
      builderModeActive = true;
      pi.appendEntry(builderModeEntryType, { active: true });
      await selectBuilderModel(pi, ctx, projectRoot);
      await ctx.sendUserMessage(buildBuilderRequest(args));
    }
  });
  pi.registerCommand("marionettist-exit", {
    description: "Leave Marionettist parent-builder mode in this session",
    handler: async (_args, ctx) => {
      builderModeActive = false;
      pi.appendEntry(builderModeEntryType, { active: false });
      ctx.ui.notify("Marionettist parent-builder mode is inactive for this session.", "info");
    }
  });
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

const builderParentContract = `
You are the PRIMARY Marionettist builder in the interactive Pi parent session.
Do not launch marionettist-builder as a subagent: you are that role. You own task
state, gate decisions, orchestration, and the final response. Use the standard
subagent tool to delegate bounded work only to marionettist-indexer,
marionettist-planner, marionettist-critic, marionettist-coder,
marionettist-reviewer, and marionettist-validator.

Delegating to one of those roles is an INTERNAL workflow step, never a user
approval point. Do not ask for confirmation before or after indexer, planner,
or critic work within analysis. Do not ask for confirmation between coder,
reviewer, validator, or bounded repair attempts for the same approved slice.
For coordinated dependent work, keep control in this parent and use one
workflowScript when it avoids separate launches without losing task context.

Request user confirmation only at a real Marionettist gate: analysis-to-coding;
an ineligible next approved slice or group under the selected gate policy; final
approval when required; or an explicit protected-area, dangerous-command,
compatibility, scope, or unresolved product decision. In balanced mode, do not
invent additional gates. Apply the selected task policy and frozen slice metadata
exactly; high-risk, boundary-sensitive, critic-required, and explicit stop
conditions remain real gates.
`.trim();

async function loadBuilderInstructions() {
  const content = await readFile(builderAgentPath, "utf8");
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, "").trim();
}

function restoreBuilderMode(entries: readonly unknown[]) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (!entry || typeof entry !== "object") continue;
    const typed = entry as { type?: unknown; customType?: unknown; data?: unknown };
    if (typed.type !== "custom" || typed.customType !== builderModeEntryType) continue;
    return Boolean(typed.data && typeof typed.data === "object" && (typed.data as { active?: unknown }).active);
  }
  return false;
}

function buildBuilderRequest(args: string) {
  const request = args.trim();
  return [
    "Use the Marionettist parent-builder workflow for this request.",
    "Treat the parent-builder contract in your system prompt as authoritative.",
    "User request:",
    request || "Resume the active Marionettist task from its durable task artifacts."
  ].join("\n\n");
}

async function selectBuilderModel(pi: ExtensionAPI, ctx: { modelRegistry: { find(provider: string, model: string): unknown }; ui: { notify(message: string, level: "info" | "warning" | "error"): void } }, projectRoot: string) {
  const modelId = await resolveBuilderModel(projectRoot);
  if (!modelId) return;
  const separator = modelId.indexOf("/");
  if (separator <= 0 || separator === modelId.length - 1) return;
  const model = ctx.modelRegistry.find(modelId.slice(0, separator), modelId.slice(separator + 1));
  if (!model) {
    ctx.ui.notify(`Marionettist builder model '${modelId}' is not available; keeping the current Pi model.`, "warning");
    return;
  }
  if (!await pi.setModel(model as never)) {
    ctx.ui.notify(`Marionettist builder model '${modelId}' has no available credentials; keeping the current Pi model.`, "warning");
  }
}

async function resolveBuilderModel(projectRoot: string) {
  const userAgentDir = process.env.PI_CODING_AGENT_DIR ?? path.join(homedir(), ".pi", "agent");
  const settingsPaths = [
    path.join(userAgentDir, "settings.json"),
    path.join(projectRoot, ".pi", "settings.json")
  ];
  let selected: string | undefined;
  for (const settingsPath of settingsPaths) {
    try {
      const settings = JSON.parse(await readFile(settingsPath, "utf8"));
      const configured = settings?.subagents?.agentOverrides?.["marionettist-builder"]?.model;
      if (typeof configured === "string" && configured.trim()) selected = configured.trim();
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") continue;
    }
  }
  if (selected) return selected;
  try {
    const profiles = parseYaml(await readFile(path.join(projectRoot, ".marionettist", "model-profiles.yml"), "utf8")) as { profiles?: { think?: { default?: unknown } } };
    return typeof profiles?.profiles?.think?.default === "string" ? profiles.profiles.think.default : undefined;
  } catch {
    return undefined;
  }
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
