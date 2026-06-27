/**
 * Transcript parser. otter-axi owns this so consumers don't re-derive a fragile `[ts] speaker:`
 * regex (see specs/principles.md). The parse is best-effort on *structure* but lossless on
 * *content*: every character of the source survives — unrecognized lines are preserved as
 * continuations of the current segment, never dropped.
 */

export interface Segment {
  /** `H:MM:SS` timestamp without brackets, or "" for leading pre-timestamp text. */
  start: string;
  /** Speaker label as written ("Speaker 1" or a real name), or "" when unknown. */
  speaker: string;
  text: string;
}

const LINE = /^\[(\d+:\d{1,2}:\d{2})\]\s+(.+?):\s?(.*)$/;

/** Parse an Otter transcript string into ordered segments (lossless on content). */
export function parseTranscript(transcript: string): Segment[] {
  const segments: Segment[] = [];
  let current: Segment | undefined;

  const lines = transcript.split("\n");
  lines.forEach((line, i) => {
    const m = line.match(LINE);
    if (m) {
      current = { start: m[1], speaker: m[2], text: m[3] };
      segments.push(current);
      return;
    }
    // Continuation / blank / pre-timestamp line: append verbatim to the current segment.
    if (!current) {
      current = { start: "", speaker: "", text: line };
      segments.push(current);
    } else {
      current.text += `\n${line}`;
    }
    void i;
  });

  return segments;
}

/** Reassemble segments into the original transcript text (inverse of parseTranscript). */
export function segmentsToText(segments: Segment[]): string {
  return segments
    .map((s) => (s.start ? `[${s.start}] ${s.speaker}: ${s.text}` : s.text))
    .join("\n");
}

function csvField(value: string): string {
  // RFC 4180: quote when the field contains a comma, quote, CR or LF; double internal quotes.
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Serialize segments to RFC-4180 CSV with a `start,speaker,text` header. */
export function segmentsToCsv(segments: Segment[]): string {
  const rows = ["start,speaker,text"];
  for (const s of segments) {
    rows.push([s.start, s.speaker, s.text].map(csvField).join(","));
  }
  return `${rows.join("\r\n")}\r\n`;
}

/** Serialize segments to TSV; tabs/newlines inside text are escaped so rows stay one-per-line. */
export function segmentsToTsv(segments: Segment[]): string {
  const esc = (v: string) =>
    v.replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\r?\n/g, "\\n");
  const rows = ["start\tspeaker\ttext"];
  for (const s of segments) {
    rows.push([s.start, s.speaker, s.text].map(esc).join("\t"));
  }
  return `${rows.join("\n")}\n`;
}
