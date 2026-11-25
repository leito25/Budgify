# Budgify

Budgify is an offline-capable debt and cash-flow planner for Personal and Small Business workspaces in Colombia (COP) and the United States (USD). All calculated amounts are estimates, not contractual amounts or financial advice.

## Run locally

Requirements: Node.js 22.12 or newer in a supported Node release line and npm. Quality checks also require Python, [Ruff](https://docs.astral.sh/ruff/installation/), [ty](https://docs.astral.sh/ty/installation/), and [Gitleaks](https://github.com/gitleaks/gitleaks#installing) on PATH. Run these commands from the `Budgify` project directory, where `package.json` and `package-lock.json` are located.

```sh
npm ci
npm start
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Runtime calculations and persistence are client-side; fonts, translations, and reference rates are bundled and are not fetched. An already-open page can continue working offline, but this MVP has no service worker, so an offline reload or first visit is not guaranteed.

The target browsers are current Chrome, Edge, Firefox, and Safari. Automated browser coverage uses Chromium, Firefox, WebKit, and a 375-pixel responsive viewport.

## Tests and build

```sh
npm run check:i18n
npx playwright install
npm run check
npm run build
```

`npm run check` runs formatting, lint, complexity, type and working-tree secret checks, then `npm test`. `npm run check:quick` omits end-to-end tests. Unit coverage must reach 80% for statements, branches, functions and lines across `src`. Use `npm run format` to fix formatting. The Python checks currently find no files because the app has no backend. Gitleaks scans the working tree, respecting Git ignores including `.env`, and shows redacted finding details.

`npm test` runs all unit tests followed by all Playwright end-to-end projects and fails if either suite fails. For individual suites, use `npm run test:unit` or `npm run test:e2e`. Install Playwright browsers once after installing dependencies; Linux may also require `npx playwright install-deps`.

`npm ci` installs the Lefthook pre-commit hook. It formats supported staged files, preserving unstaged edits, then runs lint, type and staged-secret checks without tests. Secret findings show their file, line and rule with the secret redacted. Run `node scripts/check.mjs --precommit` to rerun the checks without formatting staged files, or `npm run prepare` to reinstall the hook.

Copilot workspace hooks run the quick check at turn completion and block once on failure. A pre-tool hook denies direct `.env` edits and shell commands that explicitly reference `.env`. Indirect writes, other tools and hook timeouts cannot be reliably blocked; this is a safeguard, not filesystem protection. Start a new Copilot session to load the hooks.

Playwright's `mobile-chromium` project uses a 375-pixel viewport to exercise the responsive layout. Firefox, WebKit, and additional tablet/desktop viewports can be selected in `playwright.config.ts`.
CI scans for secrets first, runs the full check using the runner's Google Chrome, and uploads the Playwright report if a check fails.

## Reset local data

Budgify stores the name and data in the current browser profile's IndexedDB, falling back to localStorage or temporary memory when selecting storage. Once a storage backend is in use, a failed write is reported instead of silently switching to a potentially stale copy. Signing out preserves the name and data; an active session resumes after reopening the browser. To erase the saved name and data and restore sample records, use **Reset sample data** and confirm. The app then returns to name entry. To open the app in the system browser from another terminal, run:

```sh
npm run reset
```

The command accepts an optional app URL, for example `npm run reset -- http://localhost:4173/`. The reset action is confirmed in the app; it cannot clear data stored in a different browser profile. Clearing the browser's site data also removes Budgify data.

## Privacy and limitations

The name-only local sign-in is not authentication. Anyone using the same browser profile may see the saved data. Data is not synced between devices or app installations, and private browsing, cleared storage, or memory-only mode can cause data loss. Budgify does not connect to banks, offer credit, make payments, or treat static reference rates as legal limits or offers.

## Deployment

Vite builds static files into `dist/` with relative asset paths for GitHub Pages subpaths. The GitHub Actions Pages workflow deploys pushes to `main`; enable GitHub Pages with **GitHub Actions** as the build and deployment source in repository settings. A live deployment still needs to be enabled and verified in the target repository.

See [docs/wrap-electron.md](docs/wrap-electron.md) and [docs/wrap-capacitor.md](docs/wrap-capacitor.md) for documented future wrapper paths. No desktop or native wrapper is shipped.
