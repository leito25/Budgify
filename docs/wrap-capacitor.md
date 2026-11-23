# Capacitor wrapper notes

This repository ships a static web app, not a Capacitor project. These steps describe a possible future mobile wrapper; they do not enable native packaging.

1. Create a Capacitor project in a dedicated change and point its web directory at Vite's `dist/` output. Keep relative asset paths and verify the built app loads from the WebView.
2. Add and configure iOS and Android platforms separately, following the current Capacitor setup and native signing requirements for each platform.
3. Test the complete persistence fallback chain and schema recovery on device. Keep user data within the app's local profile unless an explicitly designed, consent-based export or sync feature is added.
4. Verify keyboard behavior, safe-area insets, dynamic text, screen-reader labels, date/number inputs, and the 375-pixel responsive layout on physical devices.
5. Add native plugins only for a documented need, review their permissions and data handling, and keep the financial calculations in the shared TypeScript domain layer.
6. Update privacy disclosures to clarify that the name-only sign-in is not authentication and that device storage can be lost or accessed by another person using the device.

No Capacitor dependency, platform folder, plugin, or native configuration is included.
