---
status: done
depends: [08-fetch-out-optional-path]
specs:
  - specs/commands/fetch.md
issues: []
---

# Plan 09 — auto-export to the OS temp dir (0600), not the config dir

## Scope

Move auto-pathed `fetch` exports from `~/.config/otter-axi/exports/` to the OS temp dir, and
write auto-generated files owner-only (`0600`). Plan 08 copied metabase-axi's `exportsDir()`
(`<configDir>/exports`) verbatim; an auto-generated export is ephemeral scratch, so it belongs in
the OS temp dir (OS-pruned), not a *config* directory that nothing prunes. **Matched to
metabase-axi `c184ede`** (reviewed after the owner caught the same issue there).

## Implements

- `specs/commands/fetch.md` — auto-path location + `0600` on auto-generated files.

## Approach

1. `fetch.ts` — `resolveExportPath` auto path → `join(os.tmpdir(), "otter-axi", "<ts>-<id>.<ext>")`
   (inlined; `exportsDir()` dropped from `config.ts`, matching metabase). New `writeExport(path,
   body, auto)` helper: `writeFileSync(..., { mode: 0o600 })` only when the path was
   auto-generated. Explicit `=path` unchanged (default umask).
2. Update `test/fetch.test.ts` (auto-path under tmpdir + `0600`), README, SKILL.md, spec.

## Validation

- [x] `resolveExportPath(undefined, …)` returns `<os.tmpdir()>/otter-axi/<ts>-<id>.<ext>` (unit).
- [x] `writeExport(p, …, true)` writes `0600`; explicit (`false`) uses default umask (unit).
- [x] Live: bare `fetch <id> --json-out` wrote `-rw-------` under the OS temp dir.
- [x] Explicit `=path` still honored; `exportsDir()` removed (no stale refs); build + 23 tests green.

## Risks / unknowns

- `os.tmpdir()` resolves to `$TMPDIR` on macOS (a `/var/folders/…` path), not literal `/tmp` —
  same as metabase-axi; portable + correct.
- `0600` is masked by umask; survives the common `022`. (metabase verified the same.)

## Notes

Corrects a plan-08 deviation (followed metabase's old `~/.config/.../exports` reference impl
rather than the temp-dir intent), then aligned to metabase-axi's own fix (`c184ede`) — same
location and the `0600` privacy hardening, which matters more here since the payload is a
transcript. Ships in the same unreleased v1.1.0.

## Follow-ups

- **None.**
