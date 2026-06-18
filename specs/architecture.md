# Architecture

## What otter-axi is

An agent-facing CLI that is an **MCP client** for Otter's hosted MCP server. It is *not* a
REST API client — there is no usable REST API for non-Enterprise accounts (the official
Public API returns `403 forbidden` on a regular paid plan; confirmed empirically). The
sanctioned, working surface for this account is the hosted MCP server.

## Stack

- **Language/runtime:** TypeScript, ESM (`"type":"module"`, `.js` import specifiers).
  Dev via **bun**; ship by compiling with `tsc` to `dist/` and running on **node ≥ 20**.
- **Core deps:** `axi-sdk-js` (CLI dispatch, TOON serialization, `AxiError`, SessionStart
  hook installer) + `@toon-format/toon`.
- **MCP + OAuth:** `@modelcontextprotocol/sdk` — its `StreamableHTTPClientTransport` plus the
  SDK's OAuth client provider interface carry the JSON-RPC handshake and the OAuth 2.1 dance
  (dynamic client registration, PKCE, token refresh). We implement the provider's storage
  hooks against our config file and supply a loopback redirect; we do **not** hand-roll
  JSON-RPC framing or the token exchange.
- **Structural template:** `metabase-axi` (session-token auth with transparent retry,
  preview-to-stdout output kit). Auth login borrows from `gws-axi`'s loopback flow.

## Project layout

```
otter-axi/
  bin/otter-axi.ts          # shebang shim → main()
  src/
    cli.ts                  # runAxiCli(cliOptions()); TOP_HELP, COMMAND_HELP
    meta.ts                 # DESCRIPTION, readVersion()
    flags.ts                # parseArgs / strFlag / hasFlag (SDK does not parse flags)
    output.ts               # truncation, count labels, relative time
    config.ts               # ~/.config/otter-axi/config.json (0600) read/write
    otter/
      oauth.ts              # OAuth provider: DCR + PKCE + loopback + refresh + storage
      client.ts             # MCP client: connect, callTool, error mapping
    commands/
      home.ts               # content-first home (= SessionStart payload)
      auth.ts               # login / status / logout
      doctor.ts             # tiered connectivity diagnostics
      setup.ts              # `setup hooks` → installSessionStartHooks
      search.ts             # search command
      fetch.ts              # fetch command
  specs/  plans/  test/
  skills/otter-axi/SKILL.md # generated, secondary install path
```

## Config & secrets

`$XDG_CONFIG_HOME/otter-axi/config.json` (fallback `~/.config/otter-axi/config.json`), dir
`0o700`, file `0o600`. Holds: the dynamically-registered `client_id`, the OAuth token set
(`access_token`, `refresh_token`, `expires_at`), and a cached non-secret user profile
(name, email) so `home`/`doctor` render fast without a network call. Overridable via
`OTTER_AXI_CONFIG_DIR`. The API key in `.env` (`OTTER_API_KEY`) is **not used** — it is for
the Enterprise REST API, which is out of scope; `.env` may be removed.

## Output

Plain objects from handlers → TOON at the SDK boundary. Borrow `metabase-axi`'s kit:
`truncateCell` with a visible `…(truncated, N chars total)` marker, `countLabel` (`N of M`),
relative-time helpers. Transcript bodies are large: `fetch` previews to stdout and writes
the full transcript to a file (`--out`), per the metabase preview-to-stdout/full-to-file
pattern — never dump a giant transcript inline by default.

## Command surface

`(home)`, `auth {login|status|logout}`, `doctor`, `setup hooks`, `search`, `fetch`. Locked
to find-and-pull (see [principles.md](principles.md)); no write or analysis commands.

## Key decisions

- **MCP client, not REST.** Forced by the 403; also the sanctioned path the user chose.
- **Lean on `@modelcontextprotocol/sdk`** for transport + OAuth rather than hand-rolling.
- **Public client via DCR.** The auth server advertises `token_endpoint_auth_methods:["none"]`
  and a `registration_endpoint`, so we register a secretless public client at first login —
  no pre-provisioned client credentials to ship or store.
- **Swap seam (cheap insurance).** Command handlers depend on a small internal client
  interface (`search()`, `fetch()`, `getUser()`), so if the user ever gains Enterprise REST
  access a second adapter can slot in without touching command code. We are not building that
  adapter now.

## CI & release

Mirrors the sibling AXI tools (the Jarvus develop→main Release-PR automation):

- **CI** (`.github/workflows/ci.yml`) — on push/PR to `main` and `develop`: checkout, pin
  node `22.22.3` + bun `1.3.14`, `bun install --frozen-lockfile`, `bun run build`,
  `bun run test`. Must be green on every Release PR.
- **Release flow** — `main` is the released branch; `develop` is the integration branch.
  Pushing `develop` triggers `release-prepare` (opens/updates the `Release: vX.Y.Z` PR into
  `main` with a bot changelog); `release-validate` gates the PR; **merging the PR publishes**
  via `release-publish`, which cuts the tag + GitHub release. All three delegate to
  `JarvusInnovations/infra-components@channels/github-actions/release-*/latest`.
- **npm publish** (`.github/workflows/publish-npm.yml`) — on GitHub `release: published`:
  build and `npm publish --provenance --access public` via **Trusted Publishing** (OIDC,
  `id-token: write`, node 24). The package is public (`otter-axi`).
- **Prerequisites (manual, one-time):** the org `BOT_GITHUB_TOKEN` secret must be available
  to the repo (used by `release-publish`), and npm **Trusted Publishing** must be configured
  on npmjs.com linking `JarvusInnovations/otter-axi` + `publish-npm.yml` (a first publish may
  need a manual bootstrap before OIDC takes over).
