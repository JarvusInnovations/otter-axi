# Command: fetch

Pull a full transcript via the MCP `fetch` tool.

## Invocation

```
otter-axi fetch <id|url> [flags]
```

`<id|url>` (required) is a conversation slug (`aBcDeFgHiJkLmNoPqRsTuVwXyZ0`) **or** a full
`https://otter.ai/u/<id>[?…]` URL. A URL is normalized to its `<id>` before calling the tool
(query string and fragments stripped). Missing argument → `AxiError("VALIDATION_ERROR", …)`,
exit 2; no prompt.

## Flags

At most **one** output mode may be given; combining two is a `VALIDATION_ERROR` (exit 2).
Default (no flag) is the preview.

| Flag | Effect |
|---|---|
| `--full` | Print the entire **verbatim** transcript to stdout (raw, for piping). |
| `--text-out <path>` (alias `--out`) | Write the verbatim transcript text to a file. |
| `--json-out <path>` | Write parsed **segments** as a JSON array to a file. |
| `--csv-out <path>` | Write parsed segments as CSV (`start,speaker,text`, RFC-4180 quoted). |
| `--tsv-out <path>` | Write parsed segments as TSV (tab-separated; tabs/newlines in text escaped). |

All `*-out` modes return a confirmation object to stdout (path, byte count, segment count,
distinct speakers) — never the body inline.

## Transcript parsing

The `--json-out`/`--csv-out`/`--tsv-out` modes parse `text` into ordered **segments**; otter-axi
owns this parser so consumers don't re-derive it (see
[Polyfill the missing API](../principles.md#polyfill-the-missing-api)).

- A **segment** is `{ start, speaker, text }` — `start` is the line's `H:MM:SS` timestamp
  (string, no brackets), `speaker` is the label as written (`"Speaker 1"`, or a real name when
  present), `text` is the utterance.
- **Parse rule:** a line matching `^\[(\d+:\d{1,2}:\d{2})\]\s+(.+?):\s?(.*)$` opens a new
  segment. Any line that does **not** match is appended (with its newline) to the current
  segment's `text` — so multi-line utterances, blank lines, and unexpected formatting are
  **preserved, never dropped**. Leading unmatched lines (before the first timestamp) form a
  segment with empty `start`/`speaker`.
- **Lossless:** concatenating segments back (`[start] speaker: text`, original newlines intact)
  reproduces the source. The parse is **best-effort on structure** but **lossless on content** —
  if the upstream format ever diverges, you get fewer/looser segments, not lost text. The
  verbatim `--full`/`--text-out` paths are always exact.

## Data requirements

Calls MCP `fetch` with `{ id }`. Requires valid auth ([behaviors/auth.md](../behaviors/auth.md));
refreshes/retries transparently. Output (spike-confirmed): `{ id, title, url, text, metadata }`
where `text` is the full transcript as one string formatted `[H:MM:SS] Speaker N: …` per line,
and `metadata` is `{ action_items, duration, short_summary, start_time }`.

## Display rules

- Transcripts are large. **Default: preview-to-stdout, full-to-file** (the metabase-axi
  pattern). Stdout shows the metadata header (`id`, `title`, `url`, `start` from `start_time`,
  `dur`, `short_summary`) plus a capped preview of `text` with a `…(truncated, N chars total)`
  marker. `action_items` shown as a count, not expanded.
- `--text-out`/`--out <path>` writes the complete verbatim `text` to the file; `--full` prints
  it to stdout. Both are byte-exact — no re-segmenting or relabeling.
- `--json-out`/`--csv-out`/`--tsv-out <path>` writes the parsed segments to the file and returns
  a confirmation `{ id, title, format, saved, bytes, segments, speakers }`. The body is never
  dumped inline.
- **Not found / invalid id:** definitive `AxiError` naming the id, with a `help[]` pointing
  back to `search`.

## Actions

Read-only. No mutation.

## Navigation

Terminal in the find→pull flow. A detail/transcript view; per AXI convention it omits the
next-step `help[]` that list views carry, except the not-found error path.

## Principles

**Inherited:**

- [Polyfill the missing API](../principles.md#polyfill-the-missing-api) — the `*-out` segment
  formats exist because the MCP hands back a raw text blob where structured data should be;
  otter-axi owns the lossless parse so consumers don't. Structure/format is ours.
- [Find-and-pull, nothing more](../principles.md#find-and-pull-nothing-more) — the default stays
  the transcript **as-is**; `fetch` never does semantic reshaping (summarizing, relabeling,
  dropping). Meaning is the consumer's.
