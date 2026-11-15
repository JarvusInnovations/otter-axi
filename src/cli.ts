import { AxiError, exitCodeForError, runAxiCli, type AxiCliOptions } from "axi-sdk-js";
import { encode } from "@toon-format/toon";
import { DESCRIPTION, readVersion } from "./meta.js";
import { homeCommand } from "./commands/home.js";
import { authCommand, AUTH_HELP } from "./commands/auth.js";
import { doctorCommand, DOCTOR_HELP } from "./commands/doctor.js";
import { setupCommand, SETUP_HELP } from "./commands/setup.js";
import { searchCommand, SEARCH_HELP } from "./commands/search.js";
import { fetchCommand, FETCH_HELP } from "./commands/fetch.js";

export const TOP_HELP = `usage: otter-axi [command] [args] [flags]
commands[6]:
  (none)=home, auth, doctor, setup, search, fetch
flags:
  --help, -v/--version
examples:
  otter-axi auth login
  otter-axi search "roadmap review" --after 30d
  otter-axi search --after 2026/05/01 --before 2026/05/07
  otter-axi fetch aBcDeFgHiJkLmNoPqRsTuVwXyZ0
  otter-axi --help
  otter-axi search --help
`;

const COMMAND_HELP: Record<string, string> = {
  auth: AUTH_HELP,
  doctor: DOCTOR_HELP,
  setup: SETUP_HELP,
  search: SEARCH_HELP,
  fetch: FETCH_HELP,
};

/**
 * Error codes that represent a malformed invocation rather than a failed operation. These
 * must exit 2, but the SDK only maps its own `VALIDATION_ERROR` that way — so they are
 * re-mapped here.
 */
const USAGE_CODES = new Set(["USAGE", "UNKNOWN_FLAG", "VALIDATION_ERROR"]);

function renderFailure(message: string, code: string, suggestions: string[]): string {
  const output: Record<string, unknown> = { error: message, code };
  if (suggestions.length > 0) output.help = suggestions;
  // Written verbatim by the SDK, so the trailing newline is ours.
  return `${encode(output)}\n`;
}

/**
 * Exported (rather than inlined into the `runAxiCli` call) so the USAGE-set→2 mapping and
 * INTERNAL_ERROR wrapping are unit-testable without exercising the full CLI dispatch.
 */
export function formatError(error: unknown): { output: string; exitCode: number } {
  if (error instanceof AxiError) {
    return {
      output: renderFailure(error.message, error.code, error.suggestions),
      exitCode: USAGE_CODES.has(error.code) ? 2 : exitCodeForError(error),
    };
  }

  // Never let a raw dependency error or stack trace reach stdout — an agent would try to
  // read it as data.
  const message = error instanceof Error ? error.message : String(error);
  return {
    output: renderFailure(`unexpected failure: ${message}`, "INTERNAL_ERROR", [
      "Run `otter-axi doctor` to check credentials and connectivity",
    ]),
    exitCode: 1,
  };
}

/** Build the CLI options. Overrides (e.g. `argv`, `stdout`) let tests drive dispatch. */
export function cliOptions(overrides: Partial<AxiCliOptions> = {}): AxiCliOptions {
  return {
    description: DESCRIPTION,
    version: readVersion(),
    topLevelHelp: TOP_HELP,
    home: () => homeCommand(),
    commands: {
      auth: (args) => authCommand(args),
      doctor: (args) => doctorCommand(args),
      setup: (args) => setupCommand(args),
      search: (args) => searchCommand(args),
      fetch: (args) => fetchCommand(args),
    },
    getCommandHelp: (command) => COMMAND_HELP[command],
    formatError,
    ...overrides,
  };
}

export async function main(): Promise<void> {
  await runAxiCli(cliOptions());
}
