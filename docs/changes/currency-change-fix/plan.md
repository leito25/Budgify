# Plan: Currency change fix

## Files that change

- `src/domain/types.ts`, `src/storage/model.ts`, `src/storage/repository.ts`: represent a workspace's base and display currencies, persist the exchange-rate cache, and migrate existing saved data without changing its monetary values.
- `src/domain/money.ts` and new `src/domain/exchange-rates.ts`: convert and format displayed values using currency metadata and provide live-rate retrieval with cached/offline fallback.
- `src/storage/seed.ts`: initialize workspace currencies independently of workspace type.
- `src/App.tsx`: collect currency during setup, add the display-currency control, fetch/cache rates, and convert all monetary views while keeping calculations and stored records in their base currency.
- `src/i18n/en.ts`, `src/i18n/es.ts`: add localized currency-control and unavailable-rate messages.
- `tests/unit/money.test.ts`, new `tests/unit/exchange-rates.test.ts`, `tests/unit/storage.test.ts`, `tests/unit/seed.test.ts`, and `tests/unit/app.test.tsx`: cover conversion, rate handling, migration/persistence, workspace defaults, and UI behavior.
- `tests/e2e/app.spec.ts`: verify currency conversion, workspace-specific selection persistence after reload, and unchanged underlying data.

## Order of work

1. **Model and persistence:** separate base currency from selected display currency, persist fetched rates, and add a migration that preserves existing records and their original currency interpretation.
2. **Currency and rate logic:** implement reusable conversion using currency-specific minor-unit precision; retrieve rates from a suitable live API, validate responses, cache successful rates, and use cached rates offline.
3. **Application behavior and copy:** update setup and the currency control, wire rate loading and fallback messaging, and convert rendered amounts without changing financial calculations or stored values. Cover dashboard, ledgers, calendar, reports, and quest displays.
4. **Verification:** add focused unit coverage, add end-to-end coverage for conversion and reload persistence, then run `npm run check`.

## Risks

- Existing amounts have no per-record currency; migration must identify and preserve each workspace's current currency as its base currency.
- Conversion must remain display-only, including in editors and schedules, so changing currencies cannot alter saved loan, income, payment, or game values.
- Live-rate requests may fail, return invalid data, or be blocked by browser CORS policy; surface unavailability when there is no usable cached rate and never treat a failed fetch as a successful update.
- Currency precision differs, so conversion and rounding must not introduce accumulated changes to base-currency financial calculations.
- Rate and selected-currency persistence must remain independent for Personal and Small Business workspaces.

## Proof

- **Unit:** `tests/unit/money.test.ts` — conversion and rounding across supported currencies without mutation of source values.
- **Unit:** `tests/unit/exchange-rates.test.ts` — valid live rates, cached offline fallback, and unavailable/invalid-rate behavior.
- **Unit:** `tests/unit/storage.test.ts` — schema migration preserves existing base values and persists the rate cache and per-workspace selection.
- **Unit:** `tests/unit/seed.test.ts` and `tests/unit/app.test.tsx` — workspace currency independence and display-only conversion behavior.
- **End-to-end:** `tests/e2e/app.spec.ts` — switch currency and verify displayed values convert; reload and verify the selection remains; verify workspace selections remain independent and stored values are unchanged.
- Run `npm run check` to verify the complete required checks, including unit and end-to-end suites.
