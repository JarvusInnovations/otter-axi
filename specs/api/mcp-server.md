# API: Otter hosted MCP server (upstream contract)

The surface we consume. Owned by Otter; captured here as what we depend on. Everything below
is **(confirmed)** — probed live and validated end-to-end by the plan-01 auth spike (full OAuth
dance + `tools/list` + live `search`/`fetch`/`get_user_info` calls). No open `(TBD)` items remain.

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
- **Spike-validated flow** (plan 01): DCR returns a **public client** (`client_id`, no secret,
  `token_endpoint_auth_method: "none"`). The authorize request and token exchange both carry
  `resource=https://mcp.otter.ai/`. The token response is
  `{ access_token, token_type, expires_in, refresh_token, scope }` — **a `refresh_token` is
  issued**, enabling headless refresh.
- **Authorization codes are short-lived.** A long delay between building the authorize URL and
  approving it yields `invalid_grant` at the token step. `auth login` must mint the URL and
  complete the exchange in one prompt window; don't pre-generate URLs to use later.

## Tools

Three tools. Input schemas and output shapes below are **(confirmed)** — verified against the
authoritative `tools/list` and live tool calls in the plan-01 spike. All examples are
**synthetic**; real payloads were never committed.

Every tool result comes back through MCP's standard envelope: `{ content: [{ type: "text",
text: "<payload>" }], structuredContent, isError }`. **`search` and `fetch` double-wrap** — the
outer `content[0].text` is *itself* an MCP content envelope whose inner `text` holds the real
JSON (`{results}` / `{id,…}`); the CLI must unwrap **two** layers for those. `get_user_info` is
single-wrapped and its `content[0].text` is **prose, not JSON**.

### `get_user_info`

- **Input:** `{}` (confirmed)
- **Output:** prose text, not JSON:

  ```
  User Information:
  Name: Jane Doe
  Email: jane@example.com
  Current DateTime: 2026-06-17 14:37:30 PDT
  ```

  The tool is also the upstream's **clock** — `Current DateTime` (TZ-aware) is what the server
  expects an agent to anchor relative date ranges against before calling `search`.
- **Used by:** `auth status`, `doctor`, cached into config for `home`.

### `search`

Find/browse conversations — returns **metadata only**, never transcript text. Full input
schema (confirmed; all params except `query` are optional, nullable, default `""`/`null`):

| Param | Type | Notes |
|---|---|---|
| `query` | string | Keyword/semantic query. **Required field but may be `""`** — empty + a date range is date-only browse. |
| `created_after` | string\|null | `YYYY/MM/DD`. Lower bound on creation date. |
| `created_before` | string\|null | `YYYY/MM/DD`. Upper bound on creation date. |
| `title_contains` | string\|null | Space-separated keywords matched against the title. |
| `keywords_in_transcript` | string\|null | Comma-separated keywords searched **within transcripts**. |
| `attended_by` | string\|null | Comma-separated attendee **names** (not emails). |
| `channel_name` | string\|null | Comma-separated channel name(s) to search within. |
| `folder_name` | string\|null | Comma-separated folder name(s) to search within. |
| `include_shared_meetings` | boolean\|null | Default `true`; set `false` for "my meetings only". |
| `username` | string\|null | The caller's name (from `get_user_info`); when set, results carry a `participation_status`. |

- **Output** (inside `content[0].text`, after unwrapping): `{ "results": [ Meeting ] }` — **no
  count/total/pagination wrapper**; the server returns the full matched set. Each `Meeting`:

  | Field | Type | Notes |
  |---|---|---|
  | `id` | string | Conversation slug — feeds `fetch`. |
  | `title` | string | Often literally `"Note"` when un-renamed. |
  | `url` | string | `https://otter.ai/u/<id>`. |
  | `start_time` | string | Meeting start timestamp. |
  | `duration` | number | Length (seconds). |
  | `short_summary` | string | One-line generated summary. |
  | `action_items` | array | Generated action items (may be empty). |

  Synthetic example:

  ```json
  { "results": [ {
    "id": "aBcDeFgHiJkLmNoPqRsTuVwXyZ0",
    "title": "Weekly roadmap review",
    "url": "https://otter.ai/u/aBcDeFgHiJkLmNoPqRsTuVwXyZ0",
    "start_time": "2026-05-04 10:00:00",
    "duration": 1850,
    "short_summary": "Reviewed milestones and reprioritized the backlog.",
    "action_items": ["Send recap to the team"]
  } ] }
  ```

### `fetch`

Pull a full transcript.

- **Input:** `{ "id": string }` — **id only; the tool explicitly rejects URLs**. The CLI
  normalizes an `otter.ai/u/<id>` URL down to `<id>` before calling (confirmed required).
- **Output** (inside `content[0].text`, after unwrapping): `{ id, title, url, text, metadata }`:
  - `text` — the full transcript as a single string, formatted `[H:MM:SS] Speaker N: …` per line.
  - `metadata` — `{ action_items, duration, short_summary, start_time }` (same fields `search`
    returns per meeting).

  Synthetic example:

  ```json
  {
    "id": "aBcDeFgHiJkLmNoPqRsTuVwXyZ0",
    "title": "Weekly roadmap review",
    "url": "https://otter.ai/u/aBcDeFgHiJkLmNoPqRsTuVwXyZ0",
    "text": "[0:00:00] Speaker 1: Thanks everyone for joining…\n[0:00:12] Speaker 2: Happy to be here…",
    "metadata": { "action_items": [], "duration": 1850, "short_summary": "…", "start_time": "2026-05-04 10:00:00" }
  }
  ```

## Errors

- `401` invalid/expired token → trigger refresh; if refresh fails, instruct `auth login`.
- `429` rate limit (Enterprise REST docs cite 10 req/s; MCP limit unconfirmed) → surface as a
  retryable `AxiError`.
- Map upstream JSON-RPC errors to `AxiError` with actionable `help[]`; never leak raw bodies.

## Notes

The hosted docs also advertise webhooks and an `include`-based detail endpoint — those are
REST-API features, **not** part of the MCP tool surface, and are out of scope.
