# Status

- Added repository-wide GitHub Copilot instructions.
- Added the `commit-last-changes` skill for updating status, committing changes, and pushing them to GitHub.
- Documented the MVP intent, proposed tech stack, and brand guidelines.
- Added guidance for concise responses and Playwright MCP testing.
- Recorded MVP interview decisions in `docs/changes/mvp/intent.md` and aligned `docs/TechStack.md`.
- Reorganized change intent and plan under `docs/changes/mvp/`, and made `docs/spec.md` the description of the product as it exists today.
- Linked `docs/STANDARDS.md` from `AGENTS.md` and added it to the review checklist.
- Drafted the MVP requirements and design specification, including concerns requiring decisions.
- Converted the brand guidelines into a project skill for user-facing work.
- Created three dashboard and loan-pipeline mockup concepts with screenshots.
- Selected the Planning Board mockup as the approved dashboard and loan-pipeline design direction.
- Added and reviewed the phased MVP implementation plan, with file scope, risks, unit/end-to-end proof, and a per-phase AI token/credit budget and usage ledger.
- Resolved the MVP's financial, schedule, workspace, storage, reference-rate, and delivery assumptions in `docs/decisions.md`; added reference-rate maintenance guidance and an observed-demo script.
- Implemented the Vite/React/TypeScript app, financial engine, fallback persistence, seeded workspaces, English/Spanish UI, loan and income ledgers, calendar, dashboard, reports, and deterministic Financial Quest.
- Added unit and Playwright coverage for the financial rules, storage, workspaces, CRUD, reference-rate helper, payment flow, exports, reset, keyboard focus, responsive widths, and automated accessibility checks.
- Added translation-key parity validation, GitHub Actions CI and Pages workflows, a cross-platform browser-opening reset helper, project README, and Electron/Capacitor wrapper guidance.
- Updated muted text contrast and modal focus handling in response to automated accessibility testing.
- Validation completed locally: 36 unit tests pass; desktop and mobile-width Chromium E2E suites pass; Firefox and WebKit suites pass after stabilizing the print action; production dependency audit reports no vulnerabilities.
- Deployed to GitHub Pages with GitHub Actions; verified the live sign-in and dashboard in Chromium.
- Made `npm test` run both unit and end-to-end suites; updated CI, setup guidance, and shared agent instructions for the planned Electron and Capacitor targets.
- Implemented the persistent local name and separate session, legacy migration, confirmed reset, storage warnings, and focused unit and browser tests.
- Profile-change validation: 42 unit tests and 58 browser tests pass; the browser-restart test is Chromium-only and skipped in Firefox and WebKit. Build and translation parity pass.
- Compared the dashboard with the selected Planning Board mockup; aligned summary cards, six-month timeline, loan lanes, and payment-date cards while retaining accessible details and mobile reflow.
- Dashboard validation: 42 unit tests and 62 browser tests pass; 2 Chromium-only restart cases are skipped in Firefox and WebKit. Build and translation parity pass.
- Added a review policy covering bugs, security, and conformance to the specification and plan.
- Added a Deploy-stage harness improvement checklist.
- Added full and quick quality checks, formatting, complexity limits, type and secret scanning, and 80% unit coverage thresholds across the app.
- Added Lefthook staged formatting and pre-commit checks, plus Copilot quick-check and `.env` edit safeguards.
- Normalized the Copilot stop hook's working directory to avoid Windows Vitest runner failures.
- Updated CI to scan for secrets first and run the full check with the runner's Chrome, Firefox and WebKit.
- Prepared the dark-mode intent, clarifying WCAG AA contrast, existing mobile-layout support, and screenshot targets.
- Updated the product specification to describe the intended post-change dark-mode behavior and brand palette.
- Added the phased dark-mode implementation plan with migration, accessibility, persistence, and screenshot proof.
- Implemented persistent light/dark mode with schema-v2 migration, localized toggles, centralized accessible theme tokens, dark-mode UI coverage, and light-mode printing. Full `npm run check` passes: 61 unit tests and 67 E2E tests pass (5 expected skips); captured dashboard and loan-ledger screenshots in both themes.
- Stabilized ledger screenshot capture by waiting for navigation; reran the full check and captured all four screenshots.
- Addressed dark-mode review findings with serialized saves, contrast-visible controls, and a narrow-screen toolbar; added storage and cross-browser regression tests.
- Added the Deploy-stage recurring async-state review rule and recorded a clean full-check result.
- Implemented workspace-independent base/display currencies with schema-v4 migration, persistent live-rate caching, display-only conversion, localized fallback messaging, setup and toolbar controls, and cross-workspace reload coverage.
- Fixed offline currency editing, queued exchange-rate writes, and converted CSV exports; added regression coverage.
- Deployment harness review: strengthened async review guidance for request identity and intervening writes. Full `npm run check` passed: 76 unit and 83 E2E tests, with 5 expected skips. Gitleaks found no issues; `ty` warned that no Python files were found.

## Remaining release validation

- The observed non-technical demo in `docs/demo-script.md` still requires a participant and must be completed outside this coding session.
- Linked the Colombian preset to the SFC's official interest-certification listing. Recheck the dated values when updating them; never treat them as current offers or legal limits.

## Ideas for later

- Use a dark border for the workspace-type control in dark mode instead of white.
- Use a dark border for the currency control in dark mode instead of white.
- Use a dark border for the language control in dark mode instead of white.
- Use a dark border for the dark-mode toggle in dark mode instead of white.
