import { test, expect } from "@playwright/test";

test.describe("FAMS LMS - Smoke Test", () => {
  test("TC-SMOKE-01: Login page loads and teacher can authenticate", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/.*login/);

    // Fill credentials
    await page.fill('input[type="email"], input[name="email"]', "teacher@example.com");
    await page.fill('input[type="password"], input[name="password"]', "password123");

    // Submit
    await page.click('button[type="submit"]');

    // Wait for redirect to teacher home
    await page.waitForURL("**/teacher", { timeout: 15000 });
    await expect(page).toHaveURL(/.*teacher/);
  });
});
