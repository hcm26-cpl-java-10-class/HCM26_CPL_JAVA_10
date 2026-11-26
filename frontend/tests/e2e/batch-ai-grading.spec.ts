import { test, expect } from "@playwright/test";

test.describe("Batch AI Essay Grading & Human Review Confirmation Workflow", () => {
  test("Teacher triggers Batch AI Essay Grading, monitors progress, reviews AI draft in 'Chờ xác nhận AI', edits score/feedback, and confirms official grade", async ({
    page,
  }) => {
    let batchStarted = false;
    let gradeConfirmed = false;
    let confirmedScore = 8.5;
    let confirmedFeedback = "AI đề xuất: Giải thích đúng nguyên lý đa hình trong Java.";

    // Mock Batch AI Preview API
    await page.route("**/api/exams/70/grading/batch-ai/preview", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          examId: 70,
          examTitle: "Midterm Java OOP Assessment",
          totalSubmitted: 3,
          eligibleCount: 2,
          alreadyAiGradedCount: batchStarted ? (gradeConfirmed ? 1 : 2) : 0,
          ungradedCount: batchStarted ? 0 : 2,
          failedCount: 0,
          confirmedCount: gradeConfirmed ? 1 : 0,
          ineligibleCount: 1,
          activeBatchId: null,
          activeBatchStatus: null,
        }),
      });
    });

    // Mock Batch AI Latest Status API
    await page.route("**/api/exams/70/grading/batch-ai/latest", async (route) => {
      if (!batchStarted) {
        await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          batchId: 501,
          examId: 70,
          examTitle: "Midterm Java OOP Assessment",
          scope: "UNGRADED_ONLY",
          status: "COMPLETED",
          totalAttempts: 2,
          pendingCount: 0,
          processingCount: 0,
          completedCount: 2,
          failedCount: 0,
          skippedCount: 0,
          progressPercent: 100.0,
          notificationSent: true,
        }),
      });
    });

    // Mock Start Batch AI API
    await page.route("**/api/exams/70/grading/batch-ai/start", async (route) => {
      batchStarted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          batchId: 501,
          examId: 70,
          examTitle: "Midterm Java OOP Assessment",
          scope: "UNGRADED_ONLY",
          status: "COMPLETED",
          totalAttempts: 2,
          pendingCount: 0,
          processingCount: 0,
          completedCount: 2,
          failedCount: 0,
          skippedCount: 0,
          progressPercent: 100.0,
          notificationSent: true,
        }),
      });
    });

    // Mock AI Review Queue API
    await page.route("**/api/exams/70/grading/ai-review-queue**", async (route) => {
      const url = new URL(route.request().url());
      const state = url.searchParams.get("state");

      const item65 = {
        attemptId: 65,
        examId: 70,
        examTitle: "Midterm Java OOP Assessment",
        studentId: 10,
        studentName: "Nguyen Van Student",
        studentEmail: "student@example.com",
        attemptNumber: 1,
        status: gradeConfirmed ? "SUBMITTED" : "PENDING_REVIEW",
        submittedAt: new Date().toISOString(),
        essayCount: 1,
        essayAnswered: 1,
        aiGradedEssayCount: batchStarted ? 1 : 0,
        codingCount: 0,
        codingAnswered: 0,
        aiGradingState: gradeConfirmed ? "CONFIRMED" : batchStarted ? "AI_COMPLETED" : null,
        aiProposedScore: batchStarted ? 8.5 : null,
        finalScore: gradeConfirmed ? 10 + confirmedScore : null,
      };

      const list =
        !state || state === item65.aiGradingState || (state === "UNGRADED" && !item65.aiGradingState)
          ? [item65]
          : [];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: list,
          totalElements: list.length,
          totalPages: 1,
          size: 10,
          number: 0,
        }),
      });
    });

    // Mock Attempt 65 Detail API (with AI draft proposal pre-populated after batch)
    await page.route("**/api/exams/70/grading/attempts/65", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          attemptId: 65,
          examId: 70,
          examTitle: "Midterm Java OOP Assessment",
          studentId: 10,
          studentName: "Nguyen Van Student",
          studentEmail: "student@example.com",
          attemptNumber: 1,
          status: gradeConfirmed ? "SUBMITTED" : "PENDING_REVIEW",
          startedAt: new Date(Date.now() - 1800000).toISOString(),
          submittedAt: new Date().toISOString(),
          totalPoints: 20,
          maxScore: 20,
          objectiveScore: 10,
          finalScore: gradeConfirmed ? 10 + confirmedScore : null,
          alreadyGraded: gradeConfirmed,
          aiGradingState: gradeConfirmed ? "CONFIRMED" : "AI_COMPLETED",
          aiProposedEssayScore: 8.5,
          confirmedAt: gradeConfirmed ? new Date().toISOString() : null,
          essays: [
            {
              questionId: 101,
              displayOrder: 1,
              content: "Giải thích tính Đa hình (Polymorphism) trong lập trình hướng đối tượng Java.",
              points: 10,
              maxScore: 10,
              answerText: "Đa hình cho phép đối tượng thể hiện nhiều hình thái thông qua overriding và overloading.",
              score: gradeConfirmed ? confirmedScore : null,
              feedback: gradeConfirmed ? confirmedFeedback : null,
              aiProposal: {
                questionId: 101,
                proposedScore: 8.5,
                feedback: "AI đề xuất: Giải thích đúng nguyên lý đa hình trong Java.",
                reasoning: "Đầy đủ ý overriding và overloading.",
                analysis: "Trình bày mạch lạc, chính xác.",
                flagAmbiguous: false,
              },
            },
          ],
          codings: [],
        }),
      });
    });

    // Mock Official Grade Confirmation API
    await page.route("**/api/exams/70/grading/attempts/65/grade", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      if (body.grades && body.grades[0]) {
        confirmedScore = Number(body.grades[0].score);
        confirmedFeedback = body.grades[0].feedback;
      }
      gradeConfirmed = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          attemptId: 65,
          examId: 70,
          examTitle: "Midterm Java OOP Assessment",
          studentId: 10,
          studentName: "Nguyen Van Student",
          studentEmail: "student@example.com",
          attemptNumber: 1,
          status: "SUBMITTED",
          startedAt: new Date(Date.now() - 1800000).toISOString(),
          submittedAt: new Date().toISOString(),
          totalPoints: 20,
          maxScore: 20,
          objectiveScore: 10,
          finalScore: 10 + confirmedScore,
          alreadyGraded: true,
          aiGradingState: "CONFIRMED",
          aiProposedEssayScore: 8.5,
          confirmedAt: new Date().toISOString(),
          essays: [
            {
              questionId: 101,
              displayOrder: 1,
              content: "Giải thích tính Đa hình (Polymorphism) trong lập trình hướng đối tượng Java.",
              points: 10,
              maxScore: 10,
              answerText: "Đa hình cho phép đối tượng thể hiện nhiều hình thái thông qua overriding và overloading.",
              score: confirmedScore,
              feedback: confirmedFeedback,
            },
          ],
          codings: [],
        }),
      });
    });

    // 1. Login as Teacher
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', "teacher@example.com");
    await page.fill('input[type="password"], input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/teacher", { timeout: 15000 });

    // 2. Navigate to Exam 70 Grading Page
    await page.goto("/exams/70/grading");
    const openBatchBtn = page.getByTestId("btn-open-batch-ai");
    await expect(openBatchBtn).toBeVisible({ timeout: 15000 });

    // 3. Open Pre-flight Confirmation Modal & Start Batch AI Grading
    await openBatchBtn.click();
    const confirmModal = page.getByTestId("batch-ai-confirm-modal");
    await expect(confirmModal).toBeVisible();
    await expect(confirmModal).toContainText("Tổng số bài đủ điều kiện:");

    await page.getByTestId("btn-confirm-start-batch-ai").click();

    // 4. Verify Progress Card & Filter Tab "Chờ xác nhận AI"
    await expect(page.getByTestId("batch-ai-progress-card")).toBeVisible();
    await expect(page.getByTestId("batch-ai-progress-card")).toContainText("100.0% hoàn tất");

    await page.getByTestId("filter-tab-AI_COMPLETED").click();
    const reviewBtn = page.getByTestId("btn-review-attempt-65");
    await expect(reviewBtn).toBeVisible();

    // 5. Click "Kiểm tra" to open Attempt Detail Page
    await reviewBtn.click();
    await expect(page).toHaveURL(/.*\/exams\/70\/grading\/65/);

    // 6. Verify AI draft proposal is pre-loaded & banner is visible
    await expect(page.getByTestId("ai-draft-review-banner")).toBeVisible();
    const scoreInput = page.locator('input[type="number"]').first();
    await expect(scoreInput).toHaveValue("8.5");

    // 7. Teacher edits AI proposed score (from 8.5 to 9.25) and confirms official grade
    await scoreInput.fill("9.25");
    await page.getByTestId("btn-quick-confirm-ai-grade").click();

    // 8. Verify attempt transitions to CONFIRMED official state
    await expect(page.getByTestId("ai-confirmed-banner")).toBeVisible();
    await expect(page.locator("body")).toContainText("19.25");
  });
});
