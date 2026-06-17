import { AxiError } from "axi-sdk-js";
import type { StructuredOutput } from "../output.js";

export const SEARCH_HELP = `usage: otter-axi search [query...] [flags]
flags:
  -q, --query <str>        keyword/semantic query (or pass positionally; may be empty)
  --after <date>           created on/after — ISO (2026-05-01) or relative (7d, 30d)
  --before <date>          created on/before — same formats
  --title-contains <str>   title substring filter
  --attended-by <name>     filter by an attendee
  --limit <n>              cap rows shown (default 20)
  --full                   show all rows, untruncated
notes:
  empty query + a date range is browse mode — list meetings in a window
Implemented in plan 04 (search & fetch).`;

/** Stub until plan 04 wires the MCP `search` tool. */
export async function searchCommand(_args: string[]): Promise<StructuredOutput> {
  throw new AxiError("search is not implemented yet", "UNIMPLEMENTED", [
    "Tracked by plan 04 (search & fetch commands)",
    "Run `otter-axi auth login` first once it lands",
  ]);
}
