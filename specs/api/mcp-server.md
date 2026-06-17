# API: Otter hosted MCP server (upstream contract)

The surface we consume. Owned by Otter; captured here as what we depend on. Values marked
**(confirmed)** were probed live or observed in real tool calls; **(TBD: spike)** awaits the
plan-01 auth spike that captures real `tools/list` schemas and sample tool outputs.

## Endpoint & transport

- **MCP endpoint:** `POST https://mcp.otter.ai/mcp` — JSON-RPC 2.0 over the streamable-HTTP
  transport. Requests send `Accept: application/json, text/event-stream`. (confirmed)
- **Auth challenge:** an unauthenticated call returns `401` with
  `WWW-Authenticate: Bearer … resource_metadata="https://mcp.otter.ai/.well-known/oauth-protected-resource"`.
  (confirmed)
- Server identifies as `uvicorn`. (confirmed)

## OAuth (2.1)

- **Protected-resource metadata** (`/.well-known/oauth-protected-resource`): (confirmed)
  - `resource`: `https://mcp.otter.ai/`
  - `authorization_servers`: `["https://otter.ai/"]`
  - `scopes_supported`: `["profile:read", "conversations:read"]`
  - `bearer_methods_supported`: `["header"]`
- **Authorization-server metadata** (`https://otter.ai/.well-known/oauth-authorization-server`):
  (confirmed)
  - `issuer`: `https://otter.ai`
  - `authorization_endpoint`: `https://otter.ai/oauth2/authorize`
  - `token_endpoint`: `https://otter.ai/oauth/token`
  - `revocation_endpoint`: `https://otter.ai/oauth/revoke_token`
  - `registration_endpoint`: `https://otter.ai/oauth/register` (RFC 7591 dynamic client reg)
  - `response_types_supported`: `["code"]`
  - `code_challenge_methods_supported`: `["plain", "S256"]` → we use **S256**
  - `token_endpoint_auth_methods_supported`: `["none", "client_secret_post", "client_secret_basic"]`
    → we register a **public client** (`none`)
  - `grant_types_supported`: `["authorization_code", "refresh_token"]`
- **Read-only.** The only granted scopes are `profile:read` + `conversations:read`. No write
  capability exists upstream — consistent with [find-and-pull](../principles.md#find-and-pull-nothing-more).

## Tools

Three tools. Input schemas below are **(confirmed)** from observed real calls; the spike
verifies them against the authoritative `tools/list` and captures the *output* schemas.

### `get_user_info`

- **Input:** `{}` (confirmed)
- **Output:** the authenticated user's profile (name, email). Exact shape **(TBD: spike)**.
- **Used by:** `auth status`, `doctor`, cached into config for `home`.

### `search`

Find/browse conversations. Input parameters (confirmed from real usage):

| Param | Type | Notes |
|---|---|---|
| `query` | string | Keyword/semantic query. **May be empty** (`""`) for date-only browse. |
| `created_after` | string | `YYYY/MM/DD`. Lower bound on creation date. |
| `created_before` | string | `YYYY/MM/DD`. Upper bound on creation date. |
| `title_contains` | string | Substring match on conversation title. |
| `attended_by` | string | Filter by an attendee (e.g. a person's name). |

- **Output:** a list of conversation summaries, each including at least an `id` (the
  `otter.ai/u/<id>` slug, consumed by `fetch`) and a title. Full field set, result count
  semantics, and whether pagination exists **(TBD: spike)**.

### `fetch`

Pull a full transcript.

- **Input:** `{ "id": string }` — the conversation slug (confirmed). The hosted docs also
  describe pulling by full `otter.ai/u/<id>` URL; the CLI normalizes a URL to its id.
- **Output:** the full transcript text plus conversation metadata. Exact shape, transcript
  format, and whether summary/speaker labels are included **(TBD: spike)**.

## Errors

- `401` invalid/expired token → trigger refresh; if refresh fails, instruct `auth login`.
- `429` rate limit (Enterprise REST docs cite 10 req/s; MCP limit unconfirmed) → surface as a
  retryable `AxiError`.
- Map upstream JSON-RPC errors to `AxiError` with actionable `help[]`; never leak raw bodies.

## Notes

The hosted docs also advertise webhooks and an `include`-based detail endpoint — those are
REST-API features, **not** part of the MCP tool surface, and are out of scope.
