# Behavior: invocation, flags and errors

How every command reads its arguments, and how a failure is reported. The rule behind all of
it: **a silently-dropped flag is worse than an error** — the agent gets output it believes is
filtered and proceeds on wrong data.

## Strict parsing

Every command and subcommand declares the flags and positionals it takes in one table
(`src/flags.ts`), and parses through one function. Anything not declared is refused **before
any network call or file write**:

| Input | Code | The error says |
|---|---|---|
| Unknown flag | `UNKNOWN_FLAG` | ``valid flags for `<cmd>`: --a, --b (--help always allowed)`` |
| A retired or commonly-guessed flag | `UNKNOWN_FLAG` | a targeted hint naming the flag to use instead |
| Value flag with no value | `USAGE` | which flag |
| Switch given a value (`--full=yes`) | `USAGE` | that it takes none |
| Value flag given twice | `USAGE` | which flag |
| Extra or missing positional | `USAGE` | the usage line |
| Missing or unknown subcommand | `VALIDATION_ERROR` | the valid subcommands |
| Contradictory flags | `VALIDATION_ERROR` | both flag names |
| Invalid value (date, number, empty filter) | `VALIDATION_ERROR` | what a valid value looks like |

`--help` is valid on every command. Contradictions are rejected, never settled by precedence.

### Lexical rules

- `--flag value` and `--flag=value` both work for value flags.
- **Optional-value flags** (the `fetch` `*-out` exports) take their value only with `=`:
  `--json-out` is a bare flag, `--json-out=path` carries a path. A following token is never
  consumed, so a bare export flag cannot swallow a positional. `--json-out path` is a `USAGE`
  error that names the `=` form.
- A value flag followed by another flag is a missing value. Otherwise the next token is the
  value, so `--title-contains "-5 degrees"` works.
- Only `--<letter>` starts a flag. Other dash-led text (`-5`, `---`) is a positional. The
  exceptions are short names a command declares (`search -q`) or has a hint for (`-n`, `-h`).
- `--` ends flag parsing.

### Retired flags

A renamed or removed flag is **not** kept as a silent alias. It fails as `UNKNOWN_FLAG` with a
hint naming its replacement, carrying the value when one was given with `=`:

| Flag | On | Hint |
|---|---|---|
| `--out[=path]` | `fetch` | `--out is now --text-out; run again with --text-out[=path]` |
| `--json` | `fetch` | use `--json-out` to write the parsed segments to a file |
| `-n`, `--since`, `--until` | `search` | use `--limit`, `--after`, `--before` |
| `-h` | everywhere | use `--help` |

## Errors

Errors are TOON on stdout: `error`, `code`, and `help[]` when there is a next step. Raw
dependency errors and stack traces never reach the output.

| Code | Meaning | Exit |
|---|---|---|
| `USAGE` | Malformed invocation: wrong arity, missing value | 2 |
| `UNKNOWN_FLAG` | Flag not declared for this command | 2 |
| `VALIDATION_ERROR` | Well-formed but invalid: bad value, contradiction, unknown (sub)command | 2 |
| `AUTH` | Not logged in, session expired, or the login flow failed | 1 |
| `RATE_LIMIT` | Upstream rate limit | 1 |
| `UPSTREAM` | The Otter MCP request failed or answered with an unexpected shape | 1 |
| `INTERNAL_ERROR` | Anything not anticipated; `help[]` points at `otter-axi doctor` | 1 |

One exported `formatError` (`src/cli.ts`) owns this mapping and is passed to the SDK: the
three usage-class codes exit 2, every other `AxiError` exits 1, and a non-`AxiError` throw is
wrapped as `INTERNAL_ERROR` with its message and no stack.

## Principles

**Inherited:**

- [Find-and-pull, nothing more](../principles.md#find-and-pull-nothing-more) — a filter the
  tool ignored is a wrong answer about what was found.
