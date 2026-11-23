# Tech Stack: Budgify MVP

## Core Architecture

Budgify is built as a **client-side, offline-capable single-page web application (SPA)** with zero server-side backend or external database dependencies. The MVP delivers the web bundle, hostable statically on **GitHub Pages**, plus documented build/wrap steps for **Electron** (desktop) and **Capacitor** (mobile); working wrapper configs are out of MVP scope. It runs locally from a single documented command across macOS, Linux, and Windows.

- **Application Shell:** Modern component-based web framework (e.g., React or Vue with TypeScript) compiling to static assets (`dist/`).
- **Routing:** Client-side hash or memory routing (`HashRouter` / in-app view state) so deep navigation works reliably on GitHub Pages, `file://` / Electron loads, and Capacitor WebViews without server rewrite rules.
- **Runtime & Build Tooling:** Fast static bundler and dev server (e.g., Vite) configured with relative asset paths (`./`) so the same build artifact works on GitHub Pages subpaths and can later be wrapped for Electron and Capacitor.
- **Internationalization:** Full English/Spanish UI toggle covering every UI string (forms, charts, Rate Helper, Financial Quest, report headers); user-entered content is never translated or rewritten. All fonts are bundled locally so the app works fully offline.
- **Currency Model:** One currency per workspace, fixed by region (COP for Colombia, USD for the United States). No conversion or mixed-currency totals.

## UI, Styling & Data Visualization

- **Styling:** Utility-first CSS or component styling configured strictly for **light mode** with responsive breakpoints covering mobile, laptop, and desktop viewports, honoring Budgify brand tokens/guidelines.
- **Charts & Calendar:**
  - Principal vs. interest breakdown chart and monthly payment timeline chart on the **Dashboard**.
  - Interactive **Payment Calendar** view highlighting due dates, grace periods, overdue items, and payment status updates.
- **Accessibility & Ergonomics:** Keyboard-navigable tables (search filter, column header sorting, row edit/delete with confirmation modals explaining downstream balance/schedule impact) and clear visual badges for overdue obligations and the Small Business 3-loan membership threshold. Paid/Active/Overdue status and overdue badges are derived automatically from dates and payment state, never entered manually.

## Domain Logic & Financial Engine

- **Amortization & Interest Module:** Pure, deterministic TypeScript/JavaScript functions (unit-testable without DOM) handling:
  - Simple interest and compound interest calculations, including conversions/handling between monthly rates and effective rates (such as Colombian *Efectivo Anual* / *Tasa de Usura* context and US APR conventions).
  - Credit card installment schedules (e.g., 3-month grocery purchases) and standard/micro/small-business loans. The due date is the first payment date, and the full monthly schedule is generated forward from it.
  - Overdue detection and late-payment interest: payments settle whole installments only; after a 5-day grace period, unpaid installments accrue simple interest at the penalty rate, with no compounding.
  - Net monthly cash flow from recurring income only; one-time income is tracked separately in a balance snapshot.
- **Reference Rate Presets & Rate Helper:** Bundled static data containing Colombian and US reference rate presets and step-by-step guidance on how users can verify or request exact rates and late-fee terms from their bank. Presets are dated reference values labeled "reference only, verify with your bank"; no runtime rate fetching.
- **Financial Quest (Resource Game) Engine:** Deterministic simulation of a guided linear scenario (6-12 simulated months) with one scenario per profile mode, multiple-choice decisions, 3-5 financial literacy challenges, a net-worth/emergency-buffer score, and persisted progress.
- **Report Export:** Client-side generator producing a downloadable amortization CSV plus a print-styled one-page summary of loans, payments, and totals.

## Persistence, Session & Sample Data

- **Local Persistence:** Browser-native **`IndexedDB`** (with a structured storage wrapper and `localStorage` fallback/flags) so all loans, income entries, payment statuses, and game progress persist across browser refreshes and app restarts with no internet connection required. `Personal` and `Small Business` are separate data sets; switching modes swaps the active data.
- **Local Profile & Session:** Save one name-only local profile separately from the session. Restore an active session across restarts; signing out preserves the name and data and shows the saved name on return. This is not authentication, and there is no registration, cloud sync, or remote server.
- **Sample Data & Reset:** Seed dataset loaded on first run (realistic credit card installments, microloans, small-business loans across industries, sample income, calendar dates, and overdue examples). A confirmed in-app reset erases the name and local data, restores sample state, and returns to name entry.
- **Storage Limits:** Browser profiles and future Electron and Capacitor installations use separate local storage. Clearing site/app data, private browsing, or memory-only fallback can lose data; make storage failures visible and do not promise cross-device recovery.

## Desktop & Mobile Wrappers (documented, not shipped in the MVP)

- **Web / GitHub Pages:** Static build output deployed from the repository's build pipeline; this is the MVP deliverable.
- **Desktop (`Electron`):** Documented steps for wrapping the built static web app for macOS, Linux, and Windows using local storage without requiring remote APIs.
- **Mobile (`Capacitor`):** Documented steps for wrapping the same web bundle for iOS/Android shells using local web storage (`IndexedDB`/`localStorage`), keeping push notifications and payment gateways out of MVP scope.
- Working wrapper configs and native build scripts are deferred to a later intent.

## Local Development & Verification

- **Single Start Command:** One documented command (e.g., `npm run dev` or `npm start`) starts the local app on macOS, Linux, and Windows without requiring internet access after initial setup.
- **Reset Command:** One documented command (or browser reset action) clears local persisted data and re-seeds sample data.
- **Quality & Browser Verification:** Automated unit tests for financial math and game logic, Playwright (or equivalent) end-to-end checks in CI across desktop and mobile viewports with zero console errors, live verification of the GitHub Pages deployment, and a non-technical user demo of the full sign-in-to-report flow.
- **Scope Protection:** If time requires cuts, the financial math, loans/income CRUD, payment calendar, local persistence, and automated tests are non-negotiable; game depth and chart polish may be simplified.
