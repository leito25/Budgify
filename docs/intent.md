# Intent: the Budgify MVP

## Problem

Everyday individuals and small businesses lack clear, practical visibility into how bank loans, credit card installments, and interest rates actually work. Most people do not know the true cost of splitting a grocery purchase into 3 monthly credit card installments, the difference between simple and compound interest, or how late fees accumulate. Furthermore, there is no engaging way to practice financial decision-making and apply money-management advice in a safe environment.

## Proposed outcome

Budgify is a responsive web application (designed for desktop, laptop, and mobile screens, and wrap-ready for desktop and mobile apps) that helps individuals and small businesses master their debt, cash flow, and financial literacy. This first version, the MVP, is a complete personal and small-business loan simulator, debt tracker, and financial learning game tailored to the banking realities of Colombia and the United States. It should feel sharp, trustworthy, and approachable, making complex amortization math immediately understandable.

### Five sections

- **Dashboard**, the landing page: financial health at a glance. Shows total active debt, total interest to be paid versus principal, net balance (optional income minus debt obligations), upcoming and overdue payment dates on a visual calendar, and actionable money-management tips based on the user's current loans. It should be visually clear, featuring a breakdown chart of principal vs. interest, a monthly payment timeline chart, and a summary of upcoming due dates.
- **Loans & Installments**: a complete ledger of all active and paid-off debts (bank loans, microloans, and credit card installment purchases). Users can enter the principal, number of monthly payments, interest rate, and interest type (simple vs. compound, or monthly vs. effective annual rate). Includes an interactive "Rate Helper" guide explaining how to find or ask their Colombian or US bank for their real interest rate and late-fee policy, along with hardcoded reference rate presets (such as Colombia's *Tasa de Usura* from the Superintendencia Financiera and average US APRs) as quick-fill options when a user does not know their exact rate.
- **Income & Balance**: an optional ledger where users can log their earnings and recurring income to calculate their net monthly cash flow and see what percentage of their income goes toward debt payments.
- **Payment Calendar**: an interactive calendar view highlighting upcoming installment due dates, grace periods, and overdue payments, allowing users to mark installments as paid and see estimated late-payment interest penalties if a due date passes.
- **Financial Quest (Resource Game)**: a lightweight, interactive resource-management mini-game where users apply financial lessons—such as prioritizing high-interest debt, avoiding unnecessary credit card installments, and building an emergency buffer—to grow a virtual personal or small-business budget across simulated months.

Every table (Loans, Income) has a search box, columns you can sort by clicking their headings, a way to add a new record, and edit and delete actions on each row. Deleting asks for confirmation first and explains how removing the record will affect the user's balance and payment schedule.

### Four kinds of record

- **Profile (Personal or Small Business)**: defines the workspace mode. **Personal** mode is free for individual use; **Small Business** mode supports business tracking and enforces a simulated plan limit (prompting for a membership upgrade when adding more than 3 active loans).
- **Loan / Installment**: any debt obligation. Includes a name, optional description, lender/bank region (Colombia or US), principal amount, number of monthly installments, interest rate, interest type (simple or compound), late-payment penalty rate, due date, and status (Active, Paid, Overdue).
- **Income Entry**: optional earnings logged by the user. Includes a source name, optional description, amount, date received, and whether it is one-time or recurring.
- **Game Scenario / Progress**: tracks the user's current resources, virtual cash, debt level, and completed financial literacy challenges inside the Resource Game.

### Sample data

Budgify comes with realistic sample data so every screen looks alive the first time it starts: a mix of everyday credit card installment purchases (e.g., groceries split into 3 months), personal microloans, small-business equipment loans across several industries, sample income entries, upcoming due dates on the calendar, and at least one overdue payment demonstrating late-interest calculation.

### Look and feel

The look follows Budgify's brand guidelines, which take priority over any general design guidance. The MVP is light mode, built with a responsive layout that works seamlessly on desktop, laptop, and mobile screens.

## Affected users and systems

- Individual consumers and small-business owners managing loans and credit card installments in Colombia and the US.
- Runs as a static web application in the browser (compatible with GitHub Pages) with no external backend or third-party banking APIs involved yet, and supports wrapping via Electron (`https://www.electronjs.org/`) for desktop and Capacitor (`https://capacitorjs.com/`) for mobile.

## Constraints

- The technology in `docs/TECH_STACK.md`.
- It runs locally with one documented command that works on Mac, Linux, and Windows, and needs no internet connection to use (with documented build/wrap steps for Electron desktop and Capacitor mobile).
- **Local-only persistence**: Uses browser-based local storage (`localStorage` or `IndexedDB`) so the app requires zero server-side database infrastructure and can be deployed directly to GitHub Pages. Every change is kept across browser refreshes and restarts.
- One documented command (or in-app reset button) clears local storage and restores the realistic sample data to start again from scratch.
- Includes a lightweight local sign-in screen (simulated session stored locally) and the ability to download/export a loan and amortization report (e.g., CSV or printable PDF summary).
- Not in the MVP: real multi-user cloud authentication or remote servers; live bank API connections; real payment processing or paying credit cards directly from the app; dark mode; AI chat features; external email or phone push notifications; multi-currency exchange-rate syncing (users simply enter numbers in their local currency format, COP or USD).

## Success criteria

1. Someone non-technical can start Budgify with the one documented command, open it in a browser, pass the local sign-in screen, and land on the dashboard with sample data populated on every screen.
2. Loans/installments and income entries can each be added, found by searching, sorted by column headers, edited, and deleted from their tables, and every change persists after a browser refresh and restart. Deleting asks for confirmation first, and the reset option brings back the sample data.
3. Entering a loan or credit card purchase (e.g., groceries at 3 monthly installments) accurately calculates the monthly payment, total interest paid, and late-payment interest if overdue, with clear guidance and quick-fill reference rate presets for users who don't know their bank's exact rate.
4. Switching to or using the Small Business profile enforces the 3-loan free threshold with a clear membership prompt on the 4th loan, while Personal mode allows standard tracking.
5. The Payment Calendar accurately displays due dates and highlights overdue loans; marking a payment as completed updates the loan balance and dashboard figures immediately.
6. Users can play the Financial Resource Game, make budget/debt decisions, and see the financial impact of their choices across simulated turns.
7. Users can download a clean summary report of their loans and payment schedule.
8. Every screen is sharp, modern, responsive (mobile and desktop), and error-free in the browser console when tested end-to-end.

## Open questions

- **Future Integrations**: Direct payment processing from the app, credit card bill-pay services, and real cloud multi-device accounts are deferred to a later intent.
