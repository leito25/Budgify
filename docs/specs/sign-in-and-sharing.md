# Sign-in, shared workspace, search and user menu

This area covers how people sign in, how the Small Business workspace is shared, the top-bar search, the user menu, and how the app is hosted. The rest of the product is in [spec.md](../spec.md).

## Sign-in

- Budgify requires sign-in. Signed out, every page shows the sign-in screen and every API route refuses the request.
- Sign-in uses Supabase Auth with an email and password. There is no sign-up page, password reset, Google sign-in or magic link. People are added in Supabase's dashboard.
- The sign-in screen has an email field, a password field and one Sea Green button with Midnight text. A wrong email or password shows a plain message in text, not by color alone. It does not say which of the two was wrong.
- The browser holds only Supabase's publishable key and the session it receives. The backend checks the session token on every request and takes the person from the token, never from the request body or URL.
- The session is restored when the app reopens. Signing out ends it and returns to the sign-in screen.
- Signing in needs an internet connection.
- Everyone who can sign in can do everything. There are no roles or permissions.

## Shared Small Business workspace

- All signed-in people work on one Small Business workspace. Its loans, income entries and payments live in a Postgres database on Supabase and are read and written through the app's own API.
- The Personal workspace stays local to the browser, as before. It does not use the API and is not shared.
- Changes by one person show for the others the next time the page loads or the data is refreshed. There is no live update. If two people edit the same record, the last save wins.
- Supabase starts with the Small Business sample data. The data in a browser's local storage is not moved to Supabase.

## Who added it

- Each loan, income entry and payment records who added it and who last changed it, and when.
- A payment also records who settled it.
- Ledgers and loan and payment details show who added each record and, when it differs, who changed it last. A person is shown by name, or by email when they have no name.
- The backend sets these fields from the signed-in person. They cannot be edited.
- Sample records show a sample person with a made-up `.ng` email.

## Search

- A search box in the top bar finds loans and income entries in the active workspace. It matches part of a name, ignoring case, so "pan" finds "Panadería Ruiz".
- Results name the kind of record and open it in its ledger.
- In Small Business the search runs on the server and behaves the same on SQLite (tests) and Postgres. In Personal it searches the local data.
- The ledgers keep their own search and sort boxes.

## User menu

- The top bar shows the person's initials in a Sea Green circle with Midnight text. Initials come from their name, or from their email when they have no name.
- Selecting it opens a menu panel with rounded corners and no outline, in the current theme's surface colors. It holds:
  - **Theme:** Light, Dark or System. System follows the device's setting and changes with it while the app is open.
  - **Sign out.**
- The theme choice is remembered in the browser, across reloads and sign-ins. Light is the default.
- The menu is keyboard-operable: it opens with Enter or Space, closes with Escape, and returns focus to the initials.
- The language and workspace-mode controls stay in the navigation.

## Settings

The app reads these from `.env`, or from the host's environment settings:

- `DATABASE_URL`: the Postgres connection.
- `SUPABASE_URL`: the Supabase project.
- `SUPABASE_PUBLISHABLE_KEY`: the publishable key, which is also given to the browser.

No secret is committed. Without these settings the app does not start in production.

## Hosting

- The app runs on Render's free plan as one web service. FastAPI serves the built frontend and the API, and database migrations run when it starts. It answers at its `onrender.com` address.
- `render.yaml` describes the service. The Supabase settings are entered in Render, not written in the file.
- The same build runs on a developer's computer the way Render runs it, signed in against Supabase.
- On the free plan the service sleeps when idle, so the first request after a pause is slow.

## Verification

- Unit tests and end-to-end tests use their own SQLite databases and a test sign-in that needs no real password. They never contact Supabase, and CI needs no secrets.
- `npm run check` passes with or without the Supabase settings in `.env`.
