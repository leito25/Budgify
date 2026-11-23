# Project instructions

- Run `npm test` for the complete unit and end-to-end test suites. It must fail if either suite fails. Install the Playwright browsers with `npx playwright install` before the first run; Linux may also require `npx playwright install-deps`.
- `npm run test:unit` and `npm run test:e2e` run the individual suites.
- Keep shared code and tooling compatible with Windows, future Electron desktop packaging, and future Android Capacitor packaging. The wrappers are not yet shipped; see `docs/wrap-electron.md` and `docs/wrap-capacitor.md`.
- Follow `.github/copilot-instructions.md` for the existing project guidance and update `docs/Status.md` when finishing work.