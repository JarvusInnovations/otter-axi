import { AxiError } from "axi-sdk-js";
import type { StructuredOutput } from "../output.js";

export const AUTH_HELP = `usage: otter-axi auth <login|status|logout> [flags]
subcommands:
  login    one-time browser approval; stores refreshable OAuth tokens
  status   show the connected account (--offline to skip the live probe)
  logout   revoke and clear stored tokens
Implemented in plan 03 (auth & MCP client).`;

const SUBCOMMANDS = new Set(["login", "status", "logout"]);

/** Stub until plan 03 wires the OAuth flow and MCP client. */
export async function authCommand(args: string[]): Promise<StructuredOutput> {
  const sub = args[0];
  if (sub === undefined || !SUBCOMMANDS.has(sub)) {
    throw new AxiError(
      sub ? `Unknown auth subcommand: ${sub}` : "Missing auth subcommand",
      "VALIDATION_ERROR",
      ["Run `otter-axi auth login`", "Run `otter-axi auth --help`"],
    );
  }
  throw new AxiError(
    `auth ${sub} is not implemented yet`,
    "UNIMPLEMENTED",
    ["Tracked by plan 03 (auth & MCP client)"],
  );
}
