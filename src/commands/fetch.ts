import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { Buffer } from "node:buffer";
import { AxiError } from "axi-sdk-js";
import { exportsDir } from "../config.js";
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
  <id|url>           conversation slug or an https://otter.ai/u/<id> URL
output modes (at most one; default is a preview):
  --full             print the entire verbatim transcript to stdout (for piping)
  --text-out[=path]  write the verbatim transcript text to a file (alias: --out)
  --json-out[=path]  write parsed segments [{start,speaker,text}] as JSON
  --csv-out[=path]   write parsed segments as CSV (start,speaker,text)
  --tsv-out[=path]   write parsed segments as TSV
notes:
  Path is optional: bare flag auto-writes ~/.config/otter-axi/exports/<ts>-<id>.<ext>;
  use --json-out=path for an explicit location. Writing a file is additive — stdout keeps
  the preview and adds wrote/columns/jq help. otter-axi owns the lossless transcript parse.`;

const PREVIEW_CHARS = 1200;

type OutFormat = "text" | "json" | "csv" | "tsv";
const EXT: Record<OutFormat, string> = { text: "txt", json: "json", csv: "csv", tsv: "tsv" };

// Flags that select a file-export format. NOT in `valued`, so a bare flag is boolean
// (→ auto-path) and an explicit path uses `--json-out=path` (avoids eating the <id> positional).
const OUT_FLAGS: Array<{ flag: string; format: OutFormat }> = [
  { flag: "json-out", format: "json" },
  { flag: "csv-out", format: "csv" },
  { flag: "tsv-out", format: "tsv" },
  { flag: "text-out", format: "text" },
  { flag: "out", format: "text" }, // back-compat alias
];

/** Normalize a conversation slug or otter.ai URL to a bare id. */
export function normalizeConversationId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/otter\.ai\/u\/([^/?#]+)/i);
  return match ? match[1] : trimmed;
}

function expandPath(p: string): string {
  const e = p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
  return isAbsolute(e) ? e : resolve(e);
}

/** Explicit path (expanded), or an auto path under the exports dir keyed by id + timestamp. */
export function resolveExportPath(
  explicit: string | undefined,
  format: OutFormat,
  id: string,
  now: Date = new Date(),
): string {
  if (explicit) return expandPath(explicit);
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return join(exportsDir(), `${stamp}-${id}.${EXT[format]}`);
}

function jqHelp(format: OutFormat, path: string): string | undefined {
  if (format === "json") {
    return `Run \`jq -r '.[] | "[\\(.start)] \\(.speaker): \\(.text)"' ${path}\` to process the segments`;
  }
  return undefined;
}

export async function fetchCommand(args: string[]): Promise<StructuredOutput | string> {
  const parsed = parseArgs(args);
  const raw = parsed.positionals[0];
  if (!raw) {
    throw new AxiError("Missing conversation id or URL", "VALIDATION_ERROR", [
      "Run `otter-axi fetch <id|url>`",
      "Run `otter-axi search …` to find an id",
    ]);
  }
  const id = normalizeConversationId(raw);

  const present = OUT_FLAGS.filter((m) => hasFlag(parsed, m.flag));
  const full = hasFlag(parsed, "full");
  const distinctFormats = new Set(present.map((m) => m.format));
  if (distinctFormats.size + (full ? 1 : 0) > 1) {
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

  // Raw transcript to stdout for piping — return a string so the SDK passes it through as-is.
  if (full) return text;

  const base: StructuredOutput = {
    id: t.id ?? id,
    title: t.title ?? "",
    url: t.url ?? `https://otter.ai/u/${t.id ?? id}`,
    start: (t.metadata?.start_time ?? "").slice(0, 10),
    dur: t.metadata?.duration ?? "—",
    summary: t.metadata?.short_summary ?? "",
    action_items: Array.isArray(t.metadata?.action_items)
      ? t.metadata.action_items.length
      : 0,
    chars: text.length,
    preview: truncateCell(text, PREVIEW_CHARS),
  };

  if (present.length === 0) {
    return {
      ...base,
      help: [
        "Export with --json-out / --csv-out / --tsv-out / --text-out (add =path for an explicit location)",
        "--full prints the whole verbatim transcript to stdout",
      ],
    };
  }

  // File export — additive: keep the preview, write the file, add wrote/columns/jq help.
  const format = present[0].format;
  const explicit = present.map((m) => strFlag(parsed, m.flag)).find((v) => v !== undefined);
  const path = resolveExportPath(explicit, format, id);
  mkdirSync(dirname(path), { recursive: true });

  let body: string;
  const extra: StructuredOutput = {};
  if (format === "text") {
    body = text;
  } else {
    const segments = parseTranscript(text);
    body =
      format === "json"
        ? `${JSON.stringify(segments, null, 2)}\n`
        : format === "csv"
          ? segmentsToCsv(segments)
          : segmentsToTsv(segments);
    extra.segments = segments.length;
    extra.columns = "start, speaker, text";
  }
  writeFileSync(path, body);

  const help: string[] = [];
  const jq = jqHelp(format, path);
  if (jq) help.push(jq);

  return { ...base, wrote: path, bytes: Buffer.byteLength(body), ...extra, ...(help.length ? { help } : {}) };
}
