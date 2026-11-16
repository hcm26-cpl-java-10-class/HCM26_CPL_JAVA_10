import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 90000,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/test-results.json" }],
  ],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "on",
    video: "on",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "Desktop-Chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "Tablet-Chromium",
      use: {
        ...devices["iPad Pro 11"],
        defaultBrowserType: "chromium",
      },
    },
    {
      name: "Mobile-Chromium",
      use: {
        ...devices["Pixel 7"],
        defaultBrowserType: "chromium",
      },
    },
  ],
});
