---
status: in-progress
depends: [09-exports-to-tmpdir]
specs:
  - specs/behaviors/invocation.md
  - specs/commands/fetch.md
  - specs/commands/search.md
  - specs/behaviors/auth.md
  - specs/architecture.md
issues: [13]
---

# Plan 10 — strict flag parsing, `formatError`, and the `--out` retirement

## Scope

Bring the invocation surface in line with the vendored `jarvus-axi` house style
(`.agents/skills/jarvus-axi/`), covering the "Should fix" items of issue #13 and the two small
hardening items:

- **Strict per-command parser.** `src/flags.ts` `parseArgs` never rejected anything, so
  `search --querry x` ran unfiltered. Replace it with the house parser: unknown flags, extra
  positionals, missing values and invalid values fail with exit 2 before any network call.
- **`formatError`.** `USAGE` and `UNKNOWN_FLAG` must exit 2 and an unexpected throw must be
  wrapped as `INTERNAL_ERROR` with a `doctor` hint; the SDK default does neither.
- **`--out` retired** (breaking). It was a silent alias for `--text-out`; it now fails with a
  hint naming `--text-out`.
- **Stale `fetch --help`.** It described `~/.config/otter-axi/exports/`; plan 09 moved the auto
  path to the OS temp dir and the help was never updated.
- **Config file mode re-set on every write**, and a **no-credentials CI smoke test** of the
  built binary.

Out of scope (issue #13 "Smaller", left for their own plans): generating `--help`, the home
hints and the skill from one `reference.ts` with a `docs:check` gate; the `--version` fast path
(needs an `axi-sdk-js` bump to a release that ships `axi-sdk-js/fast-path`).

## Implements

- `specs/behaviors/invocation.md` — new: the parsing rules, retired-flag hints, error codes and
  exit codes.
- `specs/commands/fetch.md` — `=`-only export paths, `--out` retired, missing id is `USAGE`.
- `specs/commands/search.md` — query given once, validated dates / `--limit` / filter values.
- `specs/behaviors/auth.md` — subcommand and flag validation.
- `specs/architecture.md` — module notes, the CI smoke test.

## Approach

1. `src/flags.ts` — port `parseFlags` / `parseSubcommand` / `FlagSpec` from nexudus-axi (the
   canonical source), minus its global `--space` selector. Add an `optional` flag kind for the
   `*-out` exports (the `=`-only handling gws-axi has): bare is an auto path, `=path` is
   explicit, and a space-separated path is a `USAGE` error naming the `=` form. Let a
   `deprecated` hint be a function of the `=` value so `--out=t.txt` can answer
   `--text-out=t.txt`. Only `--<letter>` starts a flag, plus short names a command declares
   or hints (`-q`, `-n`, `-h`). Declare every command in one table.
2. Commands parse through it: `auth` and `setup` via `parseSubcommand`, `doctor` with an empty
   spec, `search` and `fetch` with theirs. `search` validates `--limit`, empty filter values
   and a query given twice; `normalizeDate` rejects off-calendar dates and names the flag.
3. `src/cli.ts` — port `formatError` from nexudus-axi and pass it to `runAxiCli`.
4. `fetch` help text corrected; `--out` moved to the `deprecated` table.
5. `src/config.ts` — `chmod 0600` after each write of `config.json` and `pending-auth.json`.
6. CI — smoke-test `search`, `search --bogus` and `fetch` on the built binary with an empty
   config dir.
7. Tests: parser unit tests, a sweep of every command with `--bogus`, a declared-flags versus
   `--help` comparison in both directions, `formatError` unit tests, config modes. All run
   against an empty temp config dir.

## Validation

- [ ] `search --querry x` exits 2 with `code: UNKNOWN_FLAG` and lists the valid flags.
- [ ] Every command in the flag table rejects `--bogus` with exit 2 (sweep test).
- [ ] Declared flags and each command's `--help` agree in both directions.
- [ ] `fetch <id> --out` and `--out=path` exit 2 with a hint naming `--text-out[=path]`.
- [ ] `fetch --json-out <id>` keeps `<id>` as the id; `fetch <id> --json-out t.json` is a
      `USAGE` error naming `--json-out=t.json`.
- [ ] `fetch --help` names the OS temp dir and no `~/.config` path.
- [ ] `formatError`: `USAGE` / `UNKNOWN_FLAG` / `VALIDATION_ERROR` exit 2; a plain `Error`
      becomes `INTERNAL_ERROR`, exit 1, with a `doctor` hint and no stack.
- [ ] `search --after 2026-02-30`, `--limit ten` and `--folder ""` are `VALIDATION_ERROR`s.
- [ ] `config.json` loosened to `0644` is `0600` again after the next write.
- [ ] Lint, format check, type check, build and tests green; the CI smoke script passes locally.

## Risks / unknowns

- **Breaking:** `--out` stops working, and invocations that used to be tolerated (unknown
  flags, stray arguments, an unparseable `--limit`) now exit 2. That is the point, but it
  needs a major version bump.
- A missing `fetch` id changes code from `VALIDATION_ERROR` to `USAGE`; the exit status (2) is
  unchanged.
