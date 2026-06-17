---
status: planned
depends: [02-scaffold]
specs:
  - specs/behaviors/auth.md
  - specs/api/mcp-server.md
issues: []
---

# Plan 03 — Authentication & MCP client

## Scope

Implement the real OAuth 2.1 flow and the MCP client transport, plus the `auth` command
lifecycle. After this plan, a user can log in once and the tool holds refreshable tokens and
can call the MCP server headlessly. Informed by plan 01's spike (which proves the flow), but
the auth *mechanics* don't depend on the tool *output* schemas, so this can proceed in
parallel with 01's spec write-up.

## Implements

- `specs/behaviors/auth.md` — login flow, token storage, refresh+retry, status/logout.
- `specs/api/mcp-server.md` — transport, OAuth discovery/registration, error mapping.

## Approach

1. `src/otter/oauth.ts` — an `@modelcontextprotocol/sdk` OAuth client provider implementing:
   metadata discovery, RFC 7591 dynamic registration (public client), PKCE/S256 authorize via
   loopback listener, code→token exchange, refresh grant, and storage hooks backed by
   `config.ts`. Two-phase `--no-wait`/`--wait` login like gws-axi. **Spike-proven** (plan 01):
   this exact provider shape completed the dance. Persist the full token set
   `{access_token, refresh_token, token_type, scope, expires_at(=now+expires_in)}`. Codes are
   short-lived — **mint the authorize URL and complete the exchange in one prompt window**
   (a stale code fails `invalid_grant`); `--no-wait` must therefore warn that the URL expires
   quickly. The reference loopback page should send UTF-8 (`charset=utf-8`) to avoid the
   garbled em-dash seen in the spike.
2. `src/otter/client.ts` — wrap `StreamableHTTPClientTransport`; expose the internal client
   interface `getUser()` / `search()` / `fetch()`; 60s pre-expiry refresh; transparent
   refresh-once-on-401 retry; map JSON-RPC/HTTP errors to `AxiError` with actionable `help[]`.
3. `src/commands/auth.ts` — `login` (drives the loopback flow, caches profile via
   `get_user_info`), `status` (cached email + optional live probe, `--offline`), `logout`
   (revoke + delete, idempotent). Export `AUTH_HELP`.
4. Wire `doctor` to tiered checks: creds present → token valid → MCP reachable.

## Validation

- [ ] `otter-axi auth login` registers a client, completes consent, and stores tokens (0600).
- [ ] `otter-axi auth status` shows the account email; `--offline` makes no network call.
- [ ] An expired access token is silently refreshed before a call; a 401 triggers one
      refresh+retry, and a failed refresh yields `AxiError("AUTH")` → `Run otter-axi auth login`.
- [ ] `otter-axi auth logout` revokes + clears tokens; second logout is a no-op (exit 0).
- [ ] No command other than `auth login` ever blocks on interaction.
- [ ] Tokens/secrets never appear in any command output.

## Risks / unknowns

- The MCP SDK's OAuth provider abstraction may not expose every hook we need (e.g. custom
  storage or `--no-wait`); if so, drive discovery/registration/exchange directly with `fetch`
  (the gws-axi `loopback.ts` approach) and use the SDK only for transport.
- Refresh-token rotation semantics unconfirmed — persist whatever the token response returns.

## Notes

*(closeout)*

## Follow-ups

*(closeout)*
