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
| `--text-out[=path]` (alias `--out`) | Write the verbatim transcript text to a file. |
| `--json-out[=path]` | Write parsed **segments** as a JSON array to a file. |
| `--csv-out[=path]` | Write parsed segments as CSV (`start,speaker,text`, RFC-4180 quoted). |
| `--tsv-out[=path]` | Write parsed segments as TSV (tab-separated; tabs/newlines in text escaped). |

The `*-out` flags follow the AXI side-channel-file convention
([axi#32](https://github.com/kunchenguid/axi/issues/32), as in `metabase-axi`):

- **Path is optional.** A bare flag auto-writes
  `<os-tmpdir>/otter-axi/<ISO-timestamp>-<id>.<ext>` — an auto-generated export is **ephemeral
  scratch**, so it goes in the OS temp dir (`/tmp` on Linux, `$TMPDIR` on macOS, which the OS
  prunes), never under `~/.config` (durable state nothing prunes). `--json-out=path` (the `=`
  form, so it doesn't swallow the `<id>` positional) writes an explicit location (`~/`, relative,
  and absolute paths accepted), for when the file should persist.
- **Auto-generated export files are written `0600`** (owner-only) — transcripts are sensitive and
  the OS temp dir is world-readable on some platforms. An explicit `--<fmt>-out=path` is the
  caller's responsibility and uses the default umask.
- **Writing is additive, never destructive to the preview.** stdout keeps the normal metadata +
  transcript preview and *adds* `wrote: <path>`, `bytes`, and — for the segment formats —
  `segments`, `columns: start, speaker, text`, plus a `help[]` `jq` example pointed at the file
  so an agent can query it without reading it first. `--text-out` adds only `wrote`/`bytes`.
- One format per invocation; no generic extension-sniffing `--out` (the `--out` alias maps to
  `--text-out` explicitly).

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
- A `*-out` flag is **additive**: the preview above is still shown, plus `wrote: <path>`,
  `bytes`, and (for the segment formats) `segments`, `columns: start, speaker, text`, and a
  `help[]` `jq` line pointed at the file. The body is never dumped inline. `--text-out` writes
  byte-exact verbatim `text`; the segment formats write parsed segments.
- `--full` prints the whole verbatim `text` to stdout (byte-exact, for piping) — no preview.
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
