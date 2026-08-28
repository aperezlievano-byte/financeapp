import { defineConfig, devices } from "@playwright/test";

const PORT = 3101;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // The design bundle lives inside this project and ships a copy of this
  // config; never collect anything from it.
  testIgnore: ["**/blueprints/**", "**/node_modules/**"],
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `sh scripts/with-test-env.sh pnpm exec next dev --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // E2E_DATABASE_URL and E2E_USER_ID are defined HERE and nowhere else.
    // They appear in no .env file on purpose: Next.js only sets variables it
    // finds in a .env file, so a variable absent from every one of them can
    // never be overwritten by the framework's own loading.
    env: {
      E2E_DATABASE_URL: process.env.TEST_DATABASE_URL || "",
      E2E_USER_ID:
        process.env.APP_USER_ID || "00000000-0000-0000-0000-000000000001",
    },
  },
});
