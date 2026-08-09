import { parseCommonArgs } from "../core/args.js";
import { printPlan } from "../core/apply-plan.js";
import { buildPlan } from "../core/plan.js";
import { readPiProjectInstall } from "../core/pi-package.js";

export async function diffCommand(args) {
  const options = parseCommonArgs(args);
  const plan = await buildPlan(options.project, "sync", { ...options, dryRun: true });
  printPlan(plan, { ...options, dryRun: true });
  if (plan.piState?.enabled) {
    const state = await readPiProjectInstall(options.project);
    console.log(`${state.installed ? "unchanged" : "missing"}: .pi/settings.json package ${plan.piState.source}`);
  }
}
