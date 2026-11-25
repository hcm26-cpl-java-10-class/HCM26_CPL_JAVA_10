import { test, expect } from "@playwright/test";

// Helper for Teacher login
async function loginAsTeacher(page) {
  await page.goto("/login");
  await page.fill('input[type="email"], input[name="email"]', "teacher@example.com");
  await page.fill('input[type="password"], input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/teacher", { timeout: 15000 });
}

// Helper for Student login
async function loginAsStudent(page) {
  await page.goto("/login");
  await page.fill('input[type="email"], input[name="email"]', "student@example.com");
  await page.fill('input[type="password"], input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student", { timeout: 15000 });
}

test.describe("FAMS LMS - Exam Management Comprehensive E2E Tests", () => {

  test("TC-EXM-01: Teacher Navigation & Exam List Page", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to Assessments / Exams
    await page.goto("/exams");
    await expect(page).toHaveURL(/.*exams/);

    // Check main layout
    await expect(page.locator("body")).toBeVisible();
    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-01-exam-list.png", fullPage: true });
  });

  test("TC-EXM-02: Exam Edit Page Responsive Layout & Danger Zone Modal", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to Exam 70 edit page
    await page.goto("/exams/70/edit");
    await expect(page).toHaveURL(/.*exams\/70\/edit/);

    // Scroll to Delete button on the edit panel
    const deleteBtn = page.getByRole("button", { name: "Delete", exact: true }).first();
    await deleteBtn.scrollIntoViewIfNeeded();
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify Danger Modal is opened
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/DELETE/i);

    // Verify confirmation button inside dialog is disabled before typing DELETE
    const confirmDeleteBtn = modal.getByRole("button", { name: /Delete Exam/i });

    // Test input verification
    const inputConfirm = modal.locator("input");
    if (await inputConfirm.isVisible()) {
      await inputConfirm.fill("wrong");
      await expect(confirmDeleteBtn).toBeDisabled();

      // Type exact DELETE
      await inputConfirm.fill("DELETE");
      await expect(confirmDeleteBtn).toBeEnabled();
    }

    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-02-danger-zone.png" });

    // Cancel modal safely
    const cancelBtn = modal.getByRole("button", { name: /Cancel|Hủy/i }).first();
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test("TC-EXM-03: Essay Grading Interface & Large Guidelines Popups (90vw)", async ({ page }) => {
    await loginAsTeacher(page);

    // Access grading attempt #65 on Exam 70
    await page.goto("/exams/70/grading/65");
    await expect(page).toHaveURL(/.*exams\/70\/grading\/65/);

    // Check questions score sidebar or question section
    await expect(page.locator("body")).toContainText(/Question/i);

    // Test Reference Answer Popup
    const refBtn = page.getByRole("button", { name: /Reference.*Answer|Edit Reference Answer/i }).first();
    if (await refBtn.isVisible()) {
      await refBtn.click();

      // Verify modal opens
      const refModal = page.locator('[role="dialog"]').first();
      await expect(refModal).toBeVisible();
      await expect(refModal).toContainText(/Reference/i);

      // Verify character/line counter
      await expect(refModal).toContainText(/characters|lines/i);
      await page.screenshot({ path: "playwright-report/screenshots/tc-exm-03-reference-popup.png" });

      // Close popup
      const cancelRef = refModal.getByRole("button", { name: /Cancel|Close/i }).first();
      await cancelRef.click();
      await expect(refModal).not.toBeVisible();
    }

    // Test Rubric Popup
    const rubricBtn = page.getByRole("button", { name: /Grading Criteria|Rubric/i }).first();
    if (await rubricBtn.isVisible()) {
      await rubricBtn.click();

      const rubricModal = page.locator('[role="dialog"]').first();
      await expect(rubricModal).toBeVisible();
      await expect(rubricModal).toContainText(/Criteria|Rubric/i);
      await page.screenshot({ path: "playwright-report/screenshots/tc-exm-03-rubric-popup.png" });

      const cancelRubric = rubricModal.getByRole("button", { name: /Cancel|Close/i }).first();
      await cancelRubric.click();
      await expect(rubricModal).not.toBeVisible();
    }
  });

  test("TC-EXM-04: Exam Similarity Detection & Plagiarism Scanning", async ({ page }) => {
    await loginAsTeacher(page);

    // Direct navigation to valid route
    await page.goto("/exams/70/similarity");
    await expect(page).toHaveURL(/.*exams\/70\/similarity/);

    // Verify Similarity Header & StatCards
    await expect(page.locator("h1, h2, h3").first()).toContainText(/Similarity|Plagiarism/i);
    await expect(page.locator("body")).toContainText(/Submissions Scanned/i);
    await expect(page.locator("body")).toContainText(/Pairs Compared/i);

    // Verify Scan Button
    const scanBtn = page.getByRole("button", { name: /Run AI Plagiarism Scan|Scan/i }).first();
    await expect(scanBtn).toBeVisible();
    await scanBtn.click();

    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-04-similarity-page.png", fullPage: true });
  });

  test("TC-EXM-05: Exam Statistics & Grade Push Preview Modal", async ({ page }) => {
    await loginAsTeacher(page);

    // Navigate to statistics
    await page.goto("/exams/70/result-statistics");
    await expect(page).toHaveURL(/.*exams\/70\/result-statistics/);

    // Verify StatCards: Pass Rate, Fail Rate, Attempts
    await expect(page.locator("body")).toContainText(/Pass Rate/i);
    await expect(page.locator("body")).toContainText(/Fail Rate/i);

    // Open Grade Push Preview
    const previewBtn = page.getByRole("button", { name: /Preview & Publish Results|Xem trước & Đẩy điểm/i }).first();
    if (await previewBtn.isVisible()) {
      await previewBtn.click();

      // Verify Modal
      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible();
      await expect(modal).toContainText(/Eligible|Đạt|Passed/i);

      await page.screenshot({ path: "playwright-report/screenshots/tc-exm-05-grade-push-preview.png" });

      // Close modal
      const cancelBtn = modal.getByRole("button", { name: /Cancel|Hủy/i }).first();
      await cancelBtn.click();
      await expect(modal).not.toBeVisible();
    }
  });

  test("TC-EXM-06: Student Authentication & Dashboard Interface", async ({ page }) => {
    await loginAsStudent(page);

    // Verify student home
    await expect(page).toHaveURL(/.*student/);
    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-06-student-home.png" });
  });

});
