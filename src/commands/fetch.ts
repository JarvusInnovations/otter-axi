import { AxiError } from "axi-sdk-js";
import type { StructuredOutput } from "../output.js";

export const FETCH_HELP = `usage: otter-axi fetch <id|url> [flags]
args:
  <id|url>        conversation slug or an https://otter.ai/u/<id> URL
flags:
  --out <path>    write the full transcript to a file (stdout gets a preview)
  --full          print the entire transcript to stdout
Implemented in plan 04 (search & fetch).`;

/** Normalize a conversation slug or otter.ai URL to a bare id. */
export function normalizeConversationId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/otter\.ai\/u\/([^/?#]+)/i);
  return match ? match[1] : trimmed;
}

/** Stub until plan 04 wires the MCP `fetch` tool. */
export async function fetchCommand(_args: string[]): Promise<StructuredOutput> {
  throw new AxiError("fetch is not implemented yet", "UNIMPLEMENTED", [
    "Tracked by plan 04 (search & fetch commands)",
  ]);
}
