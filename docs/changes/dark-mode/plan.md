# Dark mode implementation plan

## Files that change

- `src/App.tsx` — add an accessible theme toggle to the sign-in screen and shared application header; apply the selected theme throughout the app.
- `src/i18n/en.ts` and `src/i18n/es.ts` — add localized toggle labels.
- `src/storage/model.ts`, `src/storage/seed.ts`, and `src/storage/repository.ts` — persist the theme preference, default new profiles to light mode, and migrate existing schema-v2 profiles without changing their other data.
- `src/styles/tokens.css` — define the light and dark semantic color tokens, keeping the existing light values unchanged.
- `src/styles/global.css` and `src/styles/print.css` — use the tokens for themed surfaces, text, controls, charts, dialogs, status indicators, and messages; preserve legible light-mode printing.
- `tests/unit/app.test.tsx` and `tests/unit/storage.test.ts` — cover theme behavior, persistence, and migration.
- `tests/e2e/app.spec.ts` — cover the user-visible toggle, reload persistence, section coverage, and dark-mode accessibility.
- `docs/changes/dark-mode/dashboard-light.png`, `docs/changes/dark-mode/dashboard-dark.png`, `docs/changes/dark-mode/loans-light.png`, and `docs/changes/dark-mode/loans-dark.png` — save the required screenshots.
- `docs/Status.md` — record completion.
- No dependency or package-manifest changes are expected.

## Order of work

1. **Persist the preference.** Add a `light`/`dark` theme value to app state, initialize it to `light`, and migrate schema-v2 data to schema v3 with the light default. Add storage tests proving existing profile and workspace data survives migration and the selected theme round-trips.
2. **Create the theme tokens.** Keep all current light-mode colors unchanged. Define the dark palette using Budgify's brand surfaces and ink, plus contrast-appropriate accent, status, and feedback tokens. Replace hard-coded theme colors in the global and print stylesheets with tokens.
3. **Wire the toggle and theme application.** Add localized, keyboard-accessible controls to sign-in and the shared header so they are available throughout the app. Persist changes through the existing repository, apply the theme at the document root, and retain the current responsive layouts and default light appearance. Do not follow the device theme.
4. **Prove the behavior and save screenshots.** Add the focused unit and end-to-end coverage below. Capture the dashboard and Loans & Installments ledger in both modes, run `npm run check`, and update `docs/Status.md`.

## Risks

- The global stylesheet contains many existing light-only color literals. Missing one can leave a component unreadable in dark mode or violate the requirement to centralize colors; audit every color declaration and test representative dialogs, charts, status indicators, and messages.
- Existing users must receive a light default during migration without losing saved data. Keep the migration additive and verify it against real schema-v2-shaped test data.
- The preference loads asynchronously with app state. Apply it before displaying the signed-in workspace to avoid a visible theme flash after reload; if persistence fails, surface the existing storage error rather than showing a saved-success state.
- Replacing colors can unintentionally alter light mode. Compare its dashboard and ledger appearance before and after; only the new toggle should differ.
- Keep printed reports legible and light regardless of the selected screen theme. Preserve the current phone layout; do not introduce a phone-specific redesign.
- Playwright runs browsers in parallel. Restrict screenshot artifact generation to Chromium and use fixed, distinct output paths to avoid concurrent writes from multiple projects.

## Proof

- **Unit — `tests/unit/storage.test.ts`:** schema-v2 data migrates to schema v3 with `light` as the default and all existing profile/workspace data intact; a chosen dark theme survives a repository reload.
- **Unit — `tests/unit/app.test.tsx`:** the app starts in light mode, the toggle applies the selected root theme, and its accessible label reflects the available action.
- **End-to-end — `tests/e2e/app.spec.ts`:** verify light is the initial mode, switch to dark, confirm the preference remains dark after reload, and confirm the toggle is available across sign-in and every product section. Verify switching back to light also persists.
- **End-to-end accessibility — `tests/e2e/app.spec.ts`:** extend the existing Axe checks to cover every product section and dialogs in dark mode; check the theme's text and control contrast meets the intent's WCAG AA thresholds.
- **Screenshots — Chromium in `tests/e2e/app.spec.ts`:** capture dashboard and Loans & Installments in light and dark modes to the four PNG paths listed above.
- **Full check:** `npm run check` passes, including unit and end-to-end suites.
