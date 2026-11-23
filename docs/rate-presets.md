# Rate presets

These bundled values are dated examples for quick-fill only. They are not bank quotes, legal advice, or a determination that a rate is valid for a particular product. Verify the exact rate, compounding convention, fees, and late-payment terms with the lender.

| Region | Preset | Value | Basis | As of | Primary source |
| --- | --- | ---: | --- | --- | --- |
| Colombia | Consumer and ordinary credit usury reference | 28.34% | Effective annual | November 2026 | [SFC current-interest certification listings](https://www.superfinanciera.gov.co/publicaciones/10829/sala-de-prensacomunicados-de-prensa-interes-bancario-corriente-10829/) |
| United States | Credit-card accounts assessed interest, average APR | 22.36% | Nominal annual (APR) | September 2026; G.19 released November 6, 2026 | [Federal Reserve G.19, current release](https://www.federalreserve.gov/releases/g19/current/) |

Both presets display: **“Reference only, verify with your bank.”** They are static and the app makes no network requests for rates.

## Manual update process

1. Check the current monthly Colombian certification on the Superintendencia Financiera site and the latest Federal Reserve G.19 release.
2. Select comparable consumer credit measures and preserve the source's rate basis. Do not silently convert a nominal APR into an effective annual rate or vice versa.
3. Update the value, as-of period, and direct source link in both this table and `src/data/reference-rates.ts`.
4. Run `npm test` and `npm run build`. Review the static-data age test; update its expected period only when a source has actually been checked.
5. Keep the disclaimer attached to every preset in both languages.
