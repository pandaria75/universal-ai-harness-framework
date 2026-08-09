import { parseCommonArgs } from "../core/args.js";
import { applyPlan, printPlan } from "../core/apply-plan.js";
import { buildPlan } from "../core/plan.js";
import { ensurePiProjectPackage } from "../core/pi-package.js";

export async function syncCommand(args, dependencies = {}) {
  const options = parseCommonArgs(args);
  const plan = await buildPlan(options.project, "sync", options);
  printPlan(plan, options);
  await applyPlan(plan, options);
  if (plan.piState?.enabled) {
    const ensurePiProjectPackageImpl = dependencies.ensurePiProjectPackage ?? ensurePiProjectPackage;
    const result = await ensurePiProjectPackageImpl(options.project, { dryRun: options.dryRun });
    console.log(`${options.dryRun ? "would run" : "ran"}: ${result.command}`);
  }
}
