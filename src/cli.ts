import { runAxiCli, type AxiCliOptions } from "axi-sdk-js";
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

/** Build the CLI options. Overrides (e.g. `argv`, `stdout`) let tests drive dispatch. */
export function cliOptions(
  overrides: Partial<AxiCliOptions> = {},
): AxiCliOptions {
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
    ...overrides,
  };
}

export async function main(): Promise<void> {
  await runAxiCli(cliOptions());
}
