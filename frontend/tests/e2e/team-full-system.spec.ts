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

test.describe("FAMS LMS - Full System E2E Test Suite (exam_clone Branch)", () => {

  // ==========================================
  // MODULE 1: CORE AUTHENTICATION & RBAC
  // ==========================================
  test("TC-COR-01: Teacher Authentication & Landing Page", async ({ page }) => {
    await loginAsTeacher(page);
    await expect(page).toHaveURL(/.*teacher/);
    await expect(page.locator("body")).toContainText(/Assessment|Exam|Teacher/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-cor-01-teacher-landing.png" });
  });

  test("TC-COR-02: Student Authentication & Landing Page", async ({ page }) => {
    await loginAsStudent(page);
    await expect(page).toHaveURL(/.*student/);
    await expect(page.locator("body")).toContainText(/Student|Assessment|Course/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-cor-02-student-landing.png" });
  });

  test("TC-COR-03: Negative Test - Invalid Credentials Rejection", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', "wrong@example.com");
    await page.fill('input[type="password"], input[name="password"]', "invalidpassword");
    await page.click('button[type="submit"]');
    // Expect error toast or inline alert
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator("body")).toContainText(/Invalid|failed|error|incorrect|không đúng/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-cor-03-invalid-login.png" });
  });

  test("TC-COR-04: Authorization Protection - Student Denied from Teacher Exam Edit", async ({ page }) => {
    await loginAsStudent(page);
    // Student attempts to directly access Teacher Exam Edit
    await page.goto("/exams/70/edit");
    // Should be redirected to unauthorized, student home, or forbidden
    await expect(page).not.toHaveURL(/\/exams\/70\/edit$/);
    await page.screenshot({ path: "playwright-report/screenshots/tc-cor-04-student-forbidden.png" });
  });

  // ==========================================
  // MODULE 2: EXAM MANAGEMENT
  // ==========================================
  test("TC-EXM-01: Exam Management List, Search & Filters", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams");
    await expect(page).toHaveURL(/.*exams/);

    // Check search input or filters
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="Tìm kiếm"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("Comprehensive");
      await page.waitForTimeout(500);
      await expect(page.locator("body")).toContainText(/Comprehensive/i);
    }
    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-01-list-search.png" });
  });

  test("TC-EXM-02: Exam 5-Tab Detail & Course/Section Linking", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams/70/edit");
    await expect(page).toHaveURL(/.*exams\/70\/edit/);

    // Verify tabs or navigation (Overview, Questions, Grading, Invitations, Statistics)
    await expect(page.locator("body")).toContainText(/Questions|Grading|Statistics|Invitations|General/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-02-5-tabs.png" });
  });

  test("TC-EXM-03: Secure Exam Deletion Danger Zone & Modal Verification", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams/70/edit");

    const deleteBtn = page.getByRole("button", { name: "Delete", exact: true }).first();
    await deleteBtn.scrollIntoViewIfNeeded();
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify Danger Modal
    const modal = page.locator('[role="dialog"]').first();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText(/DELETE/i);

    const confirmBtn = modal.getByRole("button", { name: /Delete Exam/i });
    const inputConfirm = modal.locator("input");

    if (await inputConfirm.isVisible()) {
      await inputConfirm.fill("wrong");
      await expect(confirmBtn).toBeDisabled();

      await inputConfirm.fill("DELETE");
      await expect(confirmBtn).toBeEnabled();
    }

    // Cancel modal safely to preserve test data
    const cancelBtn = modal.getByRole("button", { name: /Cancel|Hủy/i }).first();
    await cancelBtn.click();
    await expect(modal).not.toBeVisible();
    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-03-danger-zone.png" });
  });

  test("TC-EXM-04: Curriculum Assessment Mapping Page", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams/curriculum");
    await expect(page).toHaveURL(/.*exams\/curriculum/);
    await expect(page.locator("body")).toContainText(/Curriculum|Assessment|Mapping|Môn học/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-04-curriculum-mapping.png" });
  });

  test("TC-EXM-05: Exam Templates Repository View", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/management/exam/templates");
    await expect(page).toHaveURL(/.*templates/);
    await expect(page.locator("body")).toContainText(/Template|Mẫu/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-05-templates.png" });
  });

  test("TC-EXM-06: Exam Invitations & Shift Scheduling", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/invitations");
    await expect(page).toHaveURL(/.*invitations/);
    await expect(page.locator("body")).toContainText(/Invitation|Lời mời|Candidate/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-exm-06-invitations.png" });
  });

  // ==========================================
  // MODULE 3: STUDENT EXAM PORTAL
  // ==========================================
  test("TC-STU-01: Student Exam List & Available Assessments", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/student/exams");
    await expect(page).toHaveURL(/.*student\/exams/);
    await expect(page.locator("body")).toContainText(/Assessment|Exam|Bài thi/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-stu-01-exam-list.png" });
  });

  // ==========================================
  // MODULE 4: ESSAY GRADING & GUIDELINES
  // ==========================================
  test("TC-GRD-01: Essay Grading Detail & Large Guidelines Popups (90vw)", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams/70/grading/65");
    await expect(page).toHaveURL(/.*exams\/70\/grading\/65/);

    // Reference Answer Popup
    const refBtn = page.getByRole("button", { name: /Reference.*Answer|Edit Reference Answer/i }).first();
    if (await refBtn.isVisible()) {
      await refBtn.click();
      const refModal = page.locator('[role="dialog"]').first();
      await expect(refModal).toBeVisible();
      await expect(refModal).toContainText(/Reference/i);
      await expect(refModal).toContainText(/characters|lines/i);

      const cancelRef = refModal.getByRole("button", { name: /Cancel|Close/i }).first();
      await cancelRef.click();
      await expect(refModal).not.toBeVisible();
    }

    // Grading Rubric Popup
    const rubricBtn = page.getByRole("button", { name: /Grading Criteria|Rubric/i }).first();
    if (await rubricBtn.isVisible()) {
      await rubricBtn.click();
      const rubricModal = page.locator('[role="dialog"]').first();
      await expect(rubricModal).toBeVisible();
      await expect(rubricModal).toContainText(/Criteria|Rubric/i);

      const cancelRubric = rubricModal.getByRole("button", { name: /Cancel|Close/i }).first();
      await cancelRubric.click();
      await expect(rubricModal).not.toBeVisible();
    }

    await page.screenshot({ path: "playwright-report/screenshots/tc-grd-01-grading-detail.png" });
  });

  // ==========================================
  // MODULE 5: SIMILARITY DETECTION & DEFECT-EXM-001 RESOLUTION
  // ==========================================
  test("TC-SIM-01: DEFECT-EXM-001 Fixed - Navigation from EssayAttemptListPage to /exams/:examId/similarity", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams/70/grading");

    // Look for AI Similarity Check button on the grading page
    const simBtn = page.getByRole("button", { name: /AI Similarity Check/i }).first();
    await expect(simBtn).toBeVisible({ timeout: 10000 });
    await simBtn.click();

    // Verify it navigates cleanly to /exams/70/similarity (NOT conflicting with :attemptId)
    await expect(page).toHaveURL(/.*exams\/70\/similarity/);

    // Verify page content loads without "Failed to load submission"
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Failed to load submission");
    expect(bodyText).not.toContain("not belong to this assessment");

    // Verify header and exam ID
    await expect(page.locator("h1")).toContainText(/AI Essay Similarity & Plagiarism Detection/i);
    await expect(page.locator("body")).toContainText(/Exam #70/i);

    // Verify StatCards
    await expect(page.locator("body")).toContainText(/Submissions Scanned/i);
    await expect(page.locator("body")).toContainText(/Pairs Compared/i);
    await expect(page.locator("body")).toContainText(/Suspicious Pairs/i);
    await expect(page.locator("body")).toContainText(/AI Semantic Engine/i);

    // Verify Back button returns to Essay Grading
    const backBtn = page.getByRole("button", { name: /Back to Essay Grading/i });
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(page).toHaveURL(/.*exams\/70\/grading/);

    await page.screenshot({ path: "playwright-report/screenshots/tc-sim-01-navigation-fixed.png" });
  });

  test("TC-SIM-02: Direct Route Access to Plagiarism Detection & Scan Action", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams/70/similarity");
    await expect(page).toHaveURL(/.*exams\/70\/similarity/);

    await expect(page.locator("h1")).toContainText(/AI Essay Similarity & Plagiarism Detection/i);
    await expect(page.locator("body")).toContainText(/Submissions Scanned/i);
    await expect(page.locator("body")).toContainText(/Pairs Compared/i);
    await expect(page.locator("body")).toContainText(/Lexical Only \(Fallback\)/i);

    const scanBtn = page.getByRole("button", { name: /Run AI Plagiarism Scan/i }).first();
    await expect(scanBtn).toBeVisible();
    await scanBtn.click();

    // Toast notification or scan completed
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "playwright-report/screenshots/tc-sim-02-similarity-scan.png" });
  });

  test("TC-SIM-03: Navigation from ExamEditPanel to /exams/:examId/similarity", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams/70/edit");
    await expect(page).toHaveURL(/.*exams\/70\/edit/);

    // Click AI Similarity Check button in bottom action bar
    const simBtn = page.getByRole("button", { name: /AI Similarity Check/i }).first();
    await expect(simBtn).toBeVisible({ timeout: 10000 });
    await simBtn.click();

    // Verify URL and loaded page
    await expect(page).toHaveURL(/.*exams\/70\/similarity/);
    await expect(page.locator("h1")).toContainText(/AI Essay Similarity & Plagiarism Detection/i);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("Failed to load submission");

    await page.screenshot({ path: "playwright-report/screenshots/tc-sim-03-edit-panel-navigation.png" });
  });

  // ==========================================
  // MODULE 6: EXAM STATISTICS & GRADE PUSH
  // ==========================================
  test("TC-STA-01: Pass/Fail Rate StatCards & Grade Push Preview Modal", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams/70/result-statistics");
    await expect(page).toHaveURL(/.*exams\/70\/result-statistics/);

    await expect(page.locator("body")).toContainText(/Pass Rate/i);
    await expect(page.locator("body")).toContainText(/Fail Rate/i);

    const previewBtn = page.getByRole("button", { name: /Preview & Publish Results|Xem trước & Đẩy điểm/i }).first();
    if (await previewBtn.isVisible()) {
      await previewBtn.click();
      const modal = page.locator('[role="dialog"]').first();
      await expect(modal).toBeVisible();
      await expect(modal).toContainText(/Eligible|Đạt|Passed/i);

      const cancelBtn = modal.getByRole("button", { name: /Cancel|Hủy/i }).first();
      await cancelBtn.click();
      await expect(modal).not.toBeVisible();
    }
    await page.screenshot({ path: "playwright-report/screenshots/tc-sta-01-statistics.png" });
  });

  // ==========================================
  // MODULE 7: STUDENT SCORES & APPEALS
  // ==========================================
  test("TC-SCO-01: Student My Scores Overview Page", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/my-scores");
    await expect(page).toHaveURL(/.*my-scores/);
    await expect(page.locator("body")).toContainText(/Score|Grade|Điểm/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-sco-01-my-scores.png" });
  });

  test("TC-SCO-02: Student Score Appeals Page", async ({ page }) => {
    await loginAsStudent(page);
    await page.goto("/my-appeals");
    await expect(page).toHaveURL(/.*my-appeals/);
    await expect(page.locator("body")).toContainText(/Appeal|Phúc khảo|Khiếu nại/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-sco-02-my-appeals.png" });
  });

  test("TC-SCO-03: Teacher Score Appeals Management Page", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/exams/appeals");
    await expect(page).toHaveURL(/.*exams\/appeals/);
    await expect(page.locator("body")).toContainText(/Appeal|Phúc khảo|Khiếu nại/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-sco-03-teacher-appeals.png" });
  });

  // ==========================================
  // MODULE 8: STUDENT ANALYTICS
  // ==========================================
  test("TC-ANA-01: Student Analytics Dashboard", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto("/analytics/students");
    await expect(page).toHaveURL(/.*analytics\/students/);
    await expect(page.locator("body")).toContainText(/Analytics|Student|Phân tích/i);
    await page.screenshot({ path: "playwright-report/screenshots/tc-ana-01-analytics.png" });
  });

});
