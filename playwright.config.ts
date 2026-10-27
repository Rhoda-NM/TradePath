import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://localhost:3337",
    viewport: { width: 360, height: 800 },
    serviceWorkers: "allow",
    launchOptions: process.env.TEST_CHROMIUM
      ? { executablePath: process.env.TEST_CHROMIUM }
      : {},
  },
  reporter: "list",
});
