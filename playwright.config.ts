import { defineConfig } from "@playwright/test";

/**
 * r69 (audit ⑦) — golden-path E2E suite.
 *
 * Runs against the local dev server (port 3000) with the seeded SQLite DB.
 * The sandbox dev server is externally managed and always up —
 * `reuseExistingServer` adopts it; a fresh machine auto-starts `bun run dev`.
 *
 * Workers are serialized on purpose: the specs share one database and one
 * rate-limit bucket (127.0.0.1), so parallel files would fight each other.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1, // the live panels poll + re-render every 10s; a click can
  // race a re-render — one retry absorbs that without masking real breaks
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    locale: "en-US",
    timezoneId: "Africa/Cairo",
    actionTimeout: 20_000,
    // the PWA's service worker reloads the page when it takes control —
    // that full reload racing a tab click is what made early runs flake.
    // Tests exercise the app, not the install/update flow.
    serviceWorkers: "block",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
