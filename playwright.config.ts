import { defineConfig, devices } from "@playwright/test";

const chrome = process.env.PLAYWRIGHT_USE_CHROME ? "chrome" : undefined;

// Each project gets its own test server with its own in-memory database,
// so browsers running in parallel never share data.
const projects = [
  {
    name: "chromium",
    port: 4173,
    use: { ...devices["Desktop Chrome"], channel: chrome },
  },
  { name: "firefox", port: 4174, use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", port: 4175, use: { ...devices["Desktop Safari"] } },
  {
    name: "mobile-chromium",
    port: 4176,
    use: {
      ...devices["Desktop Chrome"],
      channel: chrome,
      viewport: { width: 375, height: 667 },
    },
  },
];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Four browsers and four test servers at once; more workers crash Firefox.
  workers: 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { trace: "retain-on-failure" },
  projects: projects.map(({ name, port, use }) => ({
    name,
    use: { ...use, baseURL: `http://127.0.0.1:${port}` },
  })),
  webServer: projects.map(({ port }) => ({
    command: `uv run python tests/e2e/server.py --port ${port}`,
    url: `http://127.0.0.1:${port}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  })),
});
