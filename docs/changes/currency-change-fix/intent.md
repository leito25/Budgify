# Intent: Currency change fix

## Problem

Currency is currently tied to the account type chosen at the start of the app: COP is linked to personal data and USD to small business. Because of this, the currency toggle does not convert anything. Users sometimes need to see the same data in COP or in USD, but the data must stay the same.

## Proposed outcome

1. I start the app and choose my name, my currency and my type of business.
2. If my data is shown in COP and I switch the currency toggle to USD, the same values persist, converted to USD.
3. The app checks the current exchange rate between the currencies and saves it persistently.
4. If there is no internet connection, the app uses the last saved exchange rate.
5. The selected currency is remembered after reloading the app.

## Constraints

- If there is no internet connection, use the saved exchange rate.
- If there is no saved exchange rate and the app is offline, explain that conversion is unavailable until a rate can be fetched.
- Fetch rates from a suitable live exchange-rate API and save them persistently.
- Changing the display currency converts displayed values only; stored amounts remain in their original/base currency.
- Remember the selected display currency separately for each workspace.
- The system must allow adding more currencies later, with the same toggle and conversion behavior and no per-currency special cases.
- Currency must be independent of account type (personal / small business). Account type must no longer decide the currency.

## Not in this change

- Real-time conversion. The rate is fetched and saved on each use of the app; it is not polled continuously.
- Historical rates or per-transaction rates.

## Success criteria

1. npm run check passes.
2. A new end-to-end test proves that the toggle converts the values and that the selected currency is remembered after a reload.
