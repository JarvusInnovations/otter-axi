import { installSessionStartHooks } from "axi-sdk-js";
import { SETUP_FLAGS, parseSubcommand } from "../flags.js";
import type { StructuredOutput } from "../output.js";

export const SETUP_HELP = `usage: otter-axi setup hooks
Installs the SessionStart hooks (Claude Code, Codex, OpenCode) that inject the
otter-axi home view into agent sessions. Idempotent; needs no credentials.`;

export async function setupCommand(
  args: string[],
  opts: { homeDir?: string; shouldInstall?: (execPath: string) => boolean } = {},
): Promise<StructuredOutput> {
  // `hooks` is the only subcommand; parsing still rejects stray flags and arguments.
  parseSubcommand("setup", args, SETUP_FLAGS);
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
