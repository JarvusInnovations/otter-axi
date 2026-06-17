---
status: done
depends: []
specs:
  - specs/architecture.md
issues: []
---

# Plan 02 — Project scaffold

## Scope

Stand up the otter-axi project skeleton per `architecture.md`: toolchain, dependencies, CLI
entry/dispatch wiring, shared helpers, command stubs, the specops CLAUDE.md hook, and the
test harness. No real upstream calls yet — `home`/`doctor`/`setup` are stubs that compile and
render, and `search`/`fetch`/`auth` are registered but may return "not implemented" until
later plans.

## Implements

- `specs/architecture.md` — stack, layout, config path, output kit, command surface.

## Approach

1. `asdf set bun latest && asdf set nodejs latest && asdf install`; write `.tool-versions`.
2. `bun add axi-sdk-js @toon-format/toon @modelcontextprotocol/sdk`;
   `bun add -d typescript @types/node vitest`.
3. `package.json` (`type: module`, `bin: { otter-axi: dist/bin/otter-axi.js }`, files, build/
   dev/test scripts) and `tsconfig.json` (Node16 ESM, `rootDir: "."`, `outDir: dist`).
4. `bin/otter-axi.ts` shim; `src/cli.ts` (`runAxiCli(cliOptions())`, `TOP_HELP`,
   `COMMAND_HELP`); `src/meta.ts` (`DESCRIPTION`, `readVersion`).
5. `src/flags.ts` (parseArgs/strFlag/hasFlag), `src/output.ts` (truncateCell, countLabel,
   relativeTime), `src/config.ts` (XDG config.json, 0700/0600, `OTTER_AXI_CONFIG_DIR`).
6. Command stubs: `home`, `doctor`, `setup` (wires `installSessionStartHooks({ marker:
   "otter-axi", binaryNames: ["otter-axi"] })`), plus registered `auth`/`search`/`fetch`.
7. Add the specops hook block to a new project `CLAUDE.md`; remove the unused `.env`/
   `.env.example` (Enterprise REST key, not used by the MCP client).
8. Vitest smoke tests: `--help`, `--version`, unknown-command exit code, home renders.

## Validation

- [x] `bun bin/otter-axi.ts --help` prints `TOP_HELP`; `--version` prints the version.
- [x] `bun bin/otter-axi.ts` (home) renders a content-first object without throwing.
- [x] Unknown command exits 2 with a structured error.
- [x] `tsc` builds to `dist/` and `node dist/bin/otter-axi.js --help` works.
- [x] `vitest run` passes (7 tests).
- [x] `CLAUDE.md` carries the specops hook block; `.env`/`.env.example` removed.

## Risks / unknowns

- `@modelcontextprotocol/sdk` ESM/Node16 interop quirks — pin a known-good version and verify
  `tsc` resolution early.

## Notes

Resolved deps: `@modelcontextprotocol/sdk@1.29.0`, `@toon-format/toon@2.3.0`,
`axi-sdk-js@0.1.7`; toolchain `bun 1.3.14` / `nodejs 22.22.3` (matches sibling tools). No
MCP-SDK interop issues — `tsc` (Node16 ESM) builds clean. `auth`/`search`/`fetch` are
registered stubs that throw `AxiError(code: "UNIMPLEMENTED")` pointing at plans 03/04;
`home`/`doctor`/`setup` are functional at the config level (no network yet). Simplified the
config model from metabase's multi-profile shape to a single OAuth credential set
(`client`/`tokens`/`user`) in `src/config.ts`. SDK `stdout` test override is `{ write }`,
not a function. No PR — repo has no git remote (committed to local `main`).

## Follow-ups

- **Deferred to plan 03:** live token-validity + MCP-reachability tiers in `doctor` (the
  scaffold ships only the config-level credential check).
- **Deferred to plan 04:** live state in the `home` view (currently cache-only).
