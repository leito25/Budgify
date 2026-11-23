# Implementation decisions

These decisions resolve the eight concerns in `docs/spec.md` for the MVP. They define simulator behavior, not lender terms or financial advice. Amounts and penalties are estimates.

## 1. Interest, conversions, and rounding

- Store money as integer minor units: COP has zero decimal places and USD has two.
- A monthly nominal rate is used directly as the monthly rate. Effective annual rates convert to monthly as `(1 + annualRate)^(1/12) - 1`. US APR presets are nominal annual rates and convert by dividing by 12.
- Simple interest is flat: total interest is principal × monthly rate × installment count; the principal and interest portions are level across installments.
- Compound interest uses a standard fixed-payment amortization schedule.
- Round each installment to the currency's minor unit using half-up rounding. The final installment absorbs the remaining principal and interest so totals reconcile exactly.
- Zero-rate loans repay principal evenly. All screens and reports identify estimates as non-contractual.

## 2. Late payments

- Penalty rate is an annual nominal rate. Penalty applies only to the unpaid scheduled installment, uses actual late days divided by 365, and is simple (never compounded).
- Days 0 through 5 after the due date are the grace period. Penalty begins on day 6.
- An unpaid installment is `In grace` during days 0–5, and `Overdue` after that. A loan is `Overdue` if any unpaid installment is overdue; otherwise it is `In grace` if any unpaid installment is in grace.
- Settling an installment records the paid date, scheduled amount, and penalty as a payment snapshot. Penalty does not capitalize into principal.

## 3. Schedule, payments, edits, and deletion

- Dates are date-only ISO values. Monthly due dates are anchored to the original day and clamp to each month's last day (January 31 → February 28/29 → March 31).
- Installments can be paid early or out of order; each settles independently and in full.
- After any payment, principal, term, rates, interest type, and first due date lock. Name and description remain editable.
- Deleting a loan removes its schedule and payment history after a confirmation stating the number of paid installments.

## 4. Workspace region and currency

- Region is chosen for each Personal and Small Business workspace when first created: Colombia (COP) or United States (USD).
- Region cannot change while that workspace has loans or income. Reset that workspace before changing its region.
- A loan inherits its workspace region and currency. No mixed-currency totals or conversions are permitted.

## 5. Balances and reports

- Monthly obligations include all unpaid installments due in the current calendar month and all overdue unpaid installments.
- One-time income is displayed only as a separate balance-snapshot amount; it is excluded from monthly cash flow and debt-to-income.
- If recurring income is zero, debt-to-income is displayed as an em dash.
- The printable one-page report contains totals and the next five installments; the CSV contains the complete schedule.

## 6. Reference rates

- Colombia's preset is the November 2026 Superintendencia Financiera de Colombia certified usury reference for consumer and ordinary credit: 28.34% effective annual. This is a dated reference, not a legal determination, limit for every product, or lender offer.
- The US preset is the Federal Reserve G.19 September 2026 average APR for credit-card accounts assessed interest: 22.36% nominal annual, treated as APR. It is an aggregate reference, not a lender offer.
- Each preset includes its primary source, as-of period, and “reference only, verify with your bank” notice. Presets are bundled and are never fetched at runtime.
- Review the source each month when updating Colombia's monthly certification and at each new Federal Reserve G.19 release. Record the source, period, and value in `docs/rate-presets.md`.

## 7. Offline storage and recovery

- Use IndexedDB first, then localStorage, then memory-only mode. The app always displays which storage mode is active; a successful in-memory write is not represented as durable.
- A failed write is surfaced and the UI retains the last persisted state.
- Before a schema migration, export a backup. If migration fails, do not overwrite the old data; provide recovery guidance and offer export or reset.
- Local sign-in is only a convenience gate, not authentication. Explain that data can be seen by anyone using the same browser profile and may be lost if browser storage is cleared.

## 8. Delivery

- Supported browser targets: current stable Chrome, Edge, Firefox, and Safari.
- Responsive verification widths: 375, 390, 768, 1280, and 1440 CSS pixels (heights 667, 844, 1024, 800, and 900 respectively).
- Use React, TypeScript, Vite, hash routing, Vitest, Playwright, plain CSS, and hand-built SVG charts. This fits the static, offline-capable requirements in `docs/TechStack.md`.
- The repository snapshot does not establish GitHub Pages permissions, a remote, or access to a non-technical demo participant. Those release checks remain external and must be completed by the repository owner.
