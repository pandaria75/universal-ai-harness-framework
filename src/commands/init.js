import path from "node:path";
import { parseCommonArgs } from "../core/args.js";
import { applyPlan, printPlan } from "../core/apply-plan.js";
import { buildPlan, readConfiguredMarionettistLanguage } from "../core/plan.js";
import { getMarionettistLanguageGuideText, promptConfig, promptConflictStrategy, promptDistributionMode, promptOpencodeCommandSurface, promptOpencodePermissionMode, promptWithOpencode } from "./init-prompts.js";
import { ensurePiProjectPackage } from "../core/pi-package.js";

export async function initCommand(args, dependencies = {}) {
  const buildPlanImpl = dependencies.buildPlan ?? buildPlan;
  const applyPlanImpl = dependencies.applyPlan ?? applyPlan;
  const printPlanImpl = dependencies.printPlan ?? printPlan;
  const promptConfigImpl = dependencies.promptConfig ?? promptConfig;
  const promptConflictStrategyImpl = dependencies.promptConflictStrategy ?? promptConflictStrategy;
  const promptWithOpencodeImpl = dependencies.promptWithOpencode ?? promptWithOpencode;
  const promptDistributionModeImpl = dependencies.promptDistributionMode ?? promptDistributionMode;
  const promptOpencodeCommandSurfaceImpl = dependencies.promptOpencodeCommandSurface ?? promptOpencodeCommandSurface;
  const promptOpencodePermissionModeImpl = dependencies.promptOpencodePermissionMode ?? promptOpencodePermissionMode;
  const readConfiguredMarionettistLanguageImpl = dependencies.readConfiguredMarionettistLanguage ?? readConfiguredMarionettistLanguage;
  const log = dependencies.log ?? console.log;
  const options = parseCommonArgs(args);

  // 1. Interactive Prompts (unless --auto)
  let variables = {
    projectName: path.basename(options.project),
    projectType: "unknown",
    architecture: "unknown",
    primaryLanguage: "unknown",
    knowledgeMode: options.knowledgeMode ?? "standard",
    knowledgeMaturity: options.knowledgeMaturity ?? "L1"
  };
  let conflictStrategies = {};
  let withOpencode = options.withOpencode;
  let distributionMode = options.distributionMode;
  let opencodeCommandSurface = options.opencodeCommandSurface;
  let opencodePermissionMode = options.opencodePermissionMode;

  if (!options.auto) {
    const configuredMarionettistLanguage = await readConfiguredMarionettistLanguageImpl(options.project);
    const promptedVariables = await promptConfigImpl(variables.projectName, {
      projectType: variables.projectType,
      architecture: variables.architecture,
      primaryLanguage: variables.primaryLanguage,
      knowledgeMode: variables.knowledgeMode,
      knowledgeMaturity: variables.knowledgeMaturity,
      marionettistLanguage: configuredMarionettistLanguage.value,
      skipMarionettistLanguagePrompt: configuredMarionettistLanguage.value !== null,
      skipKnowledgeModePrompt: options.knowledgeMode !== null,
      skipKnowledgeMaturityPrompt: options.knowledgeMaturity !== null
    });
    variables = {
      knowledgeMode: options.knowledgeMode ?? promptedVariables.knowledgeMode,
      knowledgeMaturity: options.knowledgeMaturity ?? promptedVariables.knowledgeMaturity,
      projectName: promptedVariables.projectName,
      projectType: promptedVariables.projectType,
      architecture: promptedVariables.architecture,
      primaryLanguage: promptedVariables.primaryLanguage,
      ...(promptedVariables.marionettistLanguageWasSelected && promptedVariables.marionettistLanguage
        ? { marionettistLanguage: promptedVariables.marionettistLanguage }
        : {})
    };

    if (promptedVariables.marionettistLanguageWasSelected && promptedVariables.marionettistLanguage) {
      log(getMarionettistLanguageGuideText(promptedVariables.marionettistLanguage));
    }

    if (withOpencode === null) {
      withOpencode = await promptWithOpencodeImpl();
    }

    if (distributionMode === null) {
      distributionMode = await promptDistributionModeImpl();
    }

    if (withOpencode && opencodeCommandSurface === null) {
      opencodeCommandSurface = await promptOpencodeCommandSurfaceImpl();
    }

    if (withOpencode && opencodePermissionMode === null) {
      opencodePermissionMode = await promptOpencodePermissionModeImpl();
    }
  }

  const planningOptions = {
    ...options,
    variables,
    withOpencode,
    distributionMode,
    opencodeCommandSurface,
    opencodePermissionMode
  };

  // 2. Initial plan to detect existing files for the selected asset set
  const initialPlan = await buildPlanImpl(options.project, "init", planningOptions);
  const conflicts = initialPlan.operations.filter(op => op.type === "file" && op.exists && op.status === "skip-project-local");

  // 3. Conflict strategy prompts
  if (!options.auto) {
    for (const conflict of conflicts) {
      conflictStrategies[conflict.targetRelative] = await promptConflictStrategyImpl(conflict.targetRelative);
    }
  }

  // 4. Final plan with variables and strategies
  const finalOptions = {
    ...planningOptions,
    conflictStrategies
  };

  const plan = await buildPlanImpl(options.project, "init", finalOptions);
  printPlanImpl(plan, finalOptions);
  await applyPlanImpl(plan, finalOptions);

  if (options.withPi) {
    const ensurePiProjectPackageImpl = dependencies.ensurePiProjectPackage ?? ensurePiProjectPackage;
    const result = await ensurePiProjectPackageImpl(options.project, { dryRun: options.dryRun });
    log(`${options.dryRun ? "would run" : "ran"}: ${result.command}`);
  }

  if (withOpencode) {
    log("note: project-level opencode pathway prototype is enabled via opencode.jsonc");
  }
}
