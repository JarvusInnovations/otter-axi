# otter-axi

An agent-facing CLI ([AXI](https://github.com/JarvusInnovations/axi) tool) that wraps
Otter.ai's hosted **MCP server** to **find and pull meeting transcripts** from any shell —
headlessly, after a one-time browser login. Token-efficient [TOON](https://toonformat.dev)
output, built for agents.

It does find-and-pull only; analysis is left to whatever consumes the output.

## Why

Otter's hosted MCP connector re-prompts for auth and can't be scripted, and its Public REST
API is gated to Enterprise workspaces. otter-axi turns the same sanctioned MCP server into a
scriptable CLI: approve once in the browser, then `search`/`fetch` run non-interactively from
any agent session or shell, with refresh handled silently.

## Install & authenticate

```sh
npm install -g otter-axi       # install the CLI on your PATH
otter-axi auth login           # one-time browser approval
otter-axi doctor               # config → credentials → MCP reachable
```

Or run any command ad hoc without installing: `npx -y otter-axi <command>`.

Tokens are stored in `~/.config/otter-axi/config.json` (mode `0600`) and refreshed
automatically; they are never printed. Read-only scopes: `profile:read`, `conversations:read`.

## Usage

**Find or browse meetings** (returns metadata: title, date, duration, summary, action-item
count, id). Empty query + a date range is browse mode:

```sh
otter-axi search "pricing discussion" --after 30d
otter-axi search --after 2026/05/01 --before 2026/05/07
otter-axi search --in-transcript "roadmap,milestones" --attended-by "Jane Doe" --mine
```

Flags: `-q/--query`, `--after`/`--before` (ISO or relative `7d`/`2w`/`3m`/`1y`),
`--title-contains`, `--in-transcript`, `--attended-by`, `--channel`, `--folder`, `--mine`,
`--limit`, `--full`.

**Pull a transcript** by id (from search) or `otter.ai/u/<id>` URL:

```sh
otter-axi fetch <id>                 # metadata + preview
otter-axi fetch <id> --full          # verbatim transcript to stdout (for piping)
otter-axi fetch <id> --json-out      # parsed segments → auto-path under exports/
otter-axi fetch <id> --json-out=t.json  # …or an explicit path
otter-axi fetch <id> --csv-out          # CSV (--tsv-out / --text-out likewise)
```

The segment formats (`--json-out`/`--csv-out`/`--tsv-out`) parse the `[H:MM:SS] Speaker N: …`
transcript into `{start, speaker, text}` rows — otter-axi owns one tested, lossless parser so
agents don't re-derive it. Per the [AXI side-channel-file convention](https://github.com/kunchenguid/axi/issues/32),
the path is optional (bare → `~/.config/otter-axi/exports/<ts>-<id>.<ext>`), and writing a file
is additive: stdout keeps the preview and adds `wrote:`/`columns:` and a `jq` hint.

## Commands

| Command | Purpose |
|---|---|
| `otter-axi` | Content-first home / session status |
| `auth login [--no-wait\|--wait]` | One-time OAuth; `--no-wait`/`--wait` for agent relay |
| `auth status [--offline]` | Show the connected account |
| `auth logout` | Revoke + clear stored tokens |
| `search [query…] [flags]` | Find/browse meetings (metadata only) |
| `fetch <id\|url> [--full\|--text-out\|--json-out\|--csv-out\|--tsv-out]` | Pull a transcript (verbatim or parsed segments) |
| `doctor` | Tiered connectivity diagnostics |
| `setup hooks` | Install the SessionStart hook (Claude Code / Codex / OpenCode) |

## Development

Built on `axi-sdk-js` + `@toon-format/toon` + `@modelcontextprotocol/sdk`, TypeScript/ESM,
bun for dev, `tsc`→node to ship.

```sh
bun install
bun run dev <command>   # run from source
bun run test            # vitest
bun run build           # tsc → dist/
```

Spec-driven: `specs/` is the source of truth, `plans/` tracks the work that built it. See
[`specs/README.md`](specs/README.md).

## License

MIT
