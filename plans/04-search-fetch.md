---
status: planned
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

- [ ] `otter-axi search -q "roadmap review" --after 30d` returns a populated TOON table
      (columns `id,title,start,dur,summary,ai:N`; header count `N`, never `N of M`).
- [ ] `otter-axi search --after 2026/05/01 --before 2026/05/07` (empty query, browse) works.
- [ ] The extra filters map through: `--in-transcript`, `--channel`, `--folder`, `--mine`;
      `username` is auto-filled from the cached profile (not a flag).
- [ ] Zero-result search prints a definitive empty state echoing the effective filters.
- [ ] `otter-axi fetch <id>` previews; `--out` writes full transcript + confirmation; `--full`
      prints the whole body.
- [ ] `otter-axi fetch https://otter.ai/u/<id>?tab=chat` normalizes the URL and succeeds.
- [ ] Missing fetch arg exits 2; unknown id yields a definitive error → `search`.
- [ ] `home` renders live account state and degrades cleanly when logged out.

## Risks / unknowns

- If `search` output lacks a total count, the count label becomes "N shown" rather than
  "N of M" — acceptable; reflect actual semantics from plan 01.
- Transcript size/formatting may need a larger preview cap than the default — tune from real
  `fetch` output.

## Notes

_(closeout)_

## Follow-ups

_(closeout)_
