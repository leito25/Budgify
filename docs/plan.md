# Budgify MVP implementation plan

The requested `docs/specs.md` is named `docs/spec.md` in this repository; this plan uses the existing specification and intent. Planning only: no application code has been written.

## Files that change

- **Project setup:** `package.json` and lockfile, `index.html`, TypeScript and bundler configuration, and lint, unit-test, and Playwright configuration. Choose the concrete framework and tools from the options in `docs/TechStack.md` before bootstrapping.
- **Application shell and presentation:** `src/main.tsx`, `src/App.tsx`, `src/styles/`, and `src/components/` for the responsive navigation, name-only sign-in, workspace and language controls, accessible shared controls, and the selected Planning Board dashboard design in `docs/mockups/03-board.html`.
- **Feature screens:** `src/features/dashboard/`, `loans/`, `income/`, `calendar/`, `quest/`, and `reports/` for the five app sections, record management, and exports.
- **Financial and workspace logic:** `src/domain/` for loan schedules, interest and rounding, derived loan/payment status, late fees, cash flow, workspace limits, and the deterministic game engine. Keep calculations independent of UI code.
- **Persistence and sample data:** `src/data/` for versioned IndexedDB storage, the agreed fallback behavior, profile-separated records, initial sample data, and reset.
- **Localization and reference data:** `src/i18n/` for complete English and Spanish UI text, and `src/data/rate-presets/` for dated, static, region-specific reference presets and disclaimers.
- **Automated proof:** `tests/unit/` for domain tests; `tests/e2e/` and Playwright configuration for browser flows; `.github/workflows/` for CI and the GitHub Pages build/deployment workflow.
- **Project documentation:** `README.md` and `docs/TechStack.md` for start, reset, test, build, deployment, and documented Electron/Capacitor wrapping steps; `docs/Status.md` for completed work. Keep `docs/intent.md`, `docs/spec.md`, and the selected mockup as the product/design source of truth.

Some source paths are proposed until the framework is selected. If the chosen toolchain uses different conventions, keep the same separation of UI, domain logic, persistence, localization, and tests.

## Order of work

1. **Phase 0 — Resolve blockers and choose the toolchain.** Agree the financial-engine conventions and the workspace-region/edit/history policies listed under concerns in `docs/spec.md`. Choose a framework, bundler, storage adapter/fallback, supported browsers, and test tools. Establish the initial project scripts and CI checks.
2. **Phase 1 — Domain model and financial core.** Define typed workspace, loan, installment, payment, income, and game-progress records. Implement deterministic amortization, monthly rate conversion, rounding, schedule generation, derived status, five-day grace-period penalties, and recurring-income calculations. Add representative unit tests before wiring presentation.
3. **Phase 2 — Local data and shared app shell.** Implement versioned local persistence and the agreed failure/fallback behavior, separate Personal and Small Business datasets, name-only sign-in, translated English/Spanish navigation, region/currency selection, dated sample data, and confirmed reset. Verify data survives refresh and mode switching.
4. **Phase 3 — Protected finance workflows.** Build searchable, sortable loan and income ledgers with validated add/edit/delete flows and impact-aware confirmations. Enforce the Small Business active-loan limit. Build the payment calendar and full-installment payment action using the shared domain rules. Update dashboard totals immediately after changes.
5. **Phase 4 — Selected dashboard and exports.** Implement the Planning Board design direction: financial summary, principal/interest breakdown, monthly payment timeline, overdue notice, active/overdue/paid loan board, and upcoming payments. Add accessible charts, estimates and currency labels, Rate Helper content and static presets, bilingual amortization CSV, and the one-page print report.
6. **Phase 5 — Financial Quest.** Implement one deterministic 6–12 month linear scenario per profile mode with multiple-choice decisions, 3–5 challenges, scores, and saved independent progress. Keep game state and labels clearly separate from real workspace finances.
7. **Phase 6 — End-to-end verification and delivery.** Run unit tests, desktop/mobile browser tests, accessibility and console-error checks; verify the production build and offline-loaded assets. Configure CI and GitHub Pages, confirm the live deployment, document local and wrapper steps, and perform the non-technical sign-in-to-report demo. Update `docs/Status.md` as work completes.

## Risk

- **Financial calculations:** The spec still calls out unresolved conventions for amortization types, annual/monthly rate conversion, US APR, precision, and penalties. Incorrect assumptions can give users misleading estimates; finalize these rules and label all estimates clearly before claiming calculation correctness.
- **Late-payment and schedule state:** Grace-period boundaries, month-end dates, payment ordering, editing terms after payments, and deletion history can change balances and status. Decide the policies before implementation and test exact boundary dates.
- **Currency and workspace isolation:** Changing region after records exist or mixing lender region with workspace currency could invalidate totals. Enforce one region/currency per workspace and define safe region-change behavior.
- **Local-only data:** Browser storage can be unavailable, full, cleared, or fail migration. Name-only sign-in is not authentication. Define visible errors, recovery, and privacy messaging without implying cloud backup or account security.
- **Reference presets:** Static Colombian and US rates can become stale or be mistaken for legal or lender terms. Select authoritative sources, show effective dates, and retain the “reference only, verify with your bank” warning.
- **Scope and schedule:** Bilingual content, all CRUD flows, accessible UI, offline assets, reports, desktop/mobile E2E, CI, and live deployment are substantial for an MVP. Protect the financial core, CRUD, calendar, persistence, and tests first; simplify game depth and chart polish before cutting protected scope.
- **Repository starting point:** There is no app scaffold or existing test suite. Toolchain, dependencies, commands, and deployment configuration must be established before test execution can be automated.
- **Status consistency:** The intent says no open questions remain, while the specification lists implementation-critical financial and delivery concerns. Resolve those concerns as decisions without silently changing the agreed product scope.

### Agentic-AI token and credit budget

This is a planning estimate, not measured usage or a quote. Budget **5–12 million model tokens total** across implementation, tests, reviews, and agent iterations. For an initial comparison, assume 80% input and 20% output tokens and the current GitHub Copilot GPT-5.3-Codex default rates of $1.75 per million input tokens and $14 per million output tokens. Under those assumptions, each million total tokens is about **420 GitHub AI Credits ($4.20 equivalent)**. The project estimate is **2,100–5,040 credits ($21–$50.40 equivalent)** before cached-token pricing effects or changes in model mix. GitHub defines one AI Credit as $0.01 USD; Copilot Pro includes 1,500 AI Credits per month, so the estimate is about 1.4–3.4 Pro monthly allowances if credits were used only for this project. The Pro subscription price and any existing included allowance are separate from this project's estimated usage value.

The estimate includes model calls for prompts, repository context, code generation, reviews, and retries; it is not a forecast of elapsed work time. Record actual project-attributable usage below by phase. Use the Copilot usage dashboard or provider usage report as the source of truth; record tokens by input/output/cache when available, credits separately, and do not infer tokens from credits. Keep subscription fees, included credits, and extra billed usage distinct. Revisit the estimate after Phase 1 using observed usage and the selected model mix.

| Phase | Estimated model tokens | Estimated AI Credits | Estimated value (USD) |
| --- | ---: | ---: | ---: |
| 0 — Resolve blockers and choose the toolchain | 0.3–0.6M | 126–252 | $1.26–$2.52 |
| 1 — Domain model and financial core | 0.9–1.8M | 378–756 | $3.78–$7.56 |
| 2 — Local data and shared app shell | 1.0–2.0M | 420–840 | $4.20–$8.40 |
| 3 — Protected finance workflows | 1.2–2.5M | 504–1,050 | $5.04–$10.50 |
| 4 — Selected dashboard and exports | 0.8–1.8M | 336–756 | $3.36–$7.56 |
| 5 — Financial Quest | 0.4–1.0M | 168–420 | $1.68–$4.20 |
| 6 — End-to-end verification and delivery | 0.4–2.3M | 168–966 | $1.68–$9.66 |
| **Total** | **5–12M** | **2,100–5,040** | **$21.00–$50.40** |

Actual usage ledger (fill in from provider reports as work proceeds; USD is credit-equivalent value, not necessarily additional cash spend):

| Phase | Actual input tokens | Actual output tokens | Actual cached tokens | AI Credits used | Credit value (USD) | Model / session notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 0 — Resolve blockers and choose the toolchain | — | — | — | — | — | — |
| 1 — Domain model and financial core | — | — | — | — | — | — |
| 2 — Local data and shared app shell | — | — | — | — | — | — |
| 3 — Protected finance workflows | — | — | — | — | — | — |
| 4 — Selected dashboard and exports | — | — | — | — | — | — |
| 5 — Financial Quest | — | — | — | — | — | — |
| 6 — End-to-end verification and delivery | — | — | — | — | — | — |
| **Total** | **—** | **—** | **—** | **—** | **—** | **Actual usage not yet recorded** |

Pricing sources checked 2026-11-23: [GitHub Copilot models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing) and [usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing). Rates and plan allowances can change; recalculate before budgeting. Other models or direct API providers will have different rates.

## Proof

### Unit tests

- **Amortization and rates:** zero-interest loans; agreed simple and compound examples; monthly/effective-annual conversion; installment totals; final balance; rounding and currency precision; invalid and boundary inputs.
- **Schedule dates:** first payment date anchoring; month-end dates such as January 31; leap-year dates; correct installment count and ordering.
- **Payment status and penalties:** derived Active/Paid/Overdue states; exact due-date and five-day grace boundaries; simple penalty accrual after grace without compounding; paid installments excluded from further accrual.
- **Income and workspaces:** recurring income affects monthly net balance and debt-to-income; one-time income stays separate; zero recurring income avoids division-by-zero; profile datasets and currencies do not cross-contaminate.
- **Loan limits and game:** active loans enforce the Small Business three-loan limit while paid-off loans do not count; deterministic game decisions update virtual cash, debt, challenges, net worth, and emergency buffer.
- **Reports and sample data:** CSV fields, complete schedules, currency, and translated headers; print-summary totals; seeds include useful upcoming and overdue examples for both modes.

### End-to-end tests

- **Onboarding and shell:** enter a local name, open the dashboard, switch Personal/Small Business and English/Spanish, and verify user-entered values remain unchanged.
- **Workspace isolation and limit:** create records in one mode and verify they remain separate after switching; verify the fourth active Small Business loan is blocked, the simulated upgrade flow is clear, and paid-off loans do not count.
- **Loan and income CRUD:** create, search, sort, edit, and confirm deletion for both tables; verify records and impact-sensitive totals persist after reload.
- **Calendar and dashboard:** verify generated dates and status labels; mark a full installment paid; check remaining balance, calendar, and dashboard update; exercise overdue/grace examples.
- **Persistence and reset:** reload the app and restore state; confirm reset warns about data loss and reseeds sample data; verify storage errors are visible rather than reported as success.
- **Financial Quest:** complete a scenario from each profile mode, verify decisions and challenges update scores, and confirm progress persists without changing real loans or income.
- **Exports and offline:** download and inspect the amortization CSV; verify the one-page print summary and bilingual labels; load the production build with network access disabled after assets are cached/bundled.
- **Responsive and accessibility checks:** run key flows at agreed desktop and mobile viewports; verify keyboard access, visible focus, labels, accessible chart summaries, no horizontal overflow, and no browser console errors.
- **CI and deployment:** require unit and end-to-end checks to pass in CI, build the static GitHub Pages artifact, verify the live app, and complete the non-technical sign-in-to-report demo.
