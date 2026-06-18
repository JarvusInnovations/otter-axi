---
status: in-progress
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

- [ ] Five workflow files present and valid YAML; refs match the sibling.
- [ ] `ci.yml` runs build+test on push/PR to main+develop and passes on the current tree.
- [ ] `develop` branch exists on the remote.
- [ ] Pushing `develop` opens a `Release: v*` PR into `main` via `release-prepare`.
- [ ] Manual prerequisites (BOT_GITHUB_TOKEN, npm Trusted Publishing) documented for the user.

## Risks / unknowns

- `BOT_GITHUB_TOKEN` may not be provisioned for this repo yet — `release-publish` will fail
  until it is (org-level secret; can't verify from here).
- npm Trusted Publishing needs a one-time setup on npmjs.com; the first publish may need a
  manual bootstrap before OIDC works.
- Action major versions (`checkout@v6`, `setup-node@v6`) taken from the sibling rather than a
  live README read (gh-axi repo view resolved to the cwd repo); they're current there.

## Notes

_(closeout)_

## Follow-ups

_(closeout)_
