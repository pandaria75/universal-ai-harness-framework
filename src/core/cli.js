import { initCommand } from "../commands/init.js";
import { syncCommand } from "../commands/sync.js";
import { diffCommand } from "../commands/diff.js";
import { doctorCommand } from "../commands/doctor.js";
import { selfCommand } from "../commands/self.js";
import { clearCommand } from "../commands/clear.js";
import { fileURLToPath } from "node:url";

const help = `Marionettist

Usage:
  marionettist init [--project <path>] [--dry-run] [--force] [--auto] [--distribution-mode <embedded|hybrid|adapter>] [--with-opencode] [--with-pi] [--opencode-command-surface <minimal|standard|advanced|full>]
  marionettist sync [--project <path>] [--dry-run] [--force] [--with-pi]
  marionettist diff [--project <path>] [--with-pi]
  marionettist doctor [--project <path>] [--with-pi]
  marionettist clear [--project <path>] [--scope <all|opencode>] [--apply]
  marionettist uninstall [--project <path>] [--scope <all|opencode>] [--apply]
  marionettist self init [--apply] [--with-opencode] [--with-pi]
  marionettist self doctor
  marionettist self test
  marionettist --help
`;

export async function runCli(args) {
  const [command, ...rest] = args;

  if (!command || command === "--help" || command === "-h") {
    console.log(help);
    return;
  }

  if (command === "init") {
    await initCommand(rest);
    return;
  }

  if (command === "sync") {
    await syncCommand(rest);
    return;
  }

  if (command === "diff") {
    await diffCommand(rest);
    return;
  }

  if (command === "doctor") {
    await doctorCommand(rest);
    return;
  }

  if (command === "clear" || command === "uninstall") {
    await clearCommand(rest);
    return;
  }

  if (command === "self") {
    await selfCommand(rest);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${help}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
