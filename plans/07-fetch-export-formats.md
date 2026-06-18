---
status: done
depends: [04-search-fetch]
specs:
  - specs/commands/fetch.md
  - specs/principles.md
issues: []
---

# Plan 07 — fetch export formats (owned transcript parser)

## Scope

Add structured export formats to `fetch` so an agent can move a transcript elsewhere without
hand-rolling a parser: `--json-out` / `--csv-out` / `--tsv-out` (parsed segments) plus
`--text-out` (verbatim, alias of `--out`). otter-axi owns one tested, lossless transcript
parser. Verbatim text stays the default; structured forms are opt-in.

## Implements

- `specs/commands/fetch.md` — the output-mode flags, the segment model, the parse rule.
- `specs/principles.md` — the "lossless format conversion is pulling" refinement (the parser
  boundary is owned here on purpose).

## Approach

1. `src/transcript.ts` — `parseTranscript(text): Segment[]` where `Segment = { start, speaker,
   text }`. New segment on a line matching `^\[(\d+:\d{1,2}:\d{2})\]\s+(.+?):\s?(.*)$`;
   non-matching lines append (with newline) to the current segment — lossless, never drops.
   Leading unmatched text → a segment with empty `start`/`speaker`. Plus `toCsv`/`toTsv`
   serializers (RFC-4180 quoting for CSV; tab/newline escaping for TSV).
2. `src/commands/fetch.ts` — parse the output-mode flags (`--full`, `--text-out`/`--out`,
   `--json-out`, `--csv-out`, `--tsv-out`); reject more than one (`VALIDATION_ERROR`). For a
   `*-out` segment format: parse, serialize, write the file, return `{ id, title, format, saved,
   bytes, segments, speakers }`. Keep verbatim text paths byte-exact.
3. Unit tests (`test/transcript.test.ts`): single/multi-line utterances, named speaker, leading
   junk, blank lines, round-trip losslessness, CSV quoting of commas/quotes/newlines.
4. Live-verify against a real transcript: segment count sane, round-trip == source, CSV opens
   clean.

## Validation

- [x] `fetch <id> --json-out` writes a JSON array of `{start,speaker,text}`; confirmation reports
      `segments`/`speakers` (live: **1283 segments**, valid JSON, first segment well-formed).
- [x] `--csv-out` / `--tsv-out` produce well-formed escaped files (live: CSV header + 1284 rows;
      RFC-4180 quoting unit-tested).
- [x] `--text-out` (and `--out`) write byte-exact verbatim text (live: 174 247 bytes).
- [x] Two output modes at once → `VALIDATION_ERROR` (exit 2).
- [x] **Parser round-trips losslessly** — `segmentsToText(parse(x)) === x`, byte-identical on the
      real 174 KB transcript (live) and in unit tests.
- [x] Unit tests cover multi-line utterances, named speakers, leading junk, round-trip, CSV
      escaping (18 tests total, up from 11).
- [x] `bun run build` + `bun run test` green; live `fetch --json-out` on a real meeting works.

## Risks / unknowns

- Transcript format sampled from one account — the continuation-line fallback keeps it lossless
  if the format diverges, but segment boundaries could be coarser than ideal. Verbatim paths are
  unaffected.
- Speakers are generic (`Speaker N`) in observed data; the parser captures whatever label is
  written (incl. real names) without assuming.

## Notes

Built `src/transcript.ts` (`parseTranscript` + `segmentsToText`/`segmentsToCsv`/`segmentsToTsv`),
owned and unit-tested so consumers don't re-derive the `[ts] speaker:` regex. The mid-flight
user framing — "we're polyfilling needing to use their MCP instead of a proper API; we own the
nuances of using the MCP as an API" — was promoted to a new **"Polyfill the missing API"**
principle in `specs/principles.md` (the lossless-conversion rule folded into it), which also
records *why search gets no export formats* (its results are already clean/tabular). `fetch.md`
now references both that principle and find-and-pull. The `--full` vs `--text-out` 1-byte diff is
the SDK's stdout trailing newline, not data loss.

## Follow-ups

- **None.** Search export formats are explicitly out of scope per the polyfill principle (no
  API-shape nuance to fill there).
