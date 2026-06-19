---
name: otter-axi
description: "AXI-compliant CLI for Otter.ai — find and pull meeting transcripts from the terminal with token-efficient TOON output. Use when the user wants to search their Otter meetings (by keyword, date range, title, attendee, channel, or folder), browse recent conversations, or pull a full meeting transcript by id/URL. Wraps Otter's hosted MCP server over OAuth; prefer this over the hosted MCP connector for scriptable, headless access."
user-invocable: false
author: Jarvus Innovations
metadata:
  hermes:
    tags: [otter, transcripts, meetings, notes, mcp]
    category: productivity
---

# otter-axi

Agent-ergonomic CLI that wraps Otter.ai's hosted MCP server to **find and pull meeting
transcripts**. Run `otter-axi --help` for the command list and `otter-axi <command> --help`
for any command's usage. It does find-and-pull only — analysis is the caller's job.

## Setup

One-time browser approval, then headless forever after (tokens refresh silently):

```sh
otter-axi auth login     # opens your browser; approve access
otter-axi doctor         # verify: config → credentials → MCP reachable
```

Agents driving the login over a relay: `otter-axi auth login --no-wait` prints the authorize
URL and returns; relay it, then run `otter-axi auth login --wait` in a separate turn to capture
the redirect. Authorization codes are short-lived — approve promptly.

Tokens live in `~/.config/otter-axi/config.json` (mode 0600) and are never printed.

## Core workflow

1. **Find / browse** with `search` — returns meeting *metadata* (title, date, duration,
   one-line summary, action-item count, and the id). An empty query plus a date range is
   browse mode.

   ```sh
   otter-axi search "pricing discussion" --after 30d
   otter-axi search --after 2026/05/01 --before 2026/05/07   # browse a window
   otter-axi search --in-transcript "roadmap,milestones" --attended-by "Jane Doe"
   ```

   Flags: `-q/--query`, `--after`/`--before` (ISO `2026-05-01` or relative `7d`/`2w`/`3m`),
   `--title-contains`, `--in-transcript`, `--attended-by`, `--channel`, `--folder`, `--mine`,
   `--limit`, `--full`.

2. **Pull a transcript** with `fetch` — takes an id (from search) or an `otter.ai/u/<id>` URL:

   ```sh
   otter-axi fetch <id>                    # metadata header + preview
   otter-axi fetch <id> --full             # verbatim transcript to stdout (pipe it)
   otter-axi fetch <id> --json-out         # parsed segments → auto-path under exports/
   otter-axi fetch <id> --json-out=t.json  # …or an explicit path (note the = form)
   otter-axi fetch <id> --csv-out          # CSV (--tsv-out / --text-out likewise)
   ```

   Transcripts are `[H:MM:SS] Speaker N: …`. Default/`--full`/`--text-out` are verbatim; the
   `--json-out`/`--csv-out`/`--tsv-out` modes parse into `{start,speaker,text}` segments via
   otter-axi's own lossless parser (so you don't re-derive it). Path is optional (bare →
   auto-path in the OS temp dir `<os-tmpdir>/otter-axi/`; `=path` for explicit); writing is additive —
   stdout keeps the preview and adds `wrote:`/`columns:` + a `jq` hint. One output mode per call.

## Notes

- Read-only: scopes are `profile:read` + `conversations:read`. No write/delete operations exist.
- `otter-axi setup hooks` installs the SessionStart hook (Claude Code / Codex / OpenCode) that
  surfaces the home view at session start; `OTTER_AXI_DISABLE_HOOKS=1` opts out.
- Install ad hoc with `npx -y otter-axi <command>`.
