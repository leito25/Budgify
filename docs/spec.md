# Budgify product specification

## Purpose

Individuals and small businesses often cannot see the true cost of loans, credit-card installments, or late payments, or understand how debt affects their cash flow. They also lack a safe, engaging way to practice financial decisions. Budgify addresses this by making loan schedules, costs, and financial choices understandable in a local, bilingual planner and learning game.

## Product

Budgify is a responsive web application for managing and learning about debt and cash flow. People sign in with an email and password. It supports COP and USD in separate Personal and Small Business workspaces. Personal is local to the browser. Small Business is shared by a small team through a backend. Each workspace has its own selected display currency, independent of workspace type. Calculated amounts are estimates, not lender terms or financial advice.

Sign-in, the shared workspace, search, the user menu and hosting are described in [specs/sign-in-and-sharing.md](./specs/sign-in-and-sharing.md).

The application has five main areas:

- **Dashboard:** summarizes active debt, principal and interest, monthly net balance, upcoming and overdue payments, and loan-based tips. It includes a principal-versus-interest chart, a monthly payment timeline, loan status overview, and upcoming-payment summary.
- **Loans & Installments:** a searchable, sortable ledger for active and paid-off obligations, including bank loans, microloans, and installment purchases. Users can add, edit, or delete loans, review their schedules, and use the Rate Helper and static reference-rate presets.
- **Income & Balance:** a searchable, sortable income ledger. Recurring income contributes to monthly cash flow and debt-to-income; one-time income appears separately in the balance snapshot.
- **Payment Calendar:** shows scheduled payments and their upcoming, grace-period, overdue, or paid state. Users can settle an installment in full and see the resulting schedule and balances update.
- **Financial Quest:** a guided resource-management game with Personal and Small Business scenarios, simulated decisions and challenges, progress, and a net-worth/emergency-buffer score.

A search box in the top bar finds loans and income entries. Tables support search, sortable columns, create/edit/delete actions, and confirmation before deletion. In Small Business, each loan, income entry and payment shows who added it. The application provides English and Spanish UI text, keeps user-entered text as entered, and supports responsive desktop and mobile layouts.

## Accounts and workspaces

- People sign in with Supabase Auth, using an email and password. There is no sign-up page; people are added in Supabase's dashboard. Everyone who signs in can do everything; there are no roles. See [specs/sign-in-and-sharing.md](./specs/sign-in-and-sharing.md).
- After signing in, the user chooses a display currency and a workspace type. Personal and Small Business have separate data and remember their display currency separately, in the browser. Currency does not depend on workspace type.
- Personal data is local to the browser. Small Business data is shared by everyone who signs in and is stored on the server.
- Changing a workspace's display currency converts displayed amounts and CSV exports using the applicable exchange rate. Stored amounts remain in their original/base currency and are not rewritten when the display currency changes. If no rate is available, amounts, editors and exports use the base currency.
- Small Business blocks creation of a fourth active loan unless the user accepts a simulated membership upgrade. Paid-off loans do not count toward the limit. No real payment is collected.

## Financial behavior

- A loan records its principal, installment count, interest rate and basis, simple or compound interest type, penalty rate, and first payment date. The date entered is the first installment date.
- The schedule is generated monthly from that date. Dates clamp to the end of shorter months while retaining the original day as the anchor.
- Simple-interest loans distribute flat interest across installments. Compound-interest loans use a fixed-payment amortization schedule. Effective annual rates convert to monthly rates; US APR presets are treated as nominal annual rates. Currency rounding is applied per installment in the amount's original/base currency, with the last installment reconciling the remaining amount. Display conversion does not change the stored amounts or schedules.
- Payment and loan states are derived, not manually assigned. Payments settle an installment in full; early and out-of-order settlement is allowed. After a payment, the loan's financial terms and first payment date lock, while its name and description remain editable.
- The five days after a due date are a grace period. Starting on day six, an unpaid installment accrues simple penalty interest at its annual nominal penalty rate, on that installment only, using actual late days over 365. The penalty does not compound or capitalize into principal. A settled payment records its payment details and penalty.
- Monthly obligations include unpaid installments due in the current calendar month and overdue unpaid installments. If recurring income is zero, debt-to-income is shown as an em dash.
- Financial calculation and schedule conventions are maintained in [decisions.md](./decisions.md).

## Data, privacy, and operation

- Small Business data (loans, income entries, payments) is stored in Postgres on Supabase and reached only through the app's API, which checks the sign-in on every request. Failed saves are reported rather than silently treated as saved. Supabase starts with the Small Business sample data; nothing is moved from a browser's local storage.
- Personal data and each workspace's display currency, language, theme and Financial Quest progress stay in the browser: IndexedDB is preferred, with localStorage and memory-only fallbacks. The active storage mode is shown, and failed writes are reported rather than silently treated as durable.
- Signing out ends the session and preserves the Personal data in the browser. Reset requires confirmation, clears the local Personal data and local settings, and restores Personal sample records. It does not touch shared Small Business data.
- Local storage is not synced or recoverable across devices. Anyone using the same browser profile may access the Personal data, whoever is signed in; clearing browser/app data, private browsing, or memory-only storage can cause data loss.
- Signing in and using Small Business need an internet connection. The Personal workspace keeps working in an already-open page without one.
- The app bundles its fonts, translations, and reference rates. It fetches current exchange rates from a live exchange-rate API when the app is used and saves them locally; rates are not polled continuously. When offline, it uses the last saved rate. If no rate has been saved, it explains that conversion is unavailable until a rate can be fetched. An already-open page can work offline, but there is no service worker, so an offline first visit or reload is not guaranteed.
- The selected display currency is saved separately for each workspace and restored after reloading the app.
- Sample workspaces include loans and installment purchases, income, upcoming payments, and an overdue example.
- Users can export an amortization CSV with the complete schedule and print a one-page report with totals and the next five installments.

## Design and implementation

- The UI follows Budgify's light and dark visual identity and uses locally bundled Instrument Sans, Instrument Serif, and JetBrains Mono fonts. Light mode is the default and keeps its current appearance. The theme is chosen in the user menu under the person's initials: Light, Dark or System. System follows the device's setting. The choice is remembered across reloads.
- Theme colors are centralized in shared tokens. Light mode uses a `#F0F4F5` page background, white panels, and Midnight ink (`#073B4C`). Dark mode uses a `#04232E` page background, black panels, and Sea Mist ink (`#CDD8DB`), with contrast-appropriate brand accents. Normal text meets a 4.5:1 contrast ratio; large text and UI components meet 3:1. Charts, dialogs, and messages follow the selected mode.
- Navigation covers the five product areas, with workspace-mode and language controls. The top bar also holds the search box and the user menu (theme and sign out). Core controls support keyboard use; statuses are not communicated by color alone. The existing responsive layouts, including the phone layout, work in both modes without a phone-specific redesign.
- The web app is built with React, TypeScript, and Vite. Financial and game rules are deterministic domain logic, separate from the UI; translations and local persistence are handled in dedicated layers. The backend is FastAPI with SQLAlchemy Core, with Postgres on Supabase in production and SQLite in tests. See [TechStack.md](./TechStack.md) for stack details.
- The shipped product is one web service on Render's free plan: FastAPI serves the built frontend and the API, and migrations run at startup. The static GitHub Pages build is no longer the product, because sign-in and Small Business need the API. Electron and Capacitor wrapping instructions are documented, but working desktop or native wrapper configurations are not included, and a wrapped app would still need the hosted service.

## Out of scope

Budgify does not provide roles or permissions, sign-up, password reset, Google or magic-link sign-in, live updates between people, moving local browser data to the server, bank connections, live interest rates, historical or per-transaction exchange rates, real payment processing or memberships, partial payments, manual loan-status editing, AI chat, or external notifications. Exchange rates are not updated continuously. Native Electron and Capacitor applications are not shipped.
