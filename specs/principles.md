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

This rules out: summary/insight/outline commands, sentiment, dedup or "smart matching," and
any write operation. When tempted to add a capability, ask whether it helps *find* a
conversation or *pull* its transcript. If not, it doesn't belong here.

## Polyfill the missing API

Otter gives non-Enterprise accounts no proper API, only the hosted MCP server. A second job
sits alongside find-and-pull: make that MCP **behave like the clean API Otter doesn't offer**,
absorbing its transport quirks so consumers get a stable, typed surface and never touch the
MCP's warts. This is why otter-axi already unwraps the double-nested `content` envelopes,
normalizes `otter.ai/u/<id>` URLs to ids, exposes a typed `search`/`fetch`/`getUser` client, and
parses the `[H:MM:SS] Speaker N: …` transcript blob into `{start,speaker,text}` segments.

> Why (from the user): "part of this is us polyfilling needing to use their MCP instead of a
> proper API — so we own the nuances of using the MCP as an API." Transcripts are long and need
> tooling to explore and reprocess; that's an API-shape gap we fill.

**The discriminator** — own it when it's a nuance of the *transport / MCP shape*: encoding,
envelopes, a text blob standing in for structured data, id/URL normalization, pagination,
retries. Leave it out when it's *semantic interpretation of the content* (what the meeting means
— summaries, sentiment, "smart" matching); that's [find-and-pull](#find-and-pull-nothing-more)
territory and stays with the consumer. Net line across both principles: **structure / format /
encoding is ours; meaning is the consumer's.**

This is also why we *don't* add mechanical export formats to `search`: its results already come
back clean and tabular from our client, so there's no API-shape nuance to polyfill. The
transcript is the opposite — raw text where structured data should be — so we own the parse.

Two guarantees keep the polyfill honest: the **verbatim form stays the default** (parsed/
structured outputs are opt-in), and every such conversion is **lossless** (e.g. the transcript
parser preserves every character, keeping unrecognized lines as continuations rather than
dropping them — verified by a round-trip test).

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
