---
status: planned
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

- [ ] `otter-axi setup hooks` writes the Claude Code SessionStart entry idempotently.
- [ ] `bun scripts/build-skill.ts` generates `SKILL.md`; `--check` fails on drift.
- [ ] `README.md` documents install + the find→pull workflow.
- [ ] A fresh session's SessionStart shows the otter-axi home payload.

## Risks / unknowns

- None significant; this mirrors established sibling-tool patterns.

## Notes

_(closeout)_

## Follow-ups

_(closeout)_
