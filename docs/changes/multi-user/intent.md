# Intent: sign-in, search and a user menu

## Problem

Budgify runs on one computer for one person. In small business mode, a team can't share it, no one signs in, and there's no quick way to find a record. Today it is a client-side app with its data in the browser and no backend.

## Proposed outcome

A small team of a small business shares one Budgify on the web. Everyone signs in and works on the same Small Business workspace, and each loan, income entry and payment shows who added it. The Personal workspace stays local to the browser. A search box in the top bar finds any income entry or loan. A menu under your initials holds the theme, light, dark or system, and signing out.

## Constraints

- This change adds the backend: FastAPI with SQLAlchemy Core and migrations. The Small Business data (loans, income entries, payments) moves from the browser to the API. The Personal workspace keeps using local browser storage.
- The data lives in Postgres on Supabase, through SQLAlchemy Core. The tests keep their own SQLite databases.
- Sign-in uses Supabase Auth with an email and password and replaces the local name-only profile and simulated session. The browser holds only the publishable key. The backend checks the token on every request and takes the user from it, never from the request.
- There's no sign-up page. People are added in Supabase's dashboard.
- The settings live in .env as DATABASE_URL, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.
- Each loan, income entry and payment records who added it and who last changed it. A payment records who settled it.
- The end-to-end tests and ui-check sign in without anyone's real password and never touch Supabase. CI needs no secrets.
- Search ignores case and works the same on SQLite and Postgres.
- The theme moves from the dark mode button into the menu. The system option follows the device's setting; the spec's "does not follow the device theme" rule changes accordingly.
- Budgify now needs an internet connection for Supabase. The tests still run without one.
- The app deploys to Render's free plan as one web service: FastAPI serves the built frontend and the API, migrations run when it starts, and it answers at its onrender.com address. A render.yaml describes it, with the Supabase settings entered in Render, not written in the file.
- Every unit test, old and new, runs in under a second on this computer, because CI runs on a much slower machine.
- No new dependencies unless the plan makes the case for one.

## Not in this change

- Roles and permissions: everyone can do everything.
- Moving the data in the local browser storage to Supabase. Supabase starts with the Small Business sample data.
- Signing in with Google, magic links or a password reset.
- Organizations, contacts, deals and activities as new record types.

## Success criteria

1. npm run check passes and never touches Supabase, with or without the settings in .env.
2. Signed out, every page shows the sign-in screen and every API route refuses. Signed in, everything works as before.
3. Every loan, income entry and payment shows who added it.
4. Search finds a loan or an income entry by part of its name, in any case.
5. The menu's theme choice is remembered, and the system follows the device's setting.
6. The built app runs on this computer the way Render runs it, signed in against Supabase.
