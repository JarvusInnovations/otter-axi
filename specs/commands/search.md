# Command: search

Find and browse conversations via the MCP `search` tool.

## Invocation

```
otter-axi search [query...] [flags]
```

`query...` (positional, optional) joins into the `query` string. **Omitting it is valid** —
an empty query plus a date range is browse mode (see
[principles.md](../principles.md#search-is-both-find-and-browse)).

## Flags

| Flag | Maps to | Notes |
|---|---|---|
| `-q, --query <str>` | `query` | Alternative to positional. Give the query **once**: a positional with `--query`/`-q`, or both flags, is a `VALIDATION_ERROR`. Sent as `""` when omitted. |
| `--after <date>` | `created_after` | A calendar date (`2026-05-27` or `2026/5/27`) or a span back from today (`7d`, `2w`, `3m`, `1y`); normalized to `YYYY/MM/DD`. |
| `--before <date>` | `created_before` | Same parsing as `--after`. |
| `--title-contains <str>` | `title_contains` | Space-separated keywords matched against the title. |
| `--in-transcript <str>` | `keywords_in_transcript` | Comma-separated keywords searched within transcript bodies. |
| `--attended-by <name>` | `attended_by` | Comma-separated attendee names (not emails). |
| `--channel <name>` | `channel_name` | Comma-separated channel name(s) to search within. |
| `--folder <name>` | `folder_name` | Comma-separated folder name(s) to search within. |
| `--mine` | `include_shared_meetings=false` | Restrict to meetings the user personally owns/attended (default includes shared). |
| `--limit <n>` | client-side | Cap rows shown; default 20. Must be a positive whole number. |
| `--full` | client-side | Show all rows / untruncated titles + summaries. |

Flags are parsed strictly ([behaviors/invocation.md](../behaviors/invocation.md)): an unknown
flag (`--querry`) is an `UNKNOWN_FLAG` error listing the valid flags, never an unfiltered
search. Invalid values are a `VALIDATION_ERROR` (exit 2), never a silent default:

- a date that is neither form above, or is not on the calendar (`2026-02-30`), naming the flag;
- a `--limit` that is not a positive whole number;
- an empty value for a filter flag (`--folder ""`), which would otherwise run unfiltered.

Date parsing is shared across range flags; relative forms are anchored to today. The upstream
`username` param (used to compute `participation_status`) is filled automatically from the
cached profile — it is not a user-facing flag.

## Data requirements

Calls MCP `search` with the mapped params (omitting absent ones). Requires valid auth
([behaviors/auth.md](../behaviors/auth.md)); refreshes/retries transparently.

## Display rules

- TOON table over the `results` array. Default columns: `id`, `title`, `start` (date from
  `start_time`), `dur` (duration, humanized e.g. `31m`), `summary` (`short_summary`,
  truncated). `action_items` rendered as a count (`ai:N`), not expanded — surfacing, not
  analyzing ([find-and-pull](../principles.md#find-and-pull-nothing-more)). Long titles/summaries
  truncated with the standard marker unless `--full`.
- **No upstream total exists** — `search` returns the full matched set with no count/pagination
  wrapper, so the full count is simply the array length. The header reports `matched: N`; when
  `--limit` caps the rows it also reports `shown: K`. Never invent an `N of M` upstream total.
- **Definitive empty state:** when `results` is empty, say so explicitly and echo the effective
  filters (query + normalized date window + any title/transcript/attendee/channel/folder
  filters) so the agent can see exactly what was searched.
- Browse mode (empty query) is not special-cased in output — same table.

## Actions

Read-only. No mutation.

## Navigation

Each row's `id` feeds `fetch`. Output includes a `help[]` with the next step, e.g.
``Run `otter-axi fetch <id>` to pull a transcript``.

## Principles

**Inherited:**

- [Search is both find and browse](../principles.md#search-is-both-find-and-browse) — empty
  query + `--after/--before` must be as ergonomic as keyword search; do not require `-q`.
- [Find-and-pull, nothing more](../principles.md#find-and-pull-nothing-more) — search ranks
  and filters; it does not summarize or analyze results.
