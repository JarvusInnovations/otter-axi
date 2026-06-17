---
status: planned
depends: []
specs:
  - specs/api/mcp-server.md
issues: []
---

# Plan 01 — Auth spike: ground the upstream schemas

## Scope

A throwaway-grade spike that completes the Otter MCP OAuth dance once and captures the
authoritative upstream surface, so the `(TBD: spike)` gaps in `specs/api/mcp-server.md` (and
the output-dependent display rules in the command specs) are filled with real data before any
command code is written. Produces **spec updates**, not shipped CLI code.

## Implements

- `specs/api/mcp-server.md` — replaces every `(TBD: spike)` with confirmed `tools/list`
  input schemas and observed output shapes for `search`, `fetch`, `get_user_info`.

## Approach

1. Install `@modelcontextprotocol/sdk` (shared with plan 02) and write a scratch script under
   `scratch/` (git-ignored) that:
   - discovers protected-resource + AS metadata,
   - dynamically registers a public client (`token_endpoint_auth_method: "none"`),
   - runs authorization-code + PKCE/S256 via a `127.0.0.1` loopback redirect,
   - exchanges the code, and connects `StreamableHTTPClientTransport`.
2. Call `tools/list`; dump each tool's `inputSchema`.
3. Call each tool with a benign input (`get_user_info {}`; `search` with a recent date window
   and empty query; `fetch` on one id from the search result) and capture the raw output
   JSON.
4. Transcribe findings into `specs/api/mcp-server.md`; update `commands/search.md` display
   columns and `commands/fetch.md` output/preview rules to match the real shapes.
5. Discard the scratch script (do not ship it).

## Validation

- [ ] OAuth login completes end-to-end against `mcp.otter.ai` with a public DCR client + PKCE.
- [ ] `tools/list` schemas for all three tools captured and pasted into `api/mcp-server.md`.
- [ ] Real `search` output (incl. result/id/title fields + any total/pagination) documented.
- [ ] Real `fetch` output (transcript format + included metadata) documented.
- [ ] All `(TBD: spike)` markers removed from the specs; command display rules reconciled.
- [ ] Refresh-token grant confirmed to return a usable new access token.

## Risks / unknowns

- The MCP `search`/`fetch` may impose pagination or result caps not visible in the input
  schema — capture whatever the live response reveals.
- DCR could be restricted in practice despite being advertised; if registration fails, fall
  back to documenting the error and revisit the auth approach in plan 03.

## Notes

_(closeout)_

## Follow-ups

_(closeout)_
