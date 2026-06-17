# Command: fetch

Pull a full transcript via the MCP `fetch` tool.

## Invocation

```
otter-axi fetch <id|url> [flags]
```

`<id|url>` (required) is a conversation slug (`aBcDeFgHiJkLmNoPqRsTuVwXyZ0`) **or** a full
`https://otter.ai/u/<id>[?…]` URL. A URL is normalized to its `<id>` before calling the tool
(query string and fragments stripped). Missing argument → `AxiError("VALIDATION_ERROR", …)`,
exit 2; no prompt.

## Flags

| Flag | Effect |
|---|---|
| `--out <path>` | Write the full transcript to a file; stdout gets a confirmation + preview. |
| `--full` | Print the entire transcript to stdout instead of a preview. |

## Data requirements

Calls MCP `fetch` with `{ id }`. Requires valid auth ([behaviors/auth.md](../behaviors/auth.md));
refreshes/retries transparently. Exact output shape (transcript format, included metadata,
speaker labels, summary) is **(TBD: spike)** — plan 01 captures it before this command is built.

## Display rules

- Transcripts are large. **Default: preview-to-stdout, full-to-file** (the metabase-axi
  pattern). Stdout shows conversation metadata (id, title, created, attendees as available)
  plus a capped preview of the transcript body with a `…(truncated, N chars total)` marker.
- `--out <path>` writes the complete transcript to the file and returns a confirmation object
  (path, byte/char count) — the full body is never dumped inline in this mode.
- `--full` overrides truncation and prints the whole transcript to stdout (for piping).
- **Not found / invalid id:** definitive `AxiError` naming the id, with a `help[]` pointing
  back to `search`.

## Actions

Read-only. No mutation.

## Navigation

Terminal in the find→pull flow. A detail/transcript view; per AXI convention it omits the
next-step `help[]` that list views carry, except the not-found error path.

## Principles

**Inherited:**

- [Find-and-pull, nothing more](../principles.md#find-and-pull-nothing-more) — `fetch`
  returns the transcript **as-is**. It does not summarize, re-segment, or strip the body;
  shaping is the consumer's job.
