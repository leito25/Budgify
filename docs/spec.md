# Budgify product specification

## Purpose

Individuals and small businesses often cannot see the true cost of loans, credit-card installments, or late payments, or understand how debt affects their cash flow. They also lack a safe, engaging way to practice financial decisions. Budgify addresses this by making loan schedules, costs, and financial choices understandable in a local, bilingual planner and learning game.

## Product today

Budgify is a responsive, client-side web application for managing and learning about debt and cash flow. It supports Colombia (COP) and the United States (USD), with separate Personal and Small Business workspaces. Calculated amounts are estimates, not lender terms or financial advice.

The application has five main areas:

- **Dashboard:** summarizes active debt, principal and interest, monthly net balance, upcoming and overdue payments, and loan-based tips. It includes a principal-versus-interest chart, a monthly payment timeline, loan status overview, and upcoming-payment summary.
- **Loans & Installments:** a searchable, sortable ledger for active and paid-off obligations, including bank loans, microloans, and installment purchases. Users can add, edit, or delete loans, review their schedules, and use the Rate Helper and static reference-rate presets.
- **Income & Balance:** a searchable, sortable income ledger. Recurring income contributes to monthly cash flow and debt-to-income; one-time income appears separately in the balance snapshot.
- **Payment Calendar:** shows scheduled payments and their upcoming, grace-period, overdue, or paid state. Users can settle an installment in full and see the resulting schedule and balances update.
- **Financial Quest:** a guided resource-management game with Personal and Small Business scenarios, simulated decisions and challenges, progress, and a net-worth/emergency-buffer score.

Tables support search, sortable columns, create/edit/delete actions, and confirmation before deletion. The application provides English and Spanish UI text, keeps user-entered text as entered, and supports responsive desktop and mobile layouts.

## Accounts and workspaces

- The app uses one local, name-only profile and a simulated session. There is no password or account authentication.
- Personal and Small Business modes have separate local data. Each workspace selects Colombia or the United States and uses that region's currency; currencies are not converted or combined.
- Small Business blocks creation of a fourth active loan unless the user accepts a simulated membership upgrade. Paid-off loans do not count toward the limit. No real payment is collected.
- A workspace's region cannot be changed while it contains loans or income; reset that workspace first.

## Financial behavior

- A loan records its principal, installment count, interest rate and basis, simple or compound interest type, penalty rate, and first payment date. The date entered is the first installment date.
- The schedule is generated monthly from that date. Dates clamp to the end of shorter months while retaining the original day as the anchor.
- Simple-interest loans distribute flat interest across installments. Compound-interest loans use a fixed-payment amortization schedule. Effective annual rates convert to monthly rates; US APR presets are treated as nominal annual rates. Currency rounding is applied per installment, with the last installment reconciling the remaining amount.
- Payment and loan states are derived, not manually assigned. Payments settle an installment in full; early and out-of-order settlement is allowed. After a payment, the loan's financial terms and first payment date lock, while its name and description remain editable.
- The five days after a due date are a grace period. Starting on day six, an unpaid installment accrues simple penalty interest at its annual nominal penalty rate, on that installment only, using actual late days over 365. The penalty does not compound or capitalize into principal. A settled payment records its payment details and penalty.
- Monthly obligations include unpaid installments due in the current calendar month and overdue unpaid installments. If recurring income is zero, debt-to-income is shown as an em dash.
- Financial calculation and schedule conventions are maintained in [decisions.md](./decisions.md).

## Data, privacy, and operation

- Data is stored locally in the browser: IndexedDB is preferred, with localStorage and memory-only fallbacks. The active storage mode is shown, and failed writes are reported rather than silently treated as durable.
- Signing out preserves the saved name and workspace data. Reset requires confirmation, clears the saved name and local app data, restores sample records, and returns to name entry.
- Local storage is not synced or recoverable across devices. Anyone using the same browser profile may access the data; clearing browser/app data, private browsing, or memory-only storage can cause data loss.
- The app bundles its fonts, translations, and reference rates. There is no backend, bank connection, live rate fetching, or third-party payment service. An already-open page can work offline, but there is no service worker, so an offline first visit or reload is not guaranteed.
- Sample workspaces include loans and installment purchases, income, upcoming payments, and an overdue example.
- Users can export an amortization CSV with the complete schedule and print a one-page report with totals and the next five installments.

## Design and implementation

- The UI follows Budgify's light and dark visual identity and uses locally bundled Instrument Sans, Instrument Serif, and JetBrains Mono fonts. Light mode is the default and keeps its current appearance; a theme toggle is available on every page, and the selected mode is remembered across reloads. The app does not follow the device's theme setting.
- Theme colors are centralized in shared tokens. Light mode uses a `#F0F4F5` page background, white panels, and Midnight ink (`#073B4C`). Dark mode uses a `#04232E` page background, black panels, and Sea Mist ink (`#CDD8DB`), with contrast-appropriate brand accents. Normal text meets a 4.5:1 contrast ratio; large text and UI components meet 3:1. Charts, dialogs, and messages follow the selected mode.
- Navigation covers the five product areas, with workspace-mode and language controls. Core controls support keyboard use; statuses are not communicated by color alone. The existing responsive layouts, including the phone layout, work in both modes without a phone-specific redesign.
- The web app is built with React, TypeScript, and Vite. Financial and game rules are deterministic domain logic, separate from the UI; translations and local persistence are handled in dedicated layers. See [TechStack.md](./TechStack.md) for stack details.
- The static web app is the shipped product and can be deployed to GitHub Pages. Electron and Capacitor wrapping instructions are documented, but working desktop or native wrapper configurations are not included.

## Out of scope

Budgify does not provide cloud accounts or synchronization, bank connections, live interest rates, real payment processing or memberships, partial payments, manual loan-status editing, mixed-currency totals, automatic device-theme detection, AI chat, or external notifications. Native Electron and Capacitor applications are not shipped.
