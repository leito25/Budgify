# Agent instructions

- Read `docs/spec.md` first. It is the product description and specification for Budgify as it exists today.
- Follow `docs/STANDARDS.md` when making code changes.
- Each change has a folder at `docs/changes/<branch name>/` containing its `intent.md` and `plan.md`. Read only the folder for the current change; do not read other change folders.
- Run `npm test` for the complete unit and end-to-end test suites. It must fail if either suite fails. Install the Playwright browsers with `npx playwright install` before the first run; Linux may also require `npx playwright install-deps`.
- `npm run test:unit` and `npm run test:e2e` run the individual suites.
- Keep shared code and tooling compatible with Windows, future Electron desktop packaging, and future Android Capacitor packaging. The wrappers are not yet shipped; see `docs/wrap-electron.md` and `docs/wrap-capacitor.md`.
- Follow `.github/copilot-instructions.md` for the remaining project guidance and update `docs/Status.md` when finishing work.