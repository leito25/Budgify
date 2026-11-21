# Budgify MVP specification

## Concerns and decisions needed

The intent defines the product scope, but these details must be resolved before implementing or certifying the financial engine:

1. **Interest and rounding:** Define the simple-interest repayment model, compound amortization convention, monthly and effective annual rate conversions, US APR treatment, and monetary precision and rounding. Bank-specific terms may differ; estimates must not be presented as contractual amounts.
2. **Late payments:** Define the penalty rate's period, the balance it applies to, the day-count basis, and whether interest starts on the due date or after the grace period. Specify whether an unpaid installment is labeled overdue during the grace period, and how the accrued penalty is recorded when it is paid.
3. **Schedule and edits:** Define month-end handling for dates such as January 31, the treatment of early or out-of-order payments, and what happens to existing payments when financial terms or the first due date are edited. Deleting a loan with paid installments also needs an explicit history policy.
4. **Workspace region:** Specify how each profile selects its region, whether it can be changed after records exist, and how existing records and sample data are handled. Loan region and workspace currency must not allow mixed-currency totals.
5. **Balances and reports:** Define the balance snapshot, treatment of one-time income and past or overdue obligations, the period for monthly debt obligations, and the zero-income debt-to-income display. Define how a potentially long payment schedule fits the one-page summary; the CSV can contain the complete schedule.
6. **Reference rates:** Choose authoritative sources, dated values, and an update process for both regions. A static preset can become stale and must not imply that it is a current legal cap or bank offer.
7. **Offline persistence:** Decide the recovery behavior when IndexedDB is unavailable, storage is full or cleared, or schema migration fails. A local sign-in is not authentication, and browser data can be lost or accessed by others using the same browser profile.
8. **Delivery validation:** Name the intended supported browsers and mobile viewport sizes, define the non-technical demo procedure, and confirm GitHub Pages deployment permissions.

These are implementation decisions, not changes to the intent. They require agreement before behavior that depends on them is finalized.

## Purpose and scope

Budgify is an offline-capable, responsive web app that helps individuals and small businesses in Colombia and the United States understand debt, income, payment schedules, and financial choices. The MVP ships a static web app and documentation for later Electron and Capacitor wrapping; it does not ship working wrapper configurations.

The protected core is financial calculations, loan and income CRUD, the payment calendar, local persistence, and automated tests. Game depth and chart polish may be simplified if scope must be reduced.

## Requirements

### Session and workspaces

- Start with a local, name-only sign-in; persist the simulated session. Do not request a password or imply account security.
- Offer Personal and Small Business modes with separate local data sets. Switching modes changes the active data without merging it.
- Each workspace has one region and its currency: Colombia uses COP and the US uses USD. Do not convert currencies or combine amounts across workspaces.
- Personal mode has no stated loan limit. Small Business blocks saving a fourth active loan until a simulated membership upgrade is accepted or the user switches mode. Paid-off loans do not count.
- Persist the simulated upgrade per applicable workspace and clearly label it as simulated; do not collect payment.

### Loans and installments

- Provide a searchable, sortable ledger of active and paid-off loans, with add, edit, and delete actions. Confirm deletion and explain its effect on the balance and payment schedule.
- Capture name, optional description, lender region, principal, number of monthly installments, interest rate and its basis, simple or compound interest type, penalty rate, and first payment date. Validate required fields and reject invalid dates, nonpositive principal or installment counts, and negative rates.
- Generate the monthly schedule from the first payment date. Show payment amount, principal, interest, total interest, remaining balance, due dates, and estimated penalties. Apply the agreed financial conventions above.
- Derive Active, Paid, and Overdue from payment and date state; never accept a manually assigned status. Paid means all installments are settled.
- The Rate Helper explains how to obtain actual rates and late-fee terms from a Colombian or US lender. Offer region-appropriate, static, dated quick-fill presets with the translated notice “reference only, verify with your bank.” Do not fetch rates at runtime.

### Income and dashboard

- Provide a searchable, sortable income ledger with add, edit, and delete actions and an impact-aware delete confirmation. Capture source, optional description, amount, date received, and one-time or recurring frequency.
- Use recurring income only for monthly cash flow and debt-to-income percentage. Show one-time income separately in the balance snapshot; do not add it to monthly income.
- The dashboard shows active debt, principal versus interest, monthly net balance, upcoming and overdue dates, and actionable tips based on current loans. Include a principal-versus-interest chart, monthly payment timeline, and upcoming-payment summary.
- Clearly label estimates, currency, dates, and empty states. Avoid dividing by zero when recurring income is absent.

### Payment calendar

- Display scheduled installments on an interactive calendar, distinguishing upcoming dates, the five-day grace period, overdue payments, and paid installments without relying on color alone.
- Allow a user to mark an installment paid in full; partial payments are out of scope. Immediately update the schedule, remaining principal, derived status, and dashboard.
- After the five-day grace period, calculate late interest as simple interest at the loan's penalty rate, without compounding, subject to the decisions above.

### Financial Quest

- Provide one guided linear scenario per profile mode, lasting 6–12 simulated months, with multiple-choice decisions and 3–5 financial literacy challenges.
- Track virtual cash, debt, completed challenges, and a net-worth/emergency-buffer score. Show the effect of each choice and persist progress independently per mode.
- Use deterministic game rules and clearly distinguish simulated values from real workspace data.

### Reports, language, and reset

- Download an amortization CSV and offer a print-styled, one-page summary of loans, payments, and totals. Scope both to the active workspace and its currency. Translate generated headers and labels; preserve user-entered text as entered.
- Provide an English/Spanish toggle covering all UI strings, validation, charts, helper content, game content, and report labels. Preserve user-entered text and persist the preference.
- Seed realistic data on first use: credit card installments, personal microloans, business equipment loans, income, upcoming payments, and at least one overdue example. Dates must remain useful when the seed is created.
- Provide an in-app reset that confirms data loss, clears local app data, and restores sample data. Document the reset; do not silently discard existing data.

## Design

### Information architecture and visual language

- Use a responsive navigation shell for Dashboard, Loans & Installments, Income & Balance, Payment Calendar, and Financial Quest, with accessible mode and language switches.
- Follow the [brand skill](../.github/skills/brand/SKILL.md). Ship light mode only: use a `#F0F4F5` background with white, rounded, borderless panels. Use Midnight `#073B4C` for text and Sea Green `#06D6A0` as the primary accent.
- Use Marigold `#FFC145` and Coral `#F78C6B` for the second and third chart series, then Cerulean `#118AB2` and Raspberry `#EF476F`. Darken bright colors for small text on light surfaces; do not rely on color alone for meaning.
- Bundle Instrument Sans for headings and body, Instrument Serif for accents, and JetBrains Mono for numbers and identifiers. Avoid one-edge panel borders and excessive gradients. Use short, plain labels and show currency with monetary values.
- Support keyboard navigation and visible focus for navigation, tables, dialogs, calendar, and game choices. Label controls, associate errors with inputs, and provide accessible chart equivalents. Reflow content for mobile without hiding core actions.

### Architecture and data

- Build a client-side component-based SPA with TypeScript, static assets, relative asset paths, and hash or equivalent client-side routing compatible with GitHub Pages. Select concrete framework and tooling during implementation within [TechStack.md](./TechStack.md).
- Separate presentation, translation, persistence, and deterministic financial/game domain logic. The UI displays derived values rather than storing manually assigned statuses.
- Store versioned local data in IndexedDB through a structured storage layer, with the documented localStorage fallback/flags. Report storage and migration failures visibly; never report an unsaved change as successful.
- Model a local user/session; separate workspace records by profile mode and region/currency; store loans and their payment state, income entries, upgrade state, and game progress. Store enough payment information to reproduce settled amounts once late-fee and edit policies are agreed.
- Derive schedules, loan status, calendar entries, dashboard aggregates, and report totals from the same domain rules. Update dependent views immediately after successful writes and retain data across refreshes and restarts.
- Bundle application assets, translations, reference data, and fonts locally. The app must work without network access after initial setup; there is no backend, bank integration, or runtime rate service.

### Quality and delivery

- Document one cross-platform local start command and offline prerequisites, an in-app reset, and future Electron/Capacitor build and wrap steps. Deploy the static web build to GitHub Pages.
- Unit-test financial calculations and game logic, including zero rates, rate conversions, rounding, month boundaries, grace-period boundaries, settled payments, and representative game decisions after the open rules are decided.
- Run automated Playwright or equivalent end-to-end checks in CI on desktop and mobile viewports. Cover sign-in, both workspaces and the business limit, CRUD and delete confirmation, calendar payment, persistence/reset, language switching, CSV/print output, and a complete game scenario. Check for browser console errors.
- Verify the live GitHub Pages deployment and observe a non-technical user complete the sign-in-to-report flow without assistance.

## Exclusions

No cloud accounts or server, live bank APIs or rates, real payments or memberships, dark mode, AI chat, external notifications, currency conversion or mixed-currency totals, partial payments, manual loan status, or working native wrapper configurations.
