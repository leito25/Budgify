# Tech Stack: Budgify MVP

## Core Architecture

Budgify is built as a **client-side, offline-capable single-page web application (SPA)** with zero server-side backend or external database dependencies. The core web bundle can be hosted statically on **GitHub Pages** and wrapped into native shells via **Electron** (desktop) and **Capacitor** (mobile), while running locally from a single documented command across macOS, Linux, and Windows.

- **Application Shell:** Modern component-based web framework (e.g., React or Vue with TypeScript) compiling to static assets (`dist/`).
- **Routing:** Client-side hash or memory routing (`HashRouter` / in-app view state) so deep navigation works reliably on GitHub Pages, `file://` / Electron loads, and Capacitor WebViews without server rewrite rules.
- **Runtime & Build Tooling:** Fast static bundler and dev server (e.g., Vite) configured with relative asset paths (`./`) so the same build artifact works on GitHub Pages subpaths, Electron, and Capacitor.

## UI, Styling & Data Visualization

- **Styling:** Utility-first CSS or component styling configured strictly for **light mode** with responsive breakpoints covering mobile, laptop, and desktop viewports, honoring Budgify brand tokens/guidelines.
- **Charts & Calendar:**
  - Principal vs. interest breakdown chart and monthly payment timeline chart on the **Dashboard**.
  - Interactive **Payment Calendar** view highlighting due dates, grace periods, overdue items, and payment status updates.
- **Accessibility & Ergonomics:** Keyboard-navigable tables (search filter, column header sorting, row edit/delete with confirmation modals explaining downstream balance/schedule impact) and clear visual badges for overdue obligations and the Small Business 3-loan membership threshold.

## Domain Logic & Financial Engine

- **Amortization & Interest Module:** Pure, deterministic TypeScript/JavaScript functions (unit-testable without DOM) handling:
  - Simple interest and compound interest calculations, including conversions/handling between monthly rates and effective rates (such as Colombian *Efectivo Anual* / *Tasa de Usura* context and US APR conventions).
  - Credit card installment schedules (e.g., 3-month grocery purchases) and standard/micro/small-business loans.
  - Overdue detection and late-payment interest/penalty calculations.
- **Reference Rate Presets & Rate Helper:** Bundled static data containing Colombian and US reference rate presets and step-by-step guidance on how users can verify or request exact rates and late-fee terms from their bank.
- **Financial Quest (Resource Game) Engine:** Deterministic turn/month state simulation evaluating cash, debt levels, emergency buffer decisions, and financial literacy milestones.
- **Report Export:** Client-side generator producing a downloadable summary report of loans and payment schedules (e.g., CSV and/or print-styled summary sheet triggered from the browser).

## Persistence, Session & Sample Data

- **Local Persistence:** Browser-native **`IndexedDB`** (with a structured storage wrapper and `localStorage` fallback/flags) so all profiles (`Personal` vs. `Small Business`), loans, income entries, payment statuses, and game progress persist across browser refreshes and app restarts with no internet connection required.
- **Local Session Sign-In:** Lightweight client-side session gate persisted locally (no cloud auth or remote servers in the MVP).
- **Sample Data & Reset:** Seed dataset loaded on first run (realistic credit card installments, microloans, small-business loans across industries, sample income, calendar dates, and overdue examples) with a one-click in-app reset and a documented reset command/script to restore clean sample state.

## Desktop & Mobile Wrappers (MVP Scope)

- **Web / GitHub Pages:** Static build output deployed from the repository's build pipeline.
- **Desktop (`Electron`):** Wraps the built static web app for macOS, Linux, and Windows using local storage without requiring remote APIs.
- **Mobile (`Capacitor`):** Wraps the same web bundle for iOS/Android shells using local web storage (`IndexedDB`/`localStorage`), keeping push notifications and payment gateways out of MVP scope.

## Local Development & Verification

- **Single Start Command:** One documented command (e.g., `npm run dev` or `npm start`) starts the local app on macOS, Linux, and Windows without requiring internet access after initial setup.
- **Reset Command:** One documented command (or browser reset action) clears local persisted data and re-seeds sample data.
- **Quality & Browser Verification:** Automated unit tests for financial math/game logic plus end-to-end browser verification across desktop and mobile viewports with zero console errors.
