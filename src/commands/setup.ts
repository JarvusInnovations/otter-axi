import { AxiError, installSessionStartHooks } from "axi-sdk-js";
import type { StructuredOutput } from "../output.js";

export const SETUP_HELP = `usage: otter-axi setup hooks
Installs the SessionStart hooks (Claude Code, Codex, OpenCode) that inject the
otter-axi home view into agent sessions. Idempotent; needs no credentials.`;

export async function setupCommand(
  args: string[],
  opts: { homeDir?: string; shouldInstall?: (execPath: string) => boolean } = {},
): Promise<StructuredOutput> {
  if (args[0] !== "hooks") {
    throw new AxiError("Unknown setup subcommand", "VALIDATION_ERROR", [
      "Run `otter-axi setup hooks`",
    ]);
  }
  installSessionStartHooks({
    marker: "otter-axi",
    binaryNames: ["otter-axi"],
    ...(opts.homeDir ? { homeDir: opts.homeDir } : {}),
    ...(opts.shouldInstall ? { shouldInstall: opts.shouldInstall } : {}),
  });
  return {
    setup: "hooks installed (or already up to date)",
    help: [
      "Start a new agent session to see the otter-axi home view injected",
      "Run `otter-axi auth login` if you have not connected your Otter account",
    ],
  };
}
