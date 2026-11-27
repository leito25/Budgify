# Budgify

Budgify is a debt and cash-flow planner for Personal and Small Business workspaces in Colombia (COP) and the United States (USD). People sign in with an email and password. Personal data stays in the browser; the Small Business workspace is shared by a small team through a FastAPI backend with its data in Postgres on Supabase. All calculated amounts are estimates, not contractual amounts or financial advice.

The product is described in [docs/spec.md](docs/spec.md) and [docs/specs/sign-in-and-sharing.md](docs/specs/sign-in-and-sharing.md).

## Settings

The backend reads three settings from `.env`, or from the host's environment:

| Name                       | What it is                                                      |
| -------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`             | The Postgres connection. Use Supabase's session pooler address. |
| `SUPABASE_URL`             | The Supabase project address.                                   |
| `SUPABASE_PUBLISHABLE_KEY` | The publishable key. It is also given to the browser.           |

Copy `.env.example` to `.env` and fill in your own values. `.env` is ignored by Git. Without these settings the app does not start in production. People are added in Supabase's dashboard (Authentication); there is no sign-up page. `uv run check_supabase.py` checks the settings without changing anything.

## Run locally

Requirements: Node.js 22.12 or newer and npm, Python 3.15 or newer with [uv](https://docs.astral.sh/uv/), and for the quality checks [Ruff](https://docs.astral.sh/ruff/installation/), [ty](https://docs.astral.sh/ty/installation/) and [Gitleaks](https://github.com/gitleaks/gitleaks#installing) on PATH. Run these commands from the project directory.

```sh
npm ci
uv sync
npm run serve
```

`npm run serve` builds the frontend and runs the app the way Render does, at `http://127.0.0.1:8000`, against the Supabase project in `.env`. Sign in with a person added in the Supabase dashboard. Migrations run when it starts.

For development with hot reload, run `npm run dev:api` and `npm run dev` in two terminals and open the Vite address. Vite proxies `/api` and `/config.json` to the API.

`npm run serve:test` starts the test app instead: fixed sample data, a fixed date, an in-memory database and a test sign-in (`ana@budgify.ng`, password `test-password`) that never contacts Supabase and needs no `.env`. Use it for UI checks.

Signing in and using Small Business need an internet connection. The Personal workspace keeps working in an already-open page without one. There is no service worker, so an offline first visit or reload is not guaranteed.

The target browsers are current Chrome, Edge, Firefox and Safari. Automated browser coverage uses Chromium, Firefox, WebKit and a 375-pixel viewport.

## Tests and build

```sh
npm run check:i18n
npx playwright install
npm run check
npm run build
```

`npm run check` runs formatting, lint, complexity, type and secret checks, then `npm test`. `npm run check:quick` omits the end-to-end tests. `npm run test:unit` runs the frontend tests (vitest, with coverage of at least 80%) and then the backend tests (pytest). `npm run test:e2e` builds the frontend and runs Playwright. Every unit test must finish in under a second.

Neither suite contacts Supabase, and neither needs `.env`. The backend tests use an in-memory SQLite database and block network access. Each Playwright project starts its own test server with its own database, so browsers running in parallel never share data. Install the Playwright browsers once; Linux may also need `npx playwright install-deps`.

`npm ci` installs the Lefthook pre-commit hook. It formats staged files, then runs lint, type and staged-secret checks without tests. Run `node scripts/check.mjs --precommit` to rerun them, or `npm run prepare` to reinstall the hook.

Copilot workspace hooks run the quick check at turn completion and block once on failure. A pre-tool hook denies direct `.env` edits and shell commands that explicitly reference `.env`. This is a safeguard, not filesystem protection. Start a new Copilot session to load the hooks.

CI scans for secrets first, then runs the quick check, the translation parity check and the build. It needs no secrets and does not run the end-to-end tests; run `npm run check` locally before merging.

## Local Personal data

The Personal workspace and each workspace's display currency, language, theme and Financial Quest progress are stored in the browser profile's IndexedDB, falling back to localStorage or temporary memory. A failed write is reported instead of silently switching storage. Signing out ends the session and keeps this data. **Reset sample data** erases it, after confirmation, restores the Personal sample records and does not touch shared Small Business data. `npm run reset` opens the app in the system browser; the reset itself is confirmed in the app.

## Privacy and limitations

Anyone using the same browser profile may see the Personal data, whoever is signed in. It is not synced between devices, and private browsing, cleared storage or memory-only mode can cause data loss. Small Business data is visible to everyone who can sign in; there are no roles. Budgify does not connect to banks, offer credit, make payments, or treat static reference rates as legal limits or offers.

## Deployment

The app is one web service on Render's free plan: FastAPI serves the built frontend and the API, and migrations run at startup. [render.yaml](render.yaml) describes it and the [Dockerfile](Dockerfile) builds it. To deploy:

1. In Render, create a Blueprint from this repository.
2. Enter `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` when asked. Use the session pooler address for `DATABASE_URL`, because Supabase's direct address is IPv6 only and Render's free plan needs IPv4.
3. Open the service's `onrender.com` address and sign in.

To deploy from CI instead of by hand: in the Render service, open Settings, copy the **Deploy Hook** URL, and save it in GitHub as the Actions secret `RENDER_DEPLOY_HOOK_URL`. `.github/workflows/deploy.yml` then deploys after CI passes on `main`, and can also be run by hand from the Actions tab. `render.yaml` sets `autoDeploy: false`, so Render does not deploy on its own.

On the free plan the service sleeps when idle and Supabase pauses an inactive project, so the first request after a pause can take a minute. The Docker image leaves out `api/testing.py` and `tests/`, so the test sign-in never reaches production.

See [docs/wrap-electron.md](docs/wrap-electron.md) and [docs/wrap-capacitor.md](docs/wrap-capacitor.md) for documented future wrapper paths. No desktop or native wrapper is shipped, and a wrapped app would still need the hosted service.
