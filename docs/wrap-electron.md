# Electron wrapper notes

This repository ships a web service (FastAPI serving the built web app and its API), not an Electron application. Treat a future Electron wrapper as a separate delivery target.

1. Keep the financial engine and UI independent of Electron APIs.
2. Load the production Vite build from the packaged app, or serve it from a narrowly scoped local origin. Preserve the relative asset paths.
3. Keep `nodeIntegration` disabled and `contextIsolation` enabled. Expose only narrowly scoped APIs through a preload script if native functionality becomes necessary.
4. Sign-in and the Small Business workspace need the hosted service, so the wrapper must load the web app from, or call the API at, the Render address, with an internet connection. The Personal data belongs to the local webview profile and may be cleared or accessed by another person using the same OS account. The Supabase publishable key stays the only key in the app.
5. Test IndexedDB and localStorage persistence, migrations, backup and recovery in each packaged platform before release. Define an explicit data export/backup path before relying on local storage for important records.
6. Add signed installers, update behavior, privacy disclosures, and platform-specific accessibility checks only as part of a separately reviewed Electron release.

No Electron dependency, configuration, native bridge, or installer is included.
