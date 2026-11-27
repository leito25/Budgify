# Tech Stack: Budgify MVP

## Core Architecture

Budgify is a React single-page app served, together with its API, by one **FastAPI** service. Personal data stays in the browser; the shared Small Business workspace lives in **Postgres on Supabase**, reached only through the API. The service runs on **Render's free plan**. Documented build/wrap steps for **Electron** (desktop) and **Capacitor** (mobile) remain, but a wrapped app would still need the hosted service; working wrapper configs are out of scope.

- **Application Shell:** React with TypeScript, built by Vite into `dist/`, which FastAPI serves.
- **Routing:** Client-side hash routing (in-app view state), so deep links work without server rewrite rules. Search results open a ledger through the hash.
- **Backend:** FastAPI with SQLAlchemy Core and a small migration runner (`api/migrations/`) that runs at startup. Routes in `api/routes/` are found automatically. Settings are `DATABASE_URL`, `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, read from `.env` only by `api/main.py`.
- **Sign-in:** Supabase Auth with email and password. The browser calls Supabase with `fetch` and holds only the publishable key and its session. The backend checks the token against the project's public keys (PyJWT) on every request and takes the person from it. There is no sign-up page; people are added in Supabase's dashboard.
- **Database:** Postgres on Supabase in production (through the session pooler, with prepared statements off), SQLite in memory in tests. Search is case-insensitive on both; `api/db.py` gives SQLite a Unicode-aware `lower()`.
- **Runtime & Build Tooling:** Vite with relative asset paths (`./`), so the same build can later be wrapped for Electron and Capacitor. Python is managed with `uv`.
- **Internationalization:** Full English/Spanish UI toggle covering every UI string; user-entered content is never translated or rewritten. All fonts are bundled locally.
- **Currency Model:** Each workspace has a base currency and a separately chosen display currency, converted with a live rate cached locally.

## UI, Styling & Data Visualization

- **Styling:** Utility-first CSS or component styling with a light mode (the default), a dark mode and a System option that follows the device, chosen in the user menu, and responsive breakpoints covering mobile, laptop, and desktop viewports, honoring Budgify brand tokens/guidelines.
- **Charts & Calendar:**
  - Principal vs. interest breakdown chart and monthly payment timeline chart on the **Dashboard**.
  - Interactive **Payment Calendar** view highlighting due dates, grace periods, overdue items, and payment status updates.
- **Accessibility & Ergonomics:** Keyboard-navigable tables (search filter, column header sorting, row edit/delete with confirmation modals explaining downstream balance/schedule impact) and clear visual badges for overdue obligations and the Small Business 3-loan membership threshold. Paid/Active/Overdue status and overdue badges are derived automatically from dates and payment state, never entered manually.

## Domain Logic & Financial Engine

- **Amortization & Interest Module:** Pure, deterministic TypeScript/JavaScript functions (unit-testable without DOM) handling:
  - Simple interest and compound interest calculations, including conversions/handling between monthly rates and effective rates (such as Colombian _Efectivo Anual_ / _Tasa de Usura_ context and US APR conventions).
  - Credit card installment schedules (e.g., 3-month grocery purchases) and standard/micro/small-business loans. The due date is the first payment date, and the full monthly schedule is generated forward from it.
  - Overdue detection and late-payment interest: payments settle whole installments only; after a 5-day grace period, unpaid installments accrue simple interest at the penalty rate, with no compounding.
  - Net monthly cash flow from recurring income only; one-time income is tracked separately in a balance snapshot.
- **Reference Rate Presets & Rate Helper:** Bundled static data containing Colombian and US reference rate presets and step-by-step guidance on how users can verify or request exact rates and late-fee terms from their bank. Presets are dated reference values labeled "reference only, verify with your bank"; no runtime rate fetching.
- **Financial Quest (Resource Game) Engine:** Deterministic simulation of a guided linear scenario (6-12 simulated months) with one scenario per profile mode, multiple-choice decisions, 3-5 financial literacy challenges, a net-worth/emergency-buffer score, and persisted progress.
- **Report Export:** Client-side generator producing a downloadable amortization CSV plus a print-styled one-page summary of loans, payments, and totals.

## Persistence, Session & Sample Data

- **Local Persistence (Personal):** Browser-native **`IndexedDB`** with a `localStorage` and memory fallback. It holds the Personal workspace, each workspace's display currency and language, the theme, cached exchange rates and Financial Quest progress. Schema 5 removed the name-only profile; the migration keeps a backup of the earlier data.
- **Shared Persistence (Small Business):** Loans, income entries and payments in Postgres, each with who added it, who last changed it and when, and for a payment who settled it. The backend sets these from the signed-in person. Last save wins; there are no live updates.
- **Session:** Supabase's session is kept in the browser's `localStorage`, restored when the app reopens and refreshed before it expires. A 401 from the API signs the person out.
- **Sample Data & Reset:** Personal sample records are seeded in the browser and restored by a confirmed reset. Small Business sample records are written once on the server at first start, with a made-up `.ng` sample person.
- **Storage Limits:** Browser profiles and future Electron and Capacitor installations use separate local storage. Clearing site data, private browsing or memory-only fallback can lose Personal data; make storage failures visible and do not promise cross-device recovery.

## Desktop & Mobile Wrappers (documented, not shipped)

- **Desktop (`Electron`) and Mobile (`Capacitor`):** Documented steps for wrapping the built web app. A wrapped app needs the hosted service for sign-in and Small Business, and keeps push notifications and payment gateways out of scope.
- Working wrapper configs and native build scripts are deferred to a later intent.

## Hosting

- **Render (free plan):** One web service built from the `Dockerfile` and described by `render.yaml`; the three settings are entered in Render. The image leaves out `api/testing.py` and `tests/`. The service sleeps when idle and Supabase pauses an inactive project, so the first request can take a minute.

## Local Development & Verification

- **Run:** `npm run serve` builds the frontend and runs the app as Render does, against Supabase. `npm run dev:api` and `npm run dev` give hot reload. `npm run serve:test` runs the test app with a test sign-in and no Supabase.
- **Tests:** Vitest (jsdom) and pytest (SQLite in memory, network blocked) via `npm run test:unit`, each test under one second; Playwright end-to-end across four projects, each with its own test server and database, with zero console errors and axe checks. CI needs no secrets.
- **Reset Command:** A browser reset action (confirmed in the app) clears the local Personal data and re-seeds the Personal samples; `npm run reset` opens the app to do it.
- **Quality:** `npm run check` runs formatting, lint, complexity, types, secret scanning and the tests.
