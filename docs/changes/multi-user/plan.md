# Plan: sign-in, search and a user menu

Read with [intent.md](./intent.md), [../../spec.md](../../spec.md) and [../../specs/sign-in-and-sharing.md](../../specs/sign-in-and-sharing.md). No code is written in this step.

## Files that change

Files are grouped into parts. Each file belongs to one part only, so parts can be built by different agents at the same time without editing the same file. `src/App.tsx` is 2,764 lines and holds the whole app, so part G owns it alone and edits it in every phase. Every other frontend part writes new files that G wires in. Backend routes are found by `create_app` (it loads every module in `api/routes/` that defines `router`), so adding a route never touches `api/app.py`.

Python code goes in a new `api/` package. Python tests go in `tests/api/`.

### Part A: Tooling and test harness (phase 1, first)

- `pyproject.toml`, `uv.lock`: project dependencies, pytest settings.
- `package.json`: `test:unit` runs vitest, then pytest. New scripts `serve` (build, then run the app as Render does), `serve:test` (the test server, below) and `dev:api`.
- `vite.config.ts`: 1-second test timeout; dev proxy of `/api` and `/config.json` to the API.
- `playwright.config.ts`: one test server per project, each on its own port with its own in-memory database, so parallel browsers never share data.
- `tests/e2e/server.py`: starts the test app with fixed sample data and a fixed date. It never loads `.env`.
- `scripts/check.mjs`: runs the Python tests with the other checks.
- `.github/workflows/ci.yml`: installs the Python dependencies with `uv sync`. No secrets are added.
- `.claude/agents/ui-check.md`: tells the agent to start from `npm run serve:test`, and gives the test sign-in.

### Part B: Backend core (phase 1)

- `api/__init__.py`
- `api/settings.py`: reads the three settings. Only `api/main.py` loads `.env`.
- `api/db.py`: engine, with SQLite using a Unicode-aware `lower()` so search matches Postgres.
- `api/tables.py`: SQLAlchemy Core tables for people, workspace settings, loans, payments and income entries.
- `api/migrations/__init__.py`, `api/migrations/m0001_create_tables.py`: a small runner and the first migration. The runner records applied migrations and runs at startup.
- `api/auth.py`: token verifier interface, the Supabase verifier, the `current_person` dependency, and the upsert of the person on each request.
- `api/app.py`: `create_app(settings, verifier, engine, today)`, the health check, `/config.json`, the route loader, and serving `dist/`.
- `api/main.py`: the production entry. Loads `.env`, builds the Supabase verifier.
- `api/testing.py`: the test verifier and a fake Supabase sign-in endpoint. Used only by tests and `tests/e2e/server.py`.
- `tests/api/conftest.py`: in-memory SQLite, no network, and a rule that fails any test over 1 second.
- `tests/api/test_settings.py`, `test_migrations.py`, `test_auth.py`, `test_app.py`.

### Part C: Backend data (phase 1; starts when B has `tables.py` and `auth.py`)

- `api/schemas.py`
- `api/routes/workspace.py`, `api/routes/loans.py`, `api/routes/income.py`
- `api/sample_data.py`: the Small Business sample records and a sample person, written once, relative to the date passed in.
- `tests/api/test_workspace.py`, `test_loans.py`, `test_income.py`, `test_audit.py`, `test_sample_data.py`

### Part D: Backend search (phase 2)

- `api/search.py`, `api/routes/search.py`
- `tests/api/test_search.py`

### Part E: Frontend data model (phase 1)

- `src/domain/types.ts`: audit fields on loans, payments and income entries (who added, who changed, who settled, and when).
- `src/storage/model.ts`: schema 5. Removes the name-only profile. Widens `Theme` to include `"system"` now, so phase 3 does not touch storage.
- `src/storage/repository.ts`: migration 4 to 5. The existing backup step keeps the old data.
- `src/storage/seed.ts`: Personal sample data only. Reset restores Personal only.
- `tests/fixtures/loans.ts`, `tests/unit/storage.test.ts`, `tests/unit/seed.test.ts`

### Part F: Frontend sign-in (phase 1)

- `src/auth/config.ts`: reads `/config.json`.
- `src/auth/supabase-auth.ts`: password sign-in and token refresh with `fetch`.
- `src/auth/session.ts`: keeps and restores the session; sign-out.
- `src/auth/SignInScreen.tsx`
- `src/styles/auth.css`
- `src/i18n/en.ts`, `src/i18n/es.ts`: sign-in strings, "Added by", "Changed by", "Settled by", loading and connection messages.
- `tests/unit/auth.test.ts`

### Part G: Frontend shell (all three phases)

- `src/App.tsx`: shows the sign-in screen when signed out; removes the name-only sign-in; sends Small Business reads and writes to the API store and Personal ones to local storage; shows who added each record; later adds the search box and the user menu and removes the theme button and Sign out button.
- `src/main.tsx`: imports the new stylesheets.
- `src/components/DataTable.tsx`: only if the "Added by" column needs it.
- `src/styles/global.css`: layout for the new top bar; removes `.theme-toggle` in phase 3.
- `tests/unit/app.test.tsx`, `tests/e2e/app.spec.ts`: use the new sign-in; Small Business tests use the API store.
- `tests/e2e/sign-in.spec.ts` (phase 1), `tests/e2e/search.spec.ts` (phase 2), `tests/e2e/menu.spec.ts` (phase 3)

### Part H: Frontend API client (phase 1)

- `src/api/client.ts`: sends the bearer token; a 401 signs the person out.
- `src/api/business-store.ts`: loads the workspace and saves loans, payments and income through the API, behind the same shape the app uses for local data.
- `tests/unit/api-client.test.ts`, `tests/unit/business-store.test.ts`

### Part I: Frontend search (phase 2)

- `src/search/SearchBox.tsx`, `src/search/local-search.ts`, `src/search/remote-search.ts`
- `src/styles/search.css`
- `src/i18n/en.ts`, `src/i18n/es.ts`: search strings.
- `tests/unit/local-search.test.ts`, `tests/unit/search-box.test.tsx`

### Part J: Frontend user menu (phase 3)

- `src/components/UserMenu.tsx`, `src/theme/theme.ts`: initials, theme choice, and following the device.
- `src/styles/menu.css`
- `src/i18n/en.ts`, `src/i18n/es.ts`: menu strings.
- `tests/unit/theme.test.ts`, `tests/unit/user-menu.test.tsx`

### Part K: Hosting and docs (phase 1, last)

- `Dockerfile`, `.dockerignore`: build the frontend, then run FastAPI. `.dockerignore` leaves out `api/testing.py` and `tests/`.
- `render.yaml`: the web service, with the three settings marked "set in Render".
- `.env.example`: the three names with made-up values.
- `.github/workflows/pages.yml`: deleted, because a static build can't sign in.
- `README.md`: new run and deploy instructions, and the Pages link removed.
- `docs/TechStack.md`, `docs/wrap-electron.md`, `docs/wrap-capacitor.md`, `docs/Status.md`

### Part ownership of shared files

`src/i18n/en.ts` and `es.ts` are edited by F in phase 1, I in phase 2 and J in phase 3. Phases run one after another, so they never overlap. Each part adds its own keys, and G only uses keys those parts have already added.

### New dependencies

- **Python:** `fastapi` and `uvicorn` to serve; `sqlalchemy` and `psycopg[binary]` for the database; `pyjwt[crypto]` to check Supabase tokens against the project's public keys, fetched once and cached. Checking locally keeps every test offline and fast, and avoids a Supabase call on each request. Dev only: `pytest`, and `httpx` (FastAPI's test client needs it). `python-dotenv` loads `.env` in `api/main.py` only.
- **Not added:** Alembic (a runner of about 50 lines covers a few tables), `supabase-py`, `supabase-js` (two `fetch` calls cover password sign-in and refresh), `pydantic-settings`, `pytest-timeout` (a conftest rule does it).
- **Frontend:** none.

## Order of work

### Phase 0: Measure

Run `npm run test:unit` and note any existing test over 1 second. Fix those tests first, not the limit.

### Phase 1: Sign-in and the database

The API the parts agree on:

- `GET /health`, `GET /config.json` (public: Supabase URL and publishable key)
- `GET /api/me`
- `GET /api/workspace`: region, base currency, loans, payments, income, each with who added and changed it
- `POST /api/loans`, `PUT` and `DELETE /api/loans/{id}`, `POST /api/loans/{id}/payments`
- `POST /api/income`, `PUT` and `DELETE /api/income/{id}`
- Every `/api` route returns 401 without a valid token. The person comes from the token only.

Steps:

1. **A** alone: tooling, dependencies, the timing rules, the test server entry.
2. **B** and **E** and **F** in parallel. B first delivers `tables.py` and `auth.py`.
3. **C** and **H** in parallel, once B's tables exist.
4. **G**: the shell, after E, F and H are merged. This is the longest step.
5. **K**: hosting and docs.
6. Run the app against the real Supabase project (success criterion 6): migrations on a fresh database, sign-in with a person added in the dashboard, add a loan, check "added by". Use the pooler connection string (see Risks).
7. `ui-check` on the sign-in screen and the five pages. Fix, then commit.

Done when: signed out shows only the sign-in screen, signed in everything works as before, and `npm run check` passes with and without `.env`.

### Phase 2: Search

1. **D** and **I** in parallel.
2. **G**: put the search box in the top bar. A result opens its ledger with that record highlighted, through the hash.
3. `ui-check` on the top bar at desktop and phone widths.

### Phase 3: User menu

1. **J**.
2. **G**: add the menu, remove the theme button, the Sign out button and the sign-in screen's theme button.
3. `ui-check` on the menu in both themes and at both widths.

### Deploy

Review with the `reviewer` agent, fix, follow `docs/IMPROVE.md`, then merge. Create the Render service from `render.yaml` and enter the three settings there.

## Risks

1. **`App.tsx` is one file.** Every phase goes through part G, so G is the slowest path. Keep the Small Business store behind the same shape as local data so the many save calls in `App.tsx` change little.
2. **A test sign-in reaching production.** The test verifier lives in `api/testing.py`, which `api/main.py` never imports and the Docker image leaves out. A test checks that `main.py` doesn't import it.
3. **Token keys.** `pyjwt` needs the project to sign tokens with public keys. If the Supabase project still uses the older shared secret, the key list is empty. Check this in step 6 of phase 1. The fallback is asking Supabase to verify the token with `httpx`.
4. **SQLite and Postgres differ.** SQLite's `lower()` only handles ASCII, so "PANADERÍA" would not match "Panadería". `api/db.py` replaces it on SQLite, and `test_search.py` covers accented names. Amounts need `BigInteger` (18,000,000 COP in minor units is over 32 bits). Tests never run on Postgres, so these only show up in step 6 of phase 1.
5. **Render and Supabase connections.** Supabase's direct database address is IPv6 only, and Render's free plan needs IPv4. `DATABASE_URL` must be the pooler address, and the transaction pooler needs prepared statements turned off in the driver.
6. **Free plans sleep.** Render stops the service when idle and Supabase pauses an inactive project. The first request can take a minute. Noted in the spec.
7. **Old local data.** Migration 4 to 5 stops using the local Small Business data. The migration backup keeps it, but nothing shows it.
8. **The 1-second rule on a slow machine.** Importing FastAPI and rendering `App` in jsdom are the likely slow spots. Phase 0 measures them, and the 1-second limit is enforced in both vitest and pytest so a slow test fails on the first run.
9. **Parallel browsers.** Four Playwright projects share nothing because each has its own test server and database. If that proves too heavy, business tests will use unique names instead.
10. **Last save wins, and the server trusts the amounts the browser sends.** Both are in the intent's scope. Schedules and penalties are still calculated in the browser.
11. **Sample data dates.** The sample loans are relative to today. The server writes them once, at first start, using the date it is given, so tests use a fixed date and nothing reads the clock.
12. **Documents out of date.** `TechStack.md` and the wrapper docs describe a no-backend app. Part K rewrites them in the same change.

## Proof

### Unit tests (vitest, jsdom, each under 1 second)

- `auth.test.ts`: sign-in sends the email and password and keeps the session; a wrong password shows one message that doesn't say which part was wrong; the session is restored after a reload; sign-out clears it; an expired token refreshes.
- `api-client.test.ts`: the bearer token is sent; a 401 signs the person out; failures are shown, not hidden.
- `business-store.test.ts`: loading maps the API's workspace to the app's shape; adding, editing, deleting and settling call the right routes and show the saved result.
- `storage.test.ts`, `seed.test.ts`: migration 4 to 5 drops the profile and keeps a backup; Personal reset restores Personal sample data only; `"system"` is a valid theme.
- `app.test.tsx`: signed out shows only the sign-in screen; signed in, Personal works as before and Small Business reads from the store; each record shows who added it; the old tests still pass with the new sign-in.
- `local-search.test.ts`, `search-box.test.tsx`: a match on part of a name in any case; results name the kind of record; no match shows a message; the box works with the keyboard.
- `theme.test.ts`: System follows the device's setting and changes with it; the choice is saved and restored; Light is the default.
- `user-menu.test.tsx`: initials from the name or the email; opens with Enter or Space, closes with Escape, and focus returns; Sign out works.

### Unit tests (pytest, SQLite in memory, no network, each under 1 second)

- `test_settings.py`: the three settings are read; a missing one stops the app in production; tests build the app without `.env`.
- `test_migrations.py`: migrations apply once and are safe to run again.
- `test_auth.py`: no token, a bad token, an expired token and a token for another project are refused; the person comes from the token and not from the request; the person row is created and updated.
- `test_app.py`: `/health` and `/config.json` are public; every `/api` route returns 401 signed out; `main.py` does not import `api/testing.py`.
- `test_workspace.py`, `test_loans.py`, `test_income.py`: create, read, update, delete and settle; amounts above 32 bits are kept.
- `test_audit.py`: added-by and changed-by are set from the token, ignore anything the request sends, and change correctly on edit; settling records who settled.
- `test_sample_data.py`: sample data is written once, at the given date, with a made-up `.ng` person.
- `test_search.py`: part of a name, any case, accented names, `%` and `_` treated as plain characters, loans and income both found, signed out refused.

### End-to-end tests (Playwright, four projects, test server, no Supabase)

- `sign-in.spec.ts`: every page shows the sign-in screen when signed out; the wrong password is refused with a text message; the right one opens the dashboard; reload keeps the session; Sign out returns to the sign-in screen; no console errors; axe finds no violations.
- `app.spec.ts`: the existing flows run signed in. Small Business changes survive a reload and show who added them. Personal data stays in the browser.
- `search.spec.ts`: "pan" finds a Small Business loan or income entry in any case; the result opens its ledger; works at the phone width.
- `menu.spec.ts`: Dark, Light and System; System follows an emulated device setting; the choice survives a reload; contrast of the menu in both themes with the existing helper; keyboard use; Sign out.

### Checks and manual proof

1. `npm run check` passes with `.env` present and with it removed. The pytest rule that blocks network connections shows nothing contacts Supabase.
2. Signed out, the e2e and API tests show the sign-in screen and 401s. Signed in, the whole e2e suite passes.
3. The added-by tests above, plus a look in `ui-check`.
4. The search tests above.
5. The theme and menu tests above.
6. By hand: `npm run serve` on this computer, signed in against Supabase with a person added in the dashboard, then the same on Render after deploy. This is also the only run on Postgres.
