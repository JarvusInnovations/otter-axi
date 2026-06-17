import { isLoggedIn, readConfig } from "../config.js";
import type { StructuredOutput } from "../output.js";

/**
 * Content-first home view; doubles as the SessionStart payload. Must never throw and must
 * not block on the network (live state lands in plan 04). Degrades to onboarding when no
 * credentials are stored.
 */
export async function homeCommand(): Promise<StructuredOutput> {
  const cfg = readConfig();

  if (!isLoggedIn(cfg)) {
    return {
      status: "not logged in",
      help: [
        "Run `otter-axi auth login` to connect your Otter account (one-time browser approval)",
      ],
    };
  }

  const account = cfg.user?.email ?? cfg.user?.name ?? "connected";
  return {
    status: "logged in",
    account,
    help: [
      'Run `otter-axi search "<query>" --after 30d` to find meetings',
      "Run `otter-axi search --after 2026/05/01 --before 2026/05/07` to browse a date range",
      "Run `otter-axi fetch <id>` to pull a transcript",
    ],
  };
}
