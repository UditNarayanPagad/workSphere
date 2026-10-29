import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  reporter: "list",
  globalSetup: "./apps/web/e2e/global-setup.ts",
  use: {
    baseURL: "http://127.0.0.1:5317",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"]
  }
});
