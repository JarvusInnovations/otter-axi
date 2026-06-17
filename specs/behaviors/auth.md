# Behavior: Authentication

## Rule

otter-axi authenticates to the Otter MCP server with OAuth 2.1. A **single** interactive
browser approval (`auth login`) yields tokens that are stored and **silently refreshed**;
all other commands run headlessly using those tokens. No command other than `auth login`
ever blocks on user interaction.

## Applies To

Every command that calls the MCP server (`search`, `fetch`, `doctor`, `home`'s live
refresh). `auth {login,status,logout}` manage the credential lifecycle.

## Login flow (`auth login`)

Borrows `gws-axi`'s two-phase loopback pattern so an agent can relay the URL to a human:

1. **Discover** protected-resource + authorization-server metadata (see
   [api/mcp-server.md](../api/mcp-server.md)).
2. **Register** a public client via the `registration_endpoint` (RFC 7591,
   `token_endpoint_auth_method: "none"`) if no `client_id` is stored. Persist the `client_id`.
3. **Authorize** with PKCE (S256): start a loopback HTTP listener on an ephemeral
   `127.0.0.1` port, open the `authorization_endpoint` URL with `code_challenge`, scopes
   `profile:read conversations:read`, and the loopback `redirect_uri`.
   - `--no-wait` returns the URL immediately (for relaying); `--wait` (default) blocks until
     the callback arrives in this invocation.
4. **Exchange** the returned code at the `token_endpoint` for `access_token` + `refresh_token`
   - expiry. The loopback response stays open until the token write succeeds, then closes.
5. **Persist** the token set to config (`0o600`) and cache the user profile via
   `get_user_info`. Output a confirmation (account email), never the tokens.

## Token storage

In `~/.config/otter-axi/config.json` (see [architecture.md](../architecture.md)):
`client_id`, `access_token`, `refresh_token`, `expires_at`, and a cached `{name,email}`
profile. Secrets are never printed by any command.

## Refresh & retry

- Before a call, if `access_token` is within a 60s expiry buffer, refresh via the
  `refresh_token` grant first.
- On a `401` despite a presumed-valid token, refresh once and retry the call transparently
  (the metabase-axi pattern). If refresh fails (revoked/expired refresh token), raise an
  `AxiError("AUTH", …)` whose `help[]` is exactly `Run otter-axi auth login`.

## `auth status` / `auth logout`

- **status:** report whether logged in, the account email (from cache), and token validity
  (probe `get_user_info` unless `--offline`). Never prints tokens.
- **logout:** call the `revocation_endpoint` for the tokens, then delete them from config
  (idempotent — "already logged out" is a no-op, exit 0).

## Unconfigured state

When no tokens exist, network commands fail fast with `AxiError("AUTH", …)` →
`Run otter-axi auth login`. The `home` view degrades to an onboarding object pointing at
`auth login` rather than erroring.

## Principles

**Inherited:**

- [One-time auth, headless forever after](../principles.md#one-time-auth-headless-forever-after) —
  this behavior *is* the operationalization of that principle; the silent-refresh + retry path
  is what keeps every non-login command prompt-free.
- [Sanctioned surface only](../principles.md#sanctioned-surface-only) — we use only the
  OAuth dance the MCP server advertises, requesting only its two read scopes.
