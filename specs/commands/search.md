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
| `-q, --query <str>` | `query` | Alternative to positional; positional wins if both given. |
| `--after <date>` | `created_after` | Accepts ISO (`2026-05-27`) or relative (`7d`, `30d`); normalized to `YYYY/MM/DD`. |
| `--before <date>` | `created_before` | Same parsing as `--after`. |
| `--title-contains <str>` | `title_contains` | |
| `--attended-by <name>` | `attended_by` | |
| `--limit <n>` | client-side | Cap rows shown; default per output kit (e.g. 20). |
| `--full` | client-side | Show all rows / untruncated titles. |

Date parsing is shared with any future range flags; relative forms are anchored to today.

## Data requirements

Calls MCP `search` with the mapped params (omitting absent ones). Requires valid auth
([behaviors/auth.md](../behaviors/auth.md)); refreshes/retries transparently.

## Display rules

- TOON table of results. Default columns: `id`, `title`, `created` (date), and attendee/
  count fields **as confirmed by the spike**. Long titles truncated with the standard marker.
- Header carries a count label (`N of M` when the result count is known; the spike confirms
  whether the upstream returns a total / supports pagination).
- **Definitive empty state:** when zero results, say so explicitly and echo the effective
  filters (query + normalized date window + any title/attendee filters) so the agent can see
  what was searched.
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
