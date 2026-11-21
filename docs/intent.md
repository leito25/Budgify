# Intent: the Budgify MVP

## Problem

Everyday individuals and small businesses lack clear, practical visibility into how bank loans, credit card installments, and interest rates actually work. Most people do not know the true cost of splitting a grocery purchase into 3 monthly credit card installments, the difference between simple and compound interest, or how late fees accumulate. Furthermore, there is no engaging way to practice financial decision-making and apply money-management advice in a safe environment.

## Proposed outcome

Budgify is a responsive web application (designed for desktop, laptop, and mobile screens, and wrap-ready for desktop and mobile apps) that helps individuals and small businesses master their debt, cash flow, and financial literacy. This first version, the MVP, is a complete personal and small-business loan simulator, debt tracker, and financial learning game tailored to the banking realities of Colombia and the United States. It should feel sharp, trustworthy, and approachable, making complex amortization math immediately understandable.

The UI is fully bilingual with an in-app English/Spanish toggle. Every UI string is translated, including forms, charts, the Rate Helper, the Financial Quest, and report headers; user-entered text stays as typed. Each workspace uses a single currency, fixed by region: COP for Colombia and USD for the United States. There is no cross-currency conversion and no mixed-currency total.

### Five sections

- **Dashboard**, the landing page: financial health at a glance. Shows total active debt, total interest to be paid versus principal, net balance (optional income minus debt obligations), upcoming and overdue payment dates on a visual calendar, and actionable money-management tips based on the user's current loans. It should be visually clear, featuring a breakdown chart of principal vs. interest, a monthly payment timeline chart, and a summary of upcoming due dates.
- **Loans & Installments**: a complete ledger of all active and paid-off debts (bank loans, microloans, and credit card installment purchases). Users can enter the principal, number of monthly payments, interest rate, and interest type (simple vs. compound, or monthly vs. effective annual rate). The entered due date is the **first payment date**; the full installment schedule is generated monthly from it. Includes an interactive "Rate Helper" guide explaining how to find or ask their Colombian or US bank for their real interest rate and late-fee policy, along with hardcoded reference rate presets (such as Colombia's *Tasa de Usura* from the Superintendencia Financiera and average US APRs) as quick-fill options when a user does not know their exact rate. Presets are static, dated reference values labeled "reference only, verify with your bank"; there is no live rate fetching.
- **Income & Balance**: an optional ledger where users can log their earnings and recurring income to calculate their net monthly cash flow and see what percentage of their income goes toward debt payments. Only **recurring** income counts toward monthly cash flow and the debt-to-income percentage; **one-time** income is shown separately in a balance snapshot and does not inflate monthly figures.
- **Payment Calendar**: an interactive calendar view highlighting upcoming installment due dates, grace periods, and overdue payments, allowing users to mark installments as paid and see estimated late-payment interest penalties if a due date passes. Marking an installment paid settles that installment in full and immediately reduces the remaining principal and updates all dashboard figures. After a **5-day grace period**, an unpaid installment accrues **simple interest** at the loan's penalty rate; there is no compounding and no partial-payment support in the MVP.
- **Financial Quest (Resource Game)**: a lightweight, interactive resource-management mini-game where users apply financial lessons—such as prioritizing high-interest debt, avoiding unnecessary credit card installments, and building an emergency buffer—to grow a virtual personal or small-business budget across simulated months. The MVP is a **guided linear scenario** (6-12 simulated months) with one scenario per profile mode, multiple-choice decisions, 3-5 financial literacy challenges, a net-worth/emergency-buffer score, and saved progress.

Every table (Loans, Income) has a search box, columns you can sort by clicking their headings, a way to add a new record, and edit and delete actions on each row. Deleting asks for confirmation first and explains how removing the record will affect the user's balance and payment schedule.

### Four kinds of record

- **Profile (Personal or Small Business)**: defines the workspace mode. There is one local user with no password (a name only), and **Personal and Small Business keep separate data sets**; switching modes swaps the active data. **Personal** mode is free for individual use; **Small Business** mode supports business tracking and **hard-blocks saving a 4th active loan** until a simulated membership upgrade is accepted or the user switches mode. Paid-off loans do not count toward the 3-loan limit.
- **Loan / Installment**: any debt obligation. Includes a name, optional description, lender/bank region (Colombia or US), principal amount, number of monthly installments, interest rate, interest type (simple or compound), late-payment penalty rate, and due date. The due date is the **first payment date**, and the full monthly schedule is generated from it. Status (Active, Paid, Overdue) is **derived automatically** from payment and date state; users never set it manually.
- **Income Entry**: optional earnings logged by the user. Includes a source name, optional description, amount, date received, and whether it is one-time or recurring. Recurring entries feed monthly cash flow and the debt-to-income percentage; one-time entries appear only in the balance snapshot.
- **Game Scenario / Progress**: tracks the user's current resources, virtual cash, debt level, and completed financial literacy challenges inside the Resource Game.

### Sample data

Budgify comes with realistic sample data so every screen looks alive the first time it starts: a mix of everyday credit card installment purchases (e.g., groceries split into 3 months), personal microloans, small-business equipment loans across several industries, sample income entries, upcoming due dates on the calendar, and at least one overdue payment demonstrating late-interest calculation.

### Look and feel

The look follows Budgify's brand guidelines, which take priority over any general design guidance. The MVP is light mode, built with a responsive layout that works seamlessly on desktop, laptop, and mobile screens.

## Affected users and systems

- Individual consumers and small-business owners managing loans and credit card installments in Colombia and the US.
- Runs as a static web application in the browser (compatible with GitHub Pages) with no external backend or third-party banking APIs involved yet. The MVP ships the web app plus **documented** Electron (`https://www.electronjs.org/`) and Capacitor (`https://capacitorjs.com/`) build/wrap steps; working wrapper configs are not part of the MVP deliverable. All fonts are bundled locally so the app works fully offline.

## Constraints

- The technology in `docs/TechStack.md`.
- It runs locally with one documented command that works on Mac, Linux, and Windows, and needs no internet connection to use (with documented build/wrap steps for Electron desktop and Capacitor mobile).
- **Local-only persistence**: Uses browser-based local storage (`localStorage` or `IndexedDB`) so the app requires zero server-side database infrastructure and can be deployed directly to GitHub Pages. Every change is kept across browser refreshes and restarts.
- One documented command (or in-app reset button) clears local storage and restores the realistic sample data to start again from scratch.
- Includes a lightweight local sign-in screen (name only, no password, simulated session stored locally) and the ability to download/export an amortization CSV plus a print-styled one-page summary of loans, payments, and totals.
- One currency per workspace (COP for Colombia, USD for the United States), set by the selected region; no conversion or cross-currency totals.
- Fully bilingual UI (English/Spanish) with every UI string translated; user-entered content is never rewritten.
- Financial engine rules: due date is the first payment date; payments are full-installment only; late interest is simple interest after a 5-day grace period with no compounding; loan status is derived automatically; recurring income alone feeds monthly cash flow.
- Static, dated rate presets with a "reference only, verify with your bank" disclaimer; no runtime rate fetching.
- If scope must be cut, the protected core is the financial math, loans/income CRUD tables, payment calendar, local persistence, and automated tests. Game depth and chart polish may be simplified.
- Not in the MVP: real multi-user cloud authentication or remote servers; live bank API connections; real payment processing or paying credit cards directly from the app; dark mode; AI chat features; external email or phone push notifications; multi-currency exchange-rate syncing or mixed-currency totals; partial payments; manually assigned loan status; live interest-rate fetching; working Electron/Capacitor wrapper configs (documentation only).

## Success criteria

1. Someone non-technical can start Budgify with the one documented command, open it in a browser, pass the local sign-in screen, and land on the dashboard with sample data populated on every screen.
2. Loans/installments and income entries can each be added, found by searching, sorted by column headers, edited, and deleted from their tables, and every change persists after a browser refresh and restart. Deleting asks for confirmation first, and the reset option brings back the sample data.
3. Entering a loan or credit card purchase (e.g., groceries at 3 monthly installments) accurately calculates the monthly payment, total interest paid, and late-payment interest if overdue, with clear guidance and quick-fill reference rate presets for users who don't know their bank's exact rate.
4. Switching to or using the Small Business profile hard-blocks saving a 4th active loan with a clear simulated membership prompt, while Personal mode allows standard tracking; the two modes keep separate data sets.
5. The Payment Calendar accurately displays due dates (first payment date plus generated monthly schedule), derives Paid/Overdue/Active status automatically, applies simple late interest after a 5-day grace period with no compounding, and updates balances and dashboard figures immediately when an installment is marked paid.
6. Users can play the guided Financial Quest scenario, make budget/debt decisions across 6-12 simulated months, and see the impact on net worth and emergency buffer; progress persists.
7. Users can download an amortization CSV and a clean, print-styled one-page summary of their loans and payment schedule.
8. The English/Spanish toggle translates every UI string, while user-entered text is left untouched.
9. Every screen is sharp, modern, responsive (mobile and desktop), and error-free in the browser console when tested end-to-end.
10. Unit tests cover the financial math and game logic, and automated Playwright (or equivalent) end-to-end checks pass in CI across desktop and mobile viewports.
11. The app is deployed to GitHub Pages and verified live, and a non-technical user can complete the full sign-in-to-report flow without assistance.

## MVP decisions (intent interview)

These answers were given during the intent review and are incorporated throughout this document. They take precedence over any conflicting earlier wording.

| Topic | Decision |
| --- | --- |
| Scope — currency | One currency per workspace, fixed by region (COP / USD). No conversion or mixed-currency totals. |
| Users — language | Full English/Spanish in-app toggle; every UI string translated, user-entered text unchanged. |
| Constraints — deliverable | Ship the web app plus documented Electron/Capacitor wrap steps; bundle fonts locally for offline use. |
| Success — acceptance bar | All of the above: unit tests, automated E2E in CI, live GitHub Pages deployment, and a non-technical user demo. |
| Payments & late fees | Full-installment payments only; 5-day grace period, then simple interest at the penalty rate; no compounding. |
| Session & profiles | One local user (name only, no password); Personal and Small Business keep separate data sets. |
| Small Business limit | Hard block on saving a 4th active loan with a simulated upgrade prompt; paid-off loans do not count. |
| Financial Quest | Guided linear scenario with 6-12 months, multiple-choice decisions, 3-5 challenges, and saved progress. |
| Report export | Downloadable amortization CSV plus a print-styled one-page summary. |
| Rate presets | Static, dated reference values with a "reference only, verify with your bank" disclaimer; no live fetching. |
| Loan status | Derived automatically from payment and date state; never entered manually. |
| Income rules | Only recurring income feeds monthly cash flow and debt-to-income; one-time income is separate. |
| Schedule anchor | The due date is the first payment date; monthly installments are generated from it. |
| Cut priorities | Protected core: financial math, loans/income CRUD, calendar, persistence, tests. Game depth and charts may be simplified. |

## Open questions

- None remain for the MVP; the decisions above resolved the intent review.
- **Future Integrations**: Direct payment processing from the app, credit card bill-pay services, and real cloud multi-device accounts are deferred to a later intent.
