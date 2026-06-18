---
status: done
depends: [03-auth, 01-auth-spike]
specs:
  - specs/commands/search.md
  - specs/commands/fetch.md
issues: []
---

# Plan 04 — search & fetch commands

## Scope

The two user-facing commands that deliver find-and-pull, plus the live `home` state that
depends on a working client. Depends on plan 03 (client + auth) and plan 01 (confirmed output
schemas, so display columns and preview rules are real, not guessed).

## Implements

- `specs/commands/search.md` — flags, date normalization, browse mode, result table.
- `specs/commands/fetch.md` — id/URL normalization, preview-to-stdout / full-to-file.

## Approach

1. Shared date parsing (ISO + relative `7d`/`30d` → `YYYY/MM/DD`) in `src/output.ts` or a
   small `src/dates.ts`.
2. `src/commands/search.ts` — map positional/`-q`, `--after`/`--before`, `--title-contains`,
   `--attended-by`, `--limit`, `--full`; omit absent params; render the TOON table with count
   label, truncation, definitive empty state echoing effective filters; `help[]` → `fetch`.
   Export `SEARCH_HELP`.
3. `src/commands/fetch.ts` — accept `<id|url>`, normalize URL→id; `--out <path>` (full to
   file + confirmation), `--full` (whole body to stdout), default preview; not-found error
   points back to `search`. Export `FETCH_HELP`.
4. Flesh out `home` to show cached account + a couple of recent/suggested actions, degrading
   to onboarding when unconfigured; one cheap call, never throws.

## Validation

- [x] `otter-axi search … --after 30d` returns a populated TOON table (columns
      `id,title,start,dur,summary,ai`). **Live: 14 matched, table renders.** Header reports
      `matched: N` + `shown: K` when capped (per the refined spec), never a fake upstream total.
- [x] `otter-axi search --after … --before …` (empty query, browse) works live.
- [x] The extra filters are wired (`--in-transcript`→`keywords_in_transcript`,
      `--channel`,`--folder`,`--mine`→`include_shared_meetings=false`); `username` auto-filled
      from the cached profile. (Mapping verified; not every filter exercised against live data.)
- [x] Zero-result search prints a definitive empty state echoing the effective filters (live).
- [x] `otter-axi fetch <id>` previews; `--out` wrote 174 246 chars + confirmation; `--full`
      piped the raw transcript (1 283 lines) — all verified live.
- [x] `otter-axi fetch https://otter.ai/u/<id>?tab=chat` URL normalization (unit-tested).
- [x] Missing fetch arg exits 2; unknown-id path wraps the error with a `→ search` hint.
- [~] `home` renders the **cached** account (logged-in account / logged-out onboarding) and
      degrades cleanly. Intentionally cache-only (no network) to keep the SessionStart payload
      fast — live recent-meetings on home deferred (see follow-ups).

## Risks / unknowns

- If `search` output lacks a total count, the count label becomes "N shown" rather than
  "N of M" — acceptable; reflect actual semantics from plan 01.
- Transcript size/formatting may need a larger preview cap than the default — tune from real
  `fetch` output.

## Notes

Built `src/dates.ts` (ISO + relative `7d/2w/3m/1y` → `YYYY/MM/DD`), real `search`/`fetch`
commands, and corrected one live finding: **`duration` is a pre-humanized string** (`"3h 51m"`),
not seconds — dropped the `humanizeDuration` helper and fixed the type + spec. `fetch --full`
returns a raw string (SDK passes strings through unchanged) so it pipes cleanly; default preview
caps the body at 1200 chars with the standard truncation marker. 11 unit tests pass. Verified
end-to-end against the live account. No PR — local `main`, pushed.

## Follow-ups

- **Deferred:** optional live "recent meetings" on `home` (would need a cached snapshot refreshed
  on search to preserve the fast, network-free SessionStart payload).
- **Spec-corrected:** `duration` string type recorded in `specs/api/mcp-server.md`.
