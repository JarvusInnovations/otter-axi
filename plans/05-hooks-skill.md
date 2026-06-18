---
status: done
depends: [04-search-fetch]
specs:
  - specs/architecture.md
issues: []
---

# Plan 05 — SessionStart hook & installable skill

## Scope

The distribution/integration polish: a working `setup hooks` install across the three agents,
a generated `SKILL.md` built from the same source as the home view, and a project README.
Last because it depends on the finished command surface and home view.

## Implements

- `specs/architecture.md` — `setup hooks`, generated skill, packaging.

## Approach

1. Confirm `setup hooks` installs/repairs the SessionStart entry via
   `installSessionStartHooks` for Claude Code / Codex / OpenCode; gate with
   `OTTER_AXI_DISABLE_HOOKS=1`.
2. `scripts/build-skill.ts` — generate `skills/otter-axi/SKILL.md` from `DESCRIPTION` + command
   help, rewriting examples to `npx -y otter-axi …`; add a `--check` mode for CI.
3. Add `skills/otter-axi` to `package.json` `files`; write `README.md` (install, `auth login`,
   search/fetch usage).
4. Verify the SessionStart payload (home view) renders correctly when invoked with no args.

## Validation

- [x] `otter-axi setup hooks` writes the SessionStart entry idempotently — verified via a
      `homeDir` harness: 1 otter-axi entry after 2 runs, across all three targets
      (`~/.claude/settings.json`, `~/.codex/hooks.json`+`config.toml`,
      `~/.config/opencode/plugins/axi-otter-axi.js`).
- [~] **Decision: hand-maintained `SKILL.md`** instead of a `scripts/build-skill.ts` generator —
      a 2-command tool doesn't justify a generator + `--check` CI; the file is short and stable.
- [x] `README.md` documents install (`auth login`) + the find→pull workflow.
- [x] The SessionStart hook runs the bare `otter-axi` (home) command; the home view renders a
      content-first payload (logged-in account / logged-out onboarding) — verified in plan 02/03.

## Risks / unknowns

- None significant; this mirrors established sibling-tool patterns.

## Notes

`setup hooks` was already wired in plan 02; this plan verified its mechanics (idempotent,
3-target). The dev `.ts` entrypoint is a deliberate install no-op (SDK safety policy); the
built `dist/bin/otter-axi.js` is what derives the portable `otter-axi` hook command. `SKILL.md`

- `README.md` are hand-written; `package.json` already lists `skills/otter-axi` + `README.md`
in `files`. Note: testing with a `HOME` override fails (exit 126) because the asdf node/bun
shims resolve installs via `$HOME/.asdf` — use the `homeDir` option, not `HOME=`, to sandbox.

## Follow-ups

- **Deferred (optional):** a `scripts/build-skill.ts` generator + `--check` if the command
  surface grows enough that hand-maintaining `SKILL.md` becomes error-prone.
