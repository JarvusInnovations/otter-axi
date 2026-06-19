---
status: done
depends: [07-fetch-export-formats]
specs:
  - specs/commands/fetch.md
issues: []
---

# Plan 08 — align fetch `--*-out` to the AXI side-channel-file convention

## Scope

Bring `fetch`'s export flags into line with the AXI convention
([axi#32](https://github.com/kunchenguid/axi/issues/32), as implemented in `metabase-axi`):
optional/auto path, additive output, and a `jq` follow-up hint. v1.0.x required an explicit
path and replaced the preview with a bare confirmation — both off-convention.

## Implements

- `specs/commands/fetch.md` — the `[=path]` flags, optional auto-path, additive output rules.

## Approach

1. `config.ts` — add `exportsDir()` (`<configDir>/exports`).
2. `fetch.ts` — keep the `*-out` flags out of `parseArgs` `valued` so a bare flag is boolean
   (→ auto-path) and an explicit path uses the `=path` form (won't swallow the `<id>`
   positional). `resolveExportPath(explicit, format, id)` → explicit (with `~`/relative
   expansion) or `<exportsDir>/<ISO-ts>-<id>.<ext>`. Output is **additive**: keep the metadata +
   preview, add `wrote`/`bytes`, and for segment formats `segments` + `columns` + a `jq` `help`
   line. `--text-out`/`--out` stay (alias) so this is non-breaking.
3. Update README + SKILL.md examples to the `[=path]` form.
4. Tests for `resolveExportPath` (explicit absolute/`~`/relative + auto-path naming).

## Validation

- [x] Bare `fetch <id> --json-out` auto-wrote `~/.config/otter-axi/exports/<ts>-<id>.json` (1283
      segments), kept the preview, and added `wrote`/`segments`/`columns`/`jq help` (live).
- [x] `fetch <id> --json-out=/tmp/seg.json` wrote the explicit path (valid JSON, 1283 segments).
- [x] `--csv-out`/`--tsv-out`/`--text-out` behave the same (text omits `columns`/`jq`).
- [x] Two output modes at once → `VALIDATION_ERROR` (exit 2).
- [x] `bun run build` + `bun run test` green (22 tests); live bare + explicit verified.

## Risks / unknowns

- Explicit path must use the `=` form (`--json-out=path`); a space-separated path would be read
  as a positional. Documented in help + spec; matches metabase's `[=path]` notation.

## Notes

Added `exportsDir()` + `resolveExportPath()` (exported for tests). Kept the `*-out` flags out of
`valued` so bare = auto-path and `=path` = explicit (avoids eating the `<id>` positional — the
reason metabase uses `[=path]`). Output is now additive (preview + `wrote`/`columns`/`jq`),
matching axi#32. `--out`/`--text-out` retained → non-breaking, so this ships as a **minor**
(v1.1.0). Live-verified against the real 174 KB transcript. PR'd into develop.

## Follow-ups

- **None.** Convention now matches metabase-axi / axi#32.
