---
status: done
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

- [x] OAuth login completes end-to-end against `mcp.otter.ai` with a public DCR client + PKCE.
- [x] `tools/list` schemas for all three tools captured and pasted into `api/mcp-server.md`.
- [x] Real `search` output (result fields; **no** total/pagination wrapper) documented.
- [x] Real `fetch` output (transcript `[H:MM:SS] Speaker N:` format + metadata) documented.
- [x] All `(TBD: spike)` markers removed from the specs; command display rules reconciled.
- [~] Refresh-token **issuance** confirmed (`refresh_token` present in the 200 token response);
      the refresh-grant round-trip itself is exercised in plan 03.

## Risks / unknowns

- The MCP `search`/`fetch` may impose pagination or result caps not visible in the input
  schema — capture whatever the live response reveals.
- DCR could be restricted in practice despite being advertised; if registration fails, fall
  back to documenting the error and revisit the auth approach in plan 03.

## Notes

Spike succeeded end-to-end. DCR works → **public client**, no secret
(`token_endpoint_auth_method: "none"`). Token response:
`{ access_token, token_type, expires_in, refresh_token, scope }`.

**Surprises that enriched the specs (beyond the 5 params seen in usage):** `search` actually
takes **9** inputs — added `keywords_in_transcript`, `channel_name`, `folder_name`,
`include_shared_meetings`, `username`. `search` returns **metadata only** (`results[]` of
`{id,title,url,start_time,duration,short_summary,action_items}`) with **no count/pagination
wrapper**. `fetch` is **id-only and explicitly rejects URLs** (validates the URL→id normalizer)
and returns `{id,title,url,text,metadata}` with `text` formatted `[H:MM:SS] Speaker N:`.
`get_user_info` returns **prose** incl. a TZ-aware `Current DateTime` — it's the upstream's clock.

**Gotcha (now a spec rule):** a stale/delayed first authorization failed with `invalid_grant`
at the token step; a promptly-approved retry succeeded. `auth login` must mint+complete in one
window. Captured via a `fetch` wrapper logging the token endpoint (`scratch/token-debug.json`).

The scratch script and its captured payloads live only in gitignored `scratch/` and were never
committed. Sensitive artifacts (live tokens, real transcripts/titles) deleted at closeout.
No PR — local `main`, then pushed.

## Follow-ups

- **Deferred to plan 03:** exercise the actual refresh-token round-trip; persist whatever the
  refresh response returns (rotation semantics unconfirmed).
- **Absorbed into plan 04:** the four extra search filters (`--in-transcript`, `--channel`,
  `--folder`, `--mine`) are now in `specs/commands/search.md` and that plan's scope.
- **Tracked as spec rule:** the `invalid_grant`-on-stale-code lesson is recorded in
  `specs/api/mcp-server.md` and `specs/behaviors/auth.md` governs the one-window login.
