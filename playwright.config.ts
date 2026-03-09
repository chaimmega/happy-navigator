import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 4,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["line"],
  ],

  use: {
    baseURL: "http://localhost:3010",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["**/tests/**/*.spec.ts", "**/smoke/**/*.spec.ts"],
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
      },
      testMatch: ["**/tests/07-mobile.spec.ts"],
    },
    {
      name: "soak",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["**/soak/**/*.spec.ts"],
      retries: 0, // each iteration stands alone; failures are expected to be rare
    },
    {
      name: "integration",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["**/integration/**/*.spec.ts"],
      retries: 1, // real APIs can be flaky
    },
  ],

  webServer: {
    command: "npm run dev -- -p 3010",
    url: "http://localhost:3010",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
