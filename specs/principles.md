# Principles

The project's philosophy, written as decisive rules. Each picks a side of a real
trade-off so an implementer resolves unspecified cases the way the author would.

## Find-and-pull, nothing more

otter-axi exists to **locate transcripts and pull their text**. Analysis — summarizing,
extracting action items, scoring sentiment, syncing to a CRM — is the *consumer's* job
(the agent or human reading our output), never the tool's.

> Why: the user explicitly wants to do all analysis themselves and found the upstream's
> 3-tool surface (search + fetch) sufficient. Every feature we add past find-and-pull is
> surface we must maintain and a place for the tool to impose its own opinions on data the
> user wants raw.

This rules out: summary/insight/outline commands, transcript post-processing, dedup or
"smart matching," and any write operation. When tempted to add a capability, ask whether it
helps *find* a conversation or *pull* its transcript. If not, it doesn't belong here.

## One-time auth, headless forever after

The interactive OAuth approval happens **exactly once**, at `auth login`. Every other
invocation must run with **zero prompts**, using stored and silently-refreshed tokens. A
command (other than `auth login`) that would block on user interaction is a bug.

> Why: this is the whole reason to build otter-axi instead of using the hosted MCP connector
> directly — the in-chat connector re-prompts and can't be scripted. Headless reuse from any
> shell is the value we add. See [[behaviors/auth]].

## Sanctioned surface only

We speak **only** to Otter's official hosted MCP server (`mcp.otter.ai`) over its
OAuth-authenticated transport, within the scopes it grants (`profile:read`,
`conversations:read`). No reverse-engineered web endpoints, no unofficial API, no scope we
weren't granted.

> Why: the user chose the sanctioned path over the richer unofficial web API specifically to
> stay in-bounds and avoid brittleness/ToS risk. That choice is load-bearing — honor it.

## Search is both find and browse

`search` with an **empty query plus a date range** is a first-class **browse** mode, not a
degenerate input. The CLI must make date-only browsing as easy as keyword search.

> Why: real usage shows ~⅓ of searches were empty-query + `created_after`/`created_before`
> to list conversations in a window. Empty-query-plus-dates *is* how you list in this API;
> treat it as intended, not as an edge case. See [[commands/search]].

## Inherit AXI ergonomics

Follow the AXI conventions the SDK and sibling tools establish: TOON output, content-first
`home` view, structured `AxiError`s with actionable `help[]`, minimal default field sets
with opt-in expansion, definitive empty states, and contextual next-step suggestions on
list/mutation output. These are not restated per-spec; they are the baseline.
