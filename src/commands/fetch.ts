import { writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { AxiError } from "axi-sdk-js";
import { hasFlag, parseArgs, strFlag } from "../flags.js";
import { fetchTranscript } from "../otter/client.js";
import { truncateCell } from "../output.js";
import {
  parseTranscript,
  segmentsToCsv,
  segmentsToTsv,
} from "../transcript.js";
import type { StructuredOutput } from "../output.js";

export const FETCH_HELP = `usage: otter-axi fetch <id|url> [output-mode]
args:
  <id|url>          conversation slug or an https://otter.ai/u/<id> URL
output modes (at most one; default is a preview):
  --full            print the entire verbatim transcript to stdout (for piping)
  --text-out <path> write the verbatim transcript text to a file (alias: --out)
  --json-out <path> write parsed segments [{start,speaker,text}] as JSON
  --csv-out <path>  write parsed segments as CSV (start,speaker,text)
  --tsv-out <path>  write parsed segments as TSV
notes:
  otter-axi owns the transcript parse; segment formats are lossless on content.`;

const VALUED = ["out", "text-out", "json-out", "csv-out", "tsv-out"];
const PREVIEW_CHARS = 1200;

/** Normalize a conversation slug or otter.ai URL to a bare id. */
export function normalizeConversationId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/otter\.ai\/u\/([^/?#]+)/i);
  return match ? match[1] : trimmed;
}

function outPath(
  parsed: ReturnType<typeof parseArgs>,
  flag: string,
): string | undefined {
  if (!hasFlag(parsed, flag)) return undefined;
  const p = strFlag(parsed, flag);
  if (!p) {
    throw new AxiError(`--${flag} needs a file path`, "VALIDATION_ERROR", [
      `Run \`otter-axi fetch <id> --${flag} <path>\``,
    ]);
  }
  return p;
}

export async function fetchCommand(args: string[]): Promise<StructuredOutput | string> {
  const parsed = parseArgs(args, { valued: VALUED });
  const raw = parsed.positionals[0];
  if (!raw) {
    throw new AxiError("Missing conversation id or URL", "VALIDATION_ERROR", [
      "Run `otter-axi fetch <id|url>`",
      "Run `otter-axi search …` to find an id",
    ]);
  }
  const id = normalizeConversationId(raw);

  const textPath = outPath(parsed, "text-out") ?? outPath(parsed, "out");
  const jsonPath = outPath(parsed, "json-out");
  const csvPath = outPath(parsed, "csv-out");
  const tsvPath = outPath(parsed, "tsv-out");
  const full = hasFlag(parsed, "full");

  const modeCount =
    [textPath, jsonPath, csvPath, tsvPath].filter((p) => p !== undefined).length +
    (full ? 1 : 0);
  if (modeCount > 1) {
    throw new AxiError("Choose a single output mode", "VALIDATION_ERROR", [
      "Use one of --full | --text-out | --json-out | --csv-out | --tsv-out",
    ]);
  }

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

  // Verbatim text → file (byte-exact, no parsing).
  if (textPath) {
    writeFileSync(textPath, text);
    return { ...meta, format: "text", saved: textPath, bytes: Buffer.byteLength(text) };
  }

  // Parsed segment formats → file.
  if (jsonPath || csvPath || tsvPath) {
    const segments = parseTranscript(text);
    const speakers = [...new Set(segments.map((s) => s.speaker).filter(Boolean))];
    let body: string;
    let path: string;
    let format: string;
    if (jsonPath) {
      body = `${JSON.stringify(segments, null, 2)}\n`;
      path = jsonPath;
      format = "json";
    } else if (csvPath) {
      body = segmentsToCsv(segments);
      path = csvPath;
      format = "csv";
    } else {
      body = segmentsToTsv(segments);
      path = tsvPath as string;
      format = "tsv";
    }
    writeFileSync(path, body);
    return {
      ...meta,
      format,
      saved: path,
      bytes: Buffer.byteLength(body),
      segments: segments.length,
      speakers,
    };
  }

  // Raw transcript to stdout for piping — return a string so the SDK passes it through as-is.
  if (full) return text;

  return {
    ...meta,
    chars: text.length,
    preview: truncateCell(text, PREVIEW_CHARS),
    help: [
      "Pass --text-out/--json-out/--csv-out/--tsv-out <path> to export, or --full to print all",
    ],
  };
}
