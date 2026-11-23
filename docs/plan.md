# Budgify MVP: implementation plan

Source documents: `docs/intent.md`, `docs/spec.md`, `docs/TechStack.md`. No code is written by this plan.

**Working stack (to confirm in Phase 0):** React + TypeScript + Vite, hash routing, IndexedDB via a thin storage wrapper (localStorage fallback), Vitest for unit tests, Playwright for end-to-end tests, plain CSS with brand tokens, locally bundled fonts, hand-built SVG charts (no network, no heavy chart dependency).

---

## 1. Files that change

The repository has no application scaffold yet; it already contains project documentation, the brand skill, and design mockups. All planned app, tooling, and test paths below are new unless marked *(existing)*.

### Documentation
| File | Purpose |
| --- | --- |
| `docs/intent.md`, `docs/spec.md`, `docs/TechStack.md` *(existing)* | Unchanged, except `spec.md` gets the resolved decisions linked from its "Concerns" section. |
| `docs/decisions.md` | Decision record resolving the 8 open concerns in the spec (Phase 0). Source of truth for engine rules. |
| `docs/plan.md` *(existing)* | This file. |
| `docs/Status.md` *(existing)* | Record completed phases and current project status. |
| `docs/rate-presets.md` | Sources, dates, and manual update process for reference rates. |
| `docs/wrap-electron.md`, `docs/wrap-capacitor.md` | Documented (not shipped) wrapping steps. |
| `docs/demo-script.md` | Non-technical user demo procedure and observation checklist. |
| `README.md` *(existing)* | One start command, reset command, offline prerequisites, supported browsers, deploy notes. |

### Tooling and delivery
| File | Purpose |
| --- | --- |
| `package.json`, lockfile, `tsconfig.json` | Scripts: `start`/`dev`, `build`, `test`, `test:e2e`, `reset`. |
| `vite.config.ts` | Relative base (`./`), static output to `dist/`. |
| `playwright.config.ts` | Projects: desktop Chromium, Firefox, WebKit, and mobile viewports. |
| `.github/workflows/ci.yml` | Install, typecheck, unit tests, build, Playwright on desktop + mobile. |
| `.github/workflows/pages.yml` | Build and deploy `dist/` to GitHub Pages. |
| `scripts/reset.*` | Documented cross-platform reset of local data (cross-platform Node script, plus the in-app button). |

### Domain logic (pure, no DOM)
| File | Purpose |
| --- | --- |
| `src/domain/money.ts` | Integer minor-unit money, currency metadata (COP, USD), rounding. |
| `src/domain/rates.ts` | Monthly / effective-annual / APR conversions. |
| `src/domain/schedule.ts` | Simple and compound schedule generation, month-end date handling. |
| `src/domain/late-interest.ts` | Grace period, simple penalty interest, day-count. |
| `src/domain/status.ts` | Derived Active / Paid / Overdue (and in-grace flag). |
| `src/domain/cashflow.ts` | Recurring-only monthly cash flow, debt-to-income, one-time balance snapshot. |
| `src/domain/business-limit.ts` | 3-active-loan rule for Small Business. |
| `src/domain/aggregates.ts` | Dashboard and report totals from the same schedule source. |
| `src/domain/validation.ts` | Loan and income validation rules and error codes. |
| `src/domain/game/*.ts` | Quest scenarios (personal, business), deterministic rules, scoring, challenges. |
| `src/domain/types.ts` | Shared types: Workspace, Loan, Payment, Income, GameProgress. |

### Data and persistence
| File | Purpose |
| --- | --- |
| `src/storage/db.ts` | IndexedDB wrapper, versioning, migrations, backup-before-migrate. |
| `src/storage/fallback.ts` | localStorage fallback and in-memory mode with visible flag. |
| `src/storage/repository.ts` | Typed reads/writes per workspace; write failures surface to the UI. |
| `src/storage/seed.ts` | Seed data generated relative to "today" (incl. one overdue loan). |
| `src/session/session.ts` | Name-only local sign-in, persisted session. |
| `src/data/reference-rates.ts` | Static dated presets for Colombia and US. |

### i18n
| File | Purpose |
| --- | --- |
| `src/i18n/en.ts`, `src/i18n/es.ts` | Complete string tables (UI, validation, charts, helper, game, reports). |
| `src/i18n/index.ts` | Lookup, language persistence, number/date formatting per locale. |
| `scripts/check-i18n.*` | Fails CI when a key exists in one language but not the other. |

### UI
| File | Purpose |
| --- | --- |
| `src/main.tsx`, `src/App.tsx`, `src/routes.tsx` | Entry, shell, hash routes. |
| `src/styles/tokens.css`, `global.css`, `print.css` | Brand tokens (`#F0F4F5`, `#073B4C`, `#06D6A0`, `#FFC145`, `#F78C6B`, `#118AB2`, `#EF476F`), light mode only, print layout. |
| `public/fonts/*` | Instrument Sans, Instrument Serif, JetBrains Mono, bundled. |
| `src/components/shell/*` | Navigation rail, mode switch, language toggle, storage-status banner. |
| `src/components/common/*` | Data table (search, sort, keyboard), dialog, confirm-delete, form fields with associated errors, badges (icon + text, not color alone). |
| `src/features/signin/*` | Sign-in screen with "not real authentication" notice. |
| `src/features/dashboard/*` | Summary cards, attention notice, status board, charts with text/table equivalents. |
| `src/features/loans/*` | Ledger, loan form, Rate Helper, presets, business-limit upgrade dialog. |
| `src/features/income/*` | Ledger, income form, balance snapshot. |
| `src/features/calendar/*` | Calendar grid, list fallback, mark-paid flow. |
| `src/features/quest/*` | Guided scenario UI, progress, results. |
| `src/features/reports/*` | CSV export, one-page print summary. |
| `src/features/settings/*` | Reset with confirmation, storage diagnostics. |

### Tests
| File | Purpose |
| --- | --- |
| `tests/unit/**` | One test file per domain module, storage, i18n parity, seed. |
| `tests/e2e/**` | Specs listed in section 4. |
| `tests/fixtures/*` | Fixed clock, seeded datasets, golden amortization tables. |

### Open input needed
The selected Planning Board mockup and brand skill are available in the repository and referenced by the spec; read them during Phase 0. The task text refers to `docs/specs.md`, while the repository's specification is `docs/spec.md`.

---

## 2. Order of work

Each implementation phase ends with its relevant checks passing and should be reviewable on its own; Phase 0 is a decision and approval gate. The protected core (math, CRUD, calendar, persistence, tests) comes first; game depth and chart polish come last and can shrink.

### Phase 0: Decisions and groundwork
1. Read the brand skill and the Planning Board mockup; list tokens, components, and layout rules.
2. Write `docs/decisions.md` proposing an answer for each of the spec's 8 concerns, then get agreement before Phase 1 implements behavior. Proposed defaults:
   - **Interest and rounding:** all money in integer minor units (COP has 0 decimals, USD 2). Simple interest: total interest = principal × monthly rate × n, split evenly; installment = (principal + interest) / n. Compound: standard French amortization at the monthly rate. Effective annual → monthly = (1 + EA)^(1/12) − 1. US APR is treated as nominal annual, divided by 12. Round half-up per installment; the final installment absorbs the remainder. Zero rate = principal / n. All outputs labeled "estimate, not a contractual amount".
   - **Late payments:** penalty rate is a monthly rate, applied to the unpaid installment amount only, simple, day-rate = monthly rate / 30. Penalty accrues for each day after the grace period ends (day 6 onward), not retroactively to the due date. The loan is labeled "In grace" during days 0–5 and "Overdue" after. When paid, the settled amount and penalty are stored as a snapshot.
   - **Schedule and edits:** month-end dates clamp to the last valid day, anchored to the original day (Jan 31 → Feb 28/29 → Mar 31). Out-of-order and early payments are allowed; each installment settles independently. Once any installment is paid, financial fields (principal, count, rate, type, first date) lock; only name and description remain editable. Deleting a loan removes its history after a confirmation that states how many installments were paid.
   - **Workspace region:** region chosen when a workspace is first created; locked once records exist; changing it requires resetting that workspace. A loan's region is derived from the workspace, so mixed currencies are impossible.
   - **Balances and reports:** monthly obligations = unpaid installments due in the current calendar month plus any overdue unpaid installments. One-time income appears only as a separate snapshot line. Zero recurring income shows "—" for debt-to-income, never a division. One-page summary shows totals plus the next N installments with a pointer to the CSV for the full schedule.
   - **Reference rates:** Colombia: Superintendencia Financiera usury rate (dated). US: Federal Reserve G.19 credit card interest figures (dated). Each preset carries a source, an as-of date, and the disclaimer, and is never described as a legal cap or offer. Update process documented in `docs/rate-presets.md`; a test flags presets older than a threshold.
   - **Offline persistence:** IndexedDB first; localStorage fallback; if both fail, memory-only mode with a persistent banner. Failed writes roll back the UI and show an error. Migrations back up before running; failure opens a recovery screen offering export or reset. Sign-in copy states it is not authentication and that data is visible to anyone using the same browser profile.
   - **Delivery:** latest Chrome, Edge, Firefox, Safari. Viewports 375×667, 390×844, 768×1024, 1280×800, 1440×900. Demo script written in this phase. Confirm Pages permissions on the repository.
3. Confirm the stack choices above fit `TechStack.md`.

### Phase 1: Scaffold and pipeline
- Vite + React + TypeScript, relative base, hash router, Vitest, Playwright, lint/typecheck.
- CI workflow runs on every push; Pages workflow deploys a placeholder build early so deployment risk surfaces immediately.
- Bundle fonts, apply brand tokens, light mode only.
- Fixed-clock test helper so every date-dependent test is deterministic.

### Phase 2: Financial engine (protected core)
- Money, rates, schedule, late interest, status, cash flow, business limit, validation, aggregates, in that order, each with tests written alongside.
- Golden amortization tables checked by hand for one COP and one USD example.
- Exit gate: engine test suite passes; no DOM imports in `src/domain`.

### Phase 3: Persistence, session, workspaces, seed
- Storage wrapper with versioning, fallback, failure surfacing, and migration/backup.
- Name-only session; two workspaces with separate data; region choice and lock.
- Seed generator relative to today, per workspace: 3-month grocery installments, microloans, business equipment loans across industries, income, upcoming dates, at least one overdue installment, and (for Small Business) a state that exercises the limit.
- Reset: confirm, clear, reseed.

### Phase 4: Shell and i18n
- Navigation rail, mode and language switches, storage-status banner, sign-in screen.
- All strings go through the i18n layer from the first screen onward (retrofitting is the costly path); parity check in CI.

### Phase 5: Loans & Installments
- Data table component (search, sortable headers, keyboard use) built once and reused for Income.
- Loan form with validation, associated errors, live payment/total-interest preview.
- Rate Helper and static presets with disclaimer.
- Business limit: hard block on saving a 4th active loan, simulated upgrade dialog persisted per workspace, paid loans excluded.
- Delete confirmation describing balance and schedule impact.

### Phase 6: Income & Balance
- Income ledger on the same table component; recurring versus one-time handling.
- Balance snapshot and debt-to-income, including the zero-income case.

### Phase 7: Payment Calendar
- Calendar grid with a list alternative; upcoming, grace, overdue, and paid distinguished by icon and text as well as color.
- Mark paid in full; immediate update of schedule, remaining principal, status, and dashboard; late interest display.

### Phase 8: Dashboard
- Summary cards, attention notice, three-column status board and upcoming payments following the Planning Board direction.
- Principal-versus-interest chart and monthly timeline as SVG, each with a table equivalent; tips derived from current loans.
- Chart polish is the first item to cut if time is short.

### Phase 9: Reports
- Amortization CSV for the whole active workspace, translated headers, user text untouched.
- Print stylesheet and one-page summary with defined overflow behavior.

### Phase 10: Financial Quest
- Deterministic engine and two scenarios (Personal, Business), 6–12 months, 3–5 challenges, score, per-mode persisted progress, clear labeling of simulated values.
- Depth may be simplified; the loop must be completable.

### Phase 11: Hardening
- Keyboard and focus review across tables, dialogs, calendar, and game choices; mobile reflow; console-error sweep; Spanish text-length overflow check.

### Phase 12: End-to-end and CI completion
- Full Playwright suite on desktop and mobile projects, console-error assertions, CI green.

### Phase 13: Docs, release, validation
- README, reset documentation, Electron and Capacitor wrap docs.
- Deploy to GitHub Pages, run the e2e smoke suite against the live URL, then run the observed non-technical demo from `docs/demo-script.md`.

---

## 3. Risk

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Open financial rules (the spec's 8 concerns) left undecided | Rework of engine, tests, and UI | Phase 0 gate; engine behavior is not finalized until `decisions.md` is agreed. |
| Rounding and rate-conversion errors | Wrong payments, trust loss | Integer minor units, golden tables, boundary tests, "estimate" labeling. |
| Date logic: month-end, grace boundary, time zones, DST | Off-by-one overdue status and penalties | Date-only values (no time component), injected clock, boundary tests on day 5/6 and Jan 31. |
| Seed data going stale (overdue example no longer overdue) | Demo screens look empty or wrong | Seed generated relative to today; test asserts the overdue case exists at creation. |
| Edits to loans with existing payments | Corrupt history | Financial fields lock after the first payment; documented in the form. |
| Mixed currency sneaking in | Incorrect totals | Region lives on the workspace; loan region is derived, not entered. |
| IndexedDB blocked, full, cleared, or migration failure | Silent data loss | Fallbacks, visible banner, rollback on failed write, backup before migration, recovery screen. |
| Implementation drifts from selected brand and dashboard direction | Visual rework | Phase 0 reads the available brand skill and Planning Board mockup; Phase 8 checks implementation against them. |
| Rate presets stale or mistaken for a legal cap | Misleading users | Dated, sourced, disclaimer, staleness test, update doc. |
| Translation drift and Spanish text overflow | Untranslated strings, broken layouts | Parity check in CI, e2e language switch, overflow review in Phase 11. |
| Accessibility gaps in custom table, calendar, charts | Fails the spec | Build on semantic elements, table equivalents for charts, keyboard e2e checks. |
| `file://`/Pages subpath asset breakage | Blank deployed app | Relative base from Phase 1, early placeholder deploy. |
| Print one-pager overflows with long schedules | Unusable report | Defined summary-plus-next-N rule; CSV carries the full schedule. |
| Scope pressure | Core quality drops | Cut order: chart polish, then game depth; never the protected core. |
| Non-technical demo reveals confusion late | Late UX changes | Run an informal walkthrough after Phase 7, formal one in Phase 13. |
| Cross-browser differences (WebKit IndexedDB, date inputs) | Failures on Safari or mobile | Playwright WebKit project from Phase 1. |
| Flaky e2e from real time | Unreliable CI | Fixed clock and seeded storage in tests. |

### Agentic-AI token and credit budget

These are rough planning estimates, not measured usage or a quote. They are aligned to the 14 phases above and cover model calls for prompts, repository context, implementation, reviews, and retries. The estimate assumes 80% input and 20% output tokens using the current GitHub Copilot GPT-5.3-Codex default rates of $1.75 per million input tokens and $14 per million output tokens. That is approximately **420 GitHub AI Credits ($4.20 equivalent) per million total tokens**. One GitHub AI Credit is $0.01 USD. Cached-token pricing, model changes, and actual agent iteration can change the total.

| Phase | Estimated model tokens | Estimated AI Credits | Estimated value (USD) |
| --- | ---: | ---: | ---: |
| 0 — Decisions and groundwork | 0.2–0.4M | 84–168 | $0.84–$1.68 |
| 1 — Scaffold and pipeline | 0.3–0.6M | 126–252 | $1.26–$2.52 |
| 2 — Financial engine | 0.7–1.8M | 294–756 | $2.94–$7.56 |
| 3 — Persistence, session, workspaces, seed | 0.6–1.5M | 252–630 | $2.52–$6.30 |
| 4 — Shell and i18n | 0.4–0.8M | 168–336 | $1.68–$3.36 |
| 5 — Loans and installments | 0.4–1.1M | 168–462 | $1.68–$4.62 |
| 6 — Income and balance | 0.2–0.5M | 84–210 | $0.84–$2.10 |
| 7 — Payment calendar | 0.3–0.7M | 126–294 | $1.26–$2.94 |
| 8 — Dashboard | 0.35–0.9M | 147–378 | $1.47–$3.78 |
| 9 — Reports | 0.2–0.5M | 84–210 | $0.84–$2.10 |
| 10 — Financial Quest | 0.3–0.7M | 126–294 | $1.26–$2.94 |
| 11 — Hardening | 0.35–1.0M | 147–420 | $1.47–$4.20 |
| 12 — End-to-end and CI completion | 0.45–1.2M | 189–504 | $1.89–$5.04 |
| 13 — Docs, release, validation | 0.25–0.3M | 105–126 | $1.05–$1.26 |
| **Total** | **5–12M** | **2,100–5,040** | **$21.00–$50.40** |

Actual project usage has not yet been measured. Update this ledger from Copilot or provider usage reports as phases proceed; record tokens and credits separately rather than estimating one from the other. The USD value is credit-equivalent, not necessarily additional cash spending. Subscription price and included monthly allowance are separate; Copilot Pro currently includes 1,500 AI Credits per month, so this estimate is about 1.4–3.4 Pro monthly allowances if usage is devoted solely to Budgify.

| Phase | Actual input tokens | Actual output tokens | Actual cached tokens | AI Credits used | Credit value (USD) | Model / session notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 0 — Decisions and groundwork | — | — | — | — | — | — |
| 1 — Scaffold and pipeline | — | — | — | — | — | — |
| 2 — Financial engine | — | — | — | — | — | — |
| 3 — Persistence, session, workspaces, seed | — | — | — | — | — | — |
| 4 — Shell and i18n | — | — | — | — | — | — |
| 5 — Loans and installments | — | — | — | — | — | — |
| 6 — Income and balance | — | — | — | — | — | — |
| 7 — Payment calendar | — | — | — | — | — | — |
| 8 — Dashboard | — | — | — | — | — | — |
| 9 — Reports | — | — | — | — | — | — |
| 10 — Financial Quest | — | — | — | — | — | — |
| 11 — Hardening | — | — | — | — | — | — |
| 12 — End-to-end and CI completion | — | — | — | — | — | — |
| 13 — Docs, release, validation | — | — | — | — | — | — |
| **Total** | **—** | **—** | **—** | **—** | **—** | **Actual usage not yet recorded** |

Pricing sources checked 2026-11-23: [GitHub Copilot models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing) and [usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing-and-usage/individuals/billing). Rates and allowances can change; recalculate before budgeting.

---

## 4. Proof

### Unit tests (Vitest, no DOM)

**Money and rates**
- Rounding half-up for COP (0 decimals) and USD (2 decimals); final installment absorbs remainder; installments sum exactly to total.
- Monthly ↔ effective-annual ↔ APR conversions, including a round-trip.
- Zero rate: payment = principal / n, zero interest.

**Schedule**
- Simple-interest schedule: total interest, equal installments, balance reaches zero.
- Compound schedule against a hand-checked golden table (one COP, one USD).
- Single-installment loan; 3-month grocery purchase; 60-month loan.
- Due dates: first payment date is installment 1; month-end clamping (Jan 31, Feb 29 leap year, Feb 28, 30-day months); year rollover.

**Late interest and status**
- Day 0 (due), day 5 (last grace day): no penalty. Day 6: first penalty day.
- Penalty is simple, linear in days, never compounded; uses unpaid installment amount and the penalty rate; zero penalty rate.
- Status: Active, In grace, Overdue, Paid; derived only from dates and payments; a loan is Paid only when all installments are settled; one overdue installment makes the loan Overdue.
- Out-of-order and early payments; paid installment stores its settled amount and penalty snapshot.

**Cash flow and aggregates**
- Recurring income only in monthly cash flow and debt-to-income; one-time income only in the snapshot.
- Zero recurring income: no division by zero, shows the empty value.
- Monthly obligations include current-month and overdue unpaid installments.
- Dashboard totals, report totals, and calendar entries all agree for the same data.
- Marking an installment paid reduces remaining principal and changes aggregates as expected.

**Validation and limits**
- Rejects nonpositive principal, nonpositive or non-integer installment counts, negative rates, invalid dates, missing required fields.
- Business limit: 3 active loans allowed, 4th blocked; paid loans excluded; paying off a loan frees a slot; Personal has no limit; upgrade flag per workspace.
- Manual status input is rejected.

**Storage, session, seed, i18n**
- Repository round-trip; separate data per mode; failed write is reported and not marked saved; fallback chain; migration success, migration failure with backup; reset restores seed.
- Seed contains every required record kind, including an overdue installment, relative to a fixed clock.
- Reference presets have source, date, and disclaimer; staleness check.
- English and Spanish key parity; no missing keys; user-entered strings untouched by formatting.

**Game**
- Deterministic: same choices produce the same outcome; 6–12 months; 3–5 challenges per scenario.
- Representative decisions: paying high-interest debt first improves score, unnecessary installment hurts it, emergency buffer builds as expected.
- Progress save/restore per mode; scenario completion and score.

### End-to-end tests (Playwright; desktop and mobile projects; fixed clock; each asserts no console errors)

1. **Sign-in:** name-only sign-in, session persists after reload, sign-out works, no password field, notice shown.
2. **Start state:** after sign-in the dashboard and every other screen show seeded data.
3. **Loans CRUD:** add (grocery, 3 installments), search, sort by each heading, edit, delete with confirmation text about balance and schedule impact, cancel keeps the record; persists after reload.
4. **Loan form validation:** errors tied to inputs; invalid dates and negative rates rejected; payment and total interest preview correct.
5. **Rate Helper:** open, apply a preset, disclaimer visible, region-specific presets (Colombia vs US).
6. **Income CRUD:** add, search, sort, edit, delete with confirmation; recurring vs one-time appear in the right places; zero-income state.
7. **Workspaces:** Personal and Small Business hold separate data; switching swaps data; currency per workspace (COP/USD) with no mixed totals; region locked once records exist.
8. **Business limit:** saving a 4th active loan is blocked with the simulated upgrade prompt; accepting unlocks; switching mode instead works; a paid-off loan frees a slot.
9. **Calendar:** shows upcoming, grace, overdue, and paid without color alone; mark paid updates schedule, remaining principal, status, and dashboard immediately; overdue example shows simple late interest; keyboard operation.
10. **Dashboard:** cards, charts, upcoming dates, and tips match the data; chart text equivalents present; update after payment.
11. **Persistence and reset:** all changes survive reload and browser restart; reset asks for confirmation, then restores sample data; IndexedDB-unavailable mode shows the banner and does not claim success.
12. **Language:** toggle covers every screen including validation, charts, helper, game, reports; preference persists; user-entered text unchanged.
13. **Reports:** CSV downloads with full schedule and translated headers for the active workspace; print view fits one page with totals.
14. **Financial Quest:** complete a full scenario in both modes, see net-worth and buffer effects, leave and resume with progress intact, progress independent per mode.
15. **Accessibility smoke:** tab order, visible focus, dialog focus handling, table and calendar keyboard use; automated axe scan on each screen.
16. **Responsive:** 375, 390, 768, 1280, 1440 widths; core actions remain reachable; no horizontal scroll; Spanish text does not break layouts.
17. **Full flow:** sign-in → add loan → pay installment → view dashboard → export CSV → print summary.
18. **Live smoke:** the same flow against the deployed GitHub Pages URL.

### Non-automated proof
- Hand-verified golden amortization tables (two examples) recorded in `tests/fixtures`.
- Offline check: build, disconnect the network, load and use the app (fonts, translations, presets all local).
- Cross-platform start-command check on macOS, Linux, and Windows (CI matrix or manual).
- Observed non-technical user completes sign-in to report without help, following `docs/demo-script.md`; findings logged.
- GitHub Pages deployment confirmed live and error-free.

### Release gate
All unit tests pass; Playwright passes on desktop and mobile in CI; zero console errors; i18n parity check passes; live deployment verified; demo completed without assistance.