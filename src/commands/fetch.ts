import { writeFileSync } from "node:fs";
import { AxiError } from "axi-sdk-js";
import { hasFlag, parseArgs, strFlag } from "../flags.js";
import { fetchTranscript } from "../otter/client.js";
import { truncateCell } from "../output.js";
import type { StructuredOutput } from "../output.js";

export const FETCH_HELP = `usage: otter-axi fetch <id|url> [flags]
args:
  <id|url>        conversation slug or an https://otter.ai/u/<id> URL
flags:
  --out <path>    write the full transcript to a file (stdout gets a preview)
  --full          print the entire transcript to stdout (raw, for piping)`;

const PREVIEW_CHARS = 1200;

/** Normalize a conversation slug or otter.ai URL to a bare id. */
export function normalizeConversationId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/otter\.ai\/u\/([^/?#]+)/i);
  return match ? match[1] : trimmed;
}

export async function fetchCommand(args: string[]): Promise<StructuredOutput | string> {
  const parsed = parseArgs(args, { valued: ["out"] });
  const raw = parsed.positionals[0];
  if (!raw) {
    throw new AxiError("Missing conversation id or URL", "VALIDATION_ERROR", [
      "Run `otter-axi fetch <id|url>`",
      "Run `otter-axi search …` to find an id",
    ]);
  }
  const id = normalizeConversationId(raw);

  let t;
  try {
    t = await fetchTranscript(id);
  } catch (e) {
    const err = e as AxiError;
    throw new AxiError(err.message, err.code ?? "UPSTREAM", [
      ...(err.suggestions ?? []),
      `Run \`otter-axi search …\` to find a valid id (checked: ${id})`,
    ]);
  }

  const text = t.text ?? "";
  const meta = {
    id: t.id ?? id,
    title: t.title ?? "",
    url: t.url ?? `https://otter.ai/u/${t.id ?? id}`,
    start: (t.metadata?.start_time ?? "").slice(0, 10),
    dur: t.metadata?.duration ?? "—",
    summary: t.metadata?.short_summary ?? "",
    action_items: Array.isArray(t.metadata?.action_items)
      ? t.metadata.action_items.length
      : 0,
  };

  const out = strFlag(parsed, "out");
  if (out) {
    writeFileSync(out, text);
    return { ...meta, saved: out, chars: text.length };
  }

  // Raw transcript to stdout for piping — return a string so the SDK passes it through as-is.
  if (hasFlag(parsed, "full")) return text;

  return {
    ...meta,
    chars: text.length,
    preview: truncateCell(text, PREVIEW_CHARS),
    help: ["Pass --out <path> to save the full transcript, or --full to print it all"],
  };
}
