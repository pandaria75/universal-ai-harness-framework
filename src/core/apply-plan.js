import fs from "node:fs/promises";
import { writeText } from "./files.js";

const defaultWritableStatuses = new Set([
  "new-managed",
  "missing",
  "update",
  "update-managed-block",
  "backup-and-write",
  "overwrite-local"
]);

export async function applyPlan(plan, options) {
  for (const operation of plan.operations) {
    if (operation.type === "directory") {
      if (!options.dryRun) {
        await fs.mkdir(operation.targetPath, { recursive: true });
      }
      continue;
    }

    if (operation.type === "manifest") {
      await writeText(operation.targetPath, operation.content, options);
      continue;
    }

    if (!shouldWrite(operation, options)) {
      continue;
    }

    if (operation.action === "backup-and-write" && !options.dryRun) {
      try {
        await fs.rename(operation.targetPath, `${operation.targetPath}.bak`);
      } catch (e) {
        // Ignore if file doesn't exist or other rename errors
      }
    }

    await writeText(operation.targetPath, operation.content, options);
  }
}

export function printPlan(plan, options) {
  console.log(`framework version: ${plan.version}`);
  console.log(`project: ${options.project}`);
  console.log(`mode: ${options.dryRun ? "dry-run" : "write"}`);
  if (plan.distributionModeState?.reportedValue) {
    const suffix = plan.distributionModeState.legacyInference ? " (legacy inferred; manifest unchanged)" : "";
    console.log(`distribution mode: ${plan.distributionModeState.reportedValue}${suffix}`);
  }
  if (plan.piState?.enabled) {
    console.log(`pi pathway: ${plan.piState.source} (${plan.piState.scope})`);
  }

  for (const operation of plan.operations) {
    console.log(`${printableAction(operation, options)}: ${operation.targetRelative}`);
  }
}

function shouldWrite(operation, options) {
  if (operation.type !== "file") {
    return false;
  }

  if (defaultWritableStatuses.has(operation.status)) {
    return true;
  }

  return options.force && (operation.status === "modified-local" || operation.status === "conflict");
}

function printableAction(operation, options) {
  if (operation.type === "manifest" && options.dryRun) {
    return "manifest-preview";
  }
  if (options.force && (operation.status === "modified-local" || operation.status === "conflict")) {
    return `force-${operation.status}`;
  }
  return operation.action;
}
