---
status: done
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

- [x] `otter-axi auth login` registers a client, completes consent, stores tokens (0600).
      **Verified live** end-to-end (`chris@jarv.us`); config file is `-rw-------`.
- [x] `otter-axi auth status` shows the account email; `--offline` makes no network call.
- [~] Silent pre-expiry refresh (60s buffer) + refresh-once-on-401 retry + `AxiError("AUTH")`
      on failed refresh are **implemented**; the actual expiry/401 round-trip wasn't exercised
      live (token still fresh) — deferred to first real refresh.
- [x] `otter-axi auth logout` revokes (best-effort) + clears tokens; second logout no-op (exit 0).
- [x] No command other than `auth login` ever blocks on interaction.
- [x] Tokens/secrets never appear in any command output (status/doctor show email only).
- [x] **Bonus, verified live:** `client.ts` `getUser`/`search`/`fetch` work — `search` browse
      returned 14 results with the spec'd fields; `fetch` returned a 174k-char `[H:MM:SS]`
      transcript with matching `id` + metadata.

## Risks / unknowns

- The MCP SDK's OAuth provider abstraction may not expose every hook we need (e.g. custom
  storage or `--no-wait`); if so, drive discovery/registration/exchange directly with `fetch`
  (the gws-axi `loopback.ts` approach) and use the SDK only for transport.
- Refresh-token rotation semantics unconfirmed — persist whatever the token response returns.

## Notes

Did **not** use the SDK's provider-callback model; instead orchestrated the SDK's low-level
OAuth functions (`discoverOAuthProtectedResourceMetadata`, `discoverAuthorizationServerMetadata`,
`registerClient`, `startAuthorization`, `exchangeAuthorization`, `refreshAuthorization`) directly
for full two-phase control, and used `StreamableHTTPClientTransport` with a bearer via
`requestInit` for data calls. Two-phase login persists pending state (`pending-auth.json`, 0600);
DCR registers a public client across loopback ports 41789-92.

**Two live-only bugs found + fixed during end-to-end validation:**

1. `exchangeAuthorization` without `metadata` made the SDK guess `/token` → nginx **405**. Fix:
   pass `metadata: disc.asMetadata` so it uses the real `/oauth/token`.
2. `search`/`fetch` payloads are **double-wrapped** (an inner MCP content envelope inside
   `content[0].text`); unwrapping one layer yielded 0 results. Fix: `payloadText()` unwraps the
   second layer. `get_user_info` is single-wrapped prose (so auth worked but search didn't).
   Both corrected in `specs/api/mcp-server.md`.

Also: loopback page now sends `charset=utf-8` (fixes the garbled em-dash). No PR — local `main`,
pushed.

## Follow-ups

- **Deferred:** exercise the real refresh round-trip when the access token actually expires;
  confirm whether Otter rotates the refresh_token.
- **Tracked as spec fix:** the double-wrap + 405/metadata findings are recorded in
  `specs/api/mcp-server.md`.
- **Enables plan 04:** `client.ts` (`getUser`/`search`/`fetchTranscript`) is live-verified, so
  the search/fetch commands just need flag wiring + output formatting.
