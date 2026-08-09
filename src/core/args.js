import path from "node:path";
import { normalizeDistributionMode, normalizeOpencodeCommandSurface, normalizeOpencodePermissionMode } from "./manifest.js";

export function parseCommonArgs(args) {
  const clearScopes = new Set(["all", "opencode"]);
  const knowledgeModes = new Set(["standard", "mudball"]);
  const knowledgeMaturities = new Set(["L0", "L1", "L2", "L3", "L4"]);
  const options = {
    project: process.cwd(),
    dryRun: false,
    apply: false,
    force: false,
    auto: false,
    scope: "all",
    withOpencode: null,
    withPi: null,
    distributionMode: null,
    opencodeCommandSurface: null,
    opencodePermissionMode: null,
    knowledgeMode: null,
    knowledgeMaturity: null
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--project") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--project requires a path");
      }
      options.project = value;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--force") {
      options.force = true;
      continue;
    }

    if (arg === "--auto") {
      options.auto = true;
      continue;
    }

    if (arg === "--with-opencode") {
      options.withOpencode = true;
      continue;
    }

    if (arg === "--with-pi") {
      options.withPi = true;
      continue;
    }

    if (arg === "--distribution-mode") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--distribution-mode requires embedded, hybrid, or adapter");
      }
      options.distributionMode = normalizeDistributionMode(value, "--distribution-mode value");
      index += 1;
      continue;
    }

    if (arg === "--opencode-command-surface") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--opencode-command-surface requires minimal, standard, advanced, or legacy full");
      }
      options.opencodeCommandSurface = normalizeOpencodeCommandSurface(value, "--opencode-command-surface value");
      index += 1;
      continue;
    }

    if (arg === "--opencode-permission-mode") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--opencode-permission-mode requires default, moderate, or loose");
      }
      options.opencodePermissionMode = normalizeOpencodePermissionMode(value, "--opencode-permission-mode value");
      index += 1;
      continue;
    }

    if (arg === "--knowledge-mode") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--knowledge-mode requires standard or mudball");
      }
      if (!knowledgeModes.has(value)) {
        throw new Error(`Unsupported --knowledge-mode value: ${value}`);
      }
      options.knowledgeMode = value;
      index += 1;
      continue;
    }

    if (arg === "--knowledge-maturity") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--knowledge-maturity requires L0, L1, L2, L3, or L4");
      }
      if (!knowledgeMaturities.has(value)) {
        throw new Error(`Unsupported --knowledge-maturity value: ${value}`);
      }
      options.knowledgeMaturity = value;
      index += 1;
      continue;
    }

    if (arg === "--scope") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--scope requires all or opencode");
      }
      if (!clearScopes.has(value)) {
        throw new Error(`Unsupported --scope value: ${value}`);
      }
      options.scope = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (options.opencodeCommandSurface && options.withOpencode !== false) {
    options.withOpencode = true;
  }

  if (options.opencodePermissionMode && options.withOpencode !== false) {
    options.withOpencode = true;
  }

  options.project = path.resolve(options.project);
  return options;
}
