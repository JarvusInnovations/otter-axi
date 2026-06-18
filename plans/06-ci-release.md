---
status: done
depends: [02-scaffold]
specs:
  - specs/architecture.md
issues: []
---

# Plan 06 — CI & develop→main release automation

## Scope

Wire the GitHub Actions that the sibling AXI tools use: build/test CI plus the Jarvus
develop→main Release-PR automation and npm Trusted Publishing. Create the `develop` integration
branch. Document the one-time manual prerequisites (org token + npm Trusted Publishing).

## Implements

- `specs/architecture.md` — the "CI & release" section.

## Approach

1. Add five workflows under `.github/workflows/` (replicating `metabase-axi` exactly):
   - `ci.yml` — checkout + node 22.22.3 + bun 1.3.14 → install (frozen) / build / test, on
     push+PR to `main`/`develop`.
   - `release-prepare.yml` / `release-validate.yml` / `release-publish.yml` — delegate to
     `JarvusInnovations/infra-components@channels/github-actions/release-*/latest`
     (`release-branch: main`; publish uses `secrets.BOT_GITHUB_TOKEN`).
   - `publish-npm.yml` — on `release: published`, build + `npm publish --provenance --access
     public` via OIDC Trusted Publishing (node 24, `id-token: write`).
2. Commit to `main`, then branch `develop` from `main` and push it (so both branches carry the
   workflows; pushing `develop` will open the first `Release: v*` PR — non-destructive).
3. Flag manual prerequisites to the user: org `BOT_GITHUB_TOKEN` access + npm Trusted Publishing
   config on npmjs.com. Keep `main` as the default branch (matches the sibling).

## Validation

- [x] Five workflow files present and valid YAML; refs match the sibling. Action majors
      confirmed latest live: `checkout@v6` (6.0.3), `setup-node@v6` (6.4.0), `setup-bun@v2`.
- [x] `ci.yml` runs build+test on push/PR to main+develop and **passes green on both** (runs
      27763423689 main, 27763418468 develop).
- [x] `develop` branch exists on the remote (pushed from `main`).
- [x] `release-prepare` **opens the Release PR** — verified: the closeout commit gave `develop`
      its first real diff, and `release-prepare` opened **PR #1 "Release: v0.1.0"** with the bot
      `## Changelog` comment (attributed `@themightychris`). `release-validate` ran; the PR is
      `MERGEABLE` (its `action_required` check awaits the BOT-token/Trusted-Publishing prereqs).
      (The earlier empty-diff `develop == main` push correctly no-opped.)
- [x] Manual prerequisites (BOT_GITHUB_TOKEN, npm Trusted Publishing) documented in
      `specs/architecture.md` and surfaced to the user.

## Risks / unknowns

- `BOT_GITHUB_TOKEN` may not be provisioned for this repo yet — `release-publish` will fail
  until it is (org-level secret; can't verify from here).
- npm Trusted Publishing needs a one-time setup on npmjs.com; the first publish may need a
  manual bootstrap before OIDC works.
- Action major versions (`checkout@v6`, `setup-node@v6`) taken from the sibling rather than a
  live README read (gh-axi repo view resolved to the cwd repo); they're current there.

## Notes

Bootstrapped the workflows onto `main` (so PR-to-main triggers resolve) then branched
`develop`. CI green on both branches first try. The lone red `release-prepare` run is the
empty-diff bootstrap case (main == develop), **not** a misconfiguration — it proves the action
is installed and authenticating. `main` kept as default branch (matches the sibling). Local
checkout left on `develop` (the integration branch for future work). No PR — bootstrap commit
on `main`.

## Follow-ups

- **User action (one-time):** configure npm Trusted Publishing for `JarvusInnovations/otter-axi`
  - `publish-npm.yml` on npmjs.com, and confirm the org `BOT_GITHUB_TOKEN` reaches this repo.
- **First release:** since all v0.1.0 code already sits on `main`, the first npm publish is
  effectively a bootstrap — either publish v0.1.0 manually once, or let the next `develop`
  commit drive the first `Release: v*` PR.
