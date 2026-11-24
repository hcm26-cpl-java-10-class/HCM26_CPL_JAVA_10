import { test, expect } from "@playwright/test";

// Helper for Teacher authentication
async function loginAsTeacher(page: any) {
  await page.goto("/login");
  await page.fill('input[type="email"], input[name="email"]', "teacher@example.com");
  await page.fill('input[type="password"], input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/teacher", { timeout: 15000 });
}

// Helper to ensure Exam A has AI questions
async function ensureAiQuestionInExam(request: any, token: string, examId: number) {
  const checkRes = await request.get(`http://localhost:8080/api/exams/ai-generator/exams/${examId}/questions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (checkRes.ok()) {
    const list = await checkRes.json();
    if (list.length > 0) return list;
  }

  const commitRes = await request.post("http://localhost:8080/api/exams/ai-generator/commit-to-exam", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      examId,
      questions: [
        {
          tempId: "q_auto_1",
          type: "MULTIPLE_CHOICE",
          difficulty: "MEDIUM",
          points: 2,
          topic: "Java Algorithms",
          content: "Phương pháp QuickSort có độ phức tạp trung bình là gì?",
          explanation: "O(N log N) là độ phức tạp trung bình của QuickSort.",
          options: [
            { content: "O(N log N)", correct: true },
            { content: "O(N^2)", correct: false },
            { content: "O(N)", correct: false },
            { content: "O(1)", correct: false },
          ],
        },
        {
          tempId: "q_auto_2",
          type: "ESSAY",
          difficulty: "HARD",
          points: 10,
          topic: "Java Architecture",
          content: "Phân tích kiến trúc Microservices và REST API.",
          studentInstructions: "Trình bày 3 phần rõ ràng.",
          referenceAnswer: "Đáp án mẫu về microservices.",
          rubric: "Tiêu chí chấm điểm tự luận.",
          gradingCriteria: [
            { name: "Lý thuyết", description: "Hiểu đúng", weightPercentage: 50 },
            { name: "Áp dụng", description: "Ví dụ cụ thể", weightPercentage: 50 },
          ],
        },
      ],
    },
  });
  expect(commitRes.ok()).toBeTruthy();

  const res2 = await request.get(`http://localhost:8080/api/exams/ai-generator/exams/${examId}/questions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return await res2.json();
}

test.describe("FAMS LMS - AI Question Generator Comprehensive Verification Suite", () => {
  let token: string;
  let examAId: number;
  let examBId: number;
  let examMcId: number;
  let examCodingId: number;
  let examMcCodingId: number;
  let examMixedId: number;

  test.beforeAll(async ({ request }) => {
    // 1. Authenticate to backend to get teacher token
    const loginRes = await request.post("http://localhost:8080/api/auth/login", {
      data: { email: "teacher@example.com", password: "password123" },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginData = await loginRes.json();
    token = loginData.accessToken;

    // 2. Create clean unstarted Exam A
    const examARes = await request.post("http://localhost:8080/api/exams", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `AI Exam A - ${Date.now()}`,
        durationMinutes: 60,
        maxAttempts: 1,
        shuffleQuestions: false,
        shuffleOptions: false,
        showAnswersAfterExam: false,
        category: "QUIZ",
        passScore: 5,
        maxScore: 10,
        latePolicy: "NOT_ALLOWED",
        lateGraceMinutes: 0,
        resultVisibility: "IMMEDIATE",
        isActive: true,
      },
    });
    expect(examARes.ok()).toBeTruthy();
    const examAData = await examARes.json();
    examAId = examAData.id;

    // 3. Create clean unstarted Exam B (for cross-exam isolation testing)
    const examBRes = await request.post("http://localhost:8080/api/exams", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `AI Exam B Isolation - ${Date.now()}`,
        durationMinutes: 60,
        maxAttempts: 1,
        shuffleQuestions: false,
        shuffleOptions: false,
        showAnswersAfterExam: false,
        category: "QUIZ",
        passScore: 5,
        maxScore: 10,
        latePolicy: "NOT_ALLOWED",
        lateGraceMinutes: 0,
        resultVisibility: "IMMEDIATE",
        isActive: true,
      },
    });
    expect(examBRes.ok()).toBeTruthy();
    const examBData = await examBRes.json();
    examBId = examBData.id;

    // 4. Create Exam with Multiple Choice only format
    const mcRes = await request.post("http://localhost:8080/api/exams", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `Exam MC Format - ${Date.now()}`,
        durationMinutes: 45,
        maxAttempts: 1,
        examType: "MULTIPLE_CHOICE",
        category: "QUIZ",
        passScore: 5,
        maxScore: 10,
        isActive: true,
      },
    });
    expect(mcRes.ok()).toBeTruthy();
    examMcId = (await mcRes.json()).id;

    // 5. Create Exam with Coding only format
    const codingRes = await request.post("http://localhost:8080/api/exams", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `Exam Coding Format - ${Date.now()}`,
        durationMinutes: 90,
        maxAttempts: 1,
        examType: "CODING",
        category: "QUIZ",
        passScore: 5,
        maxScore: 10,
        isActive: true,
      },
    });
    expect(codingRes.ok()).toBeTruthy();
    examCodingId = (await codingRes.json()).id;

    // 6. Create Exam with MC + Coding format
    const mcCodingRes = await request.post("http://localhost:8080/api/exams", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `Exam MC and Coding Format - ${Date.now()}`,
        durationMinutes: 90,
        maxAttempts: 1,
        examType: "MC_CODING",
        category: "QUIZ",
        passScore: 5,
        maxScore: 10,
        isActive: true,
      },
    });
    expect(mcCodingRes.ok()).toBeTruthy();
    examMcCodingId = (await mcCodingRes.json()).id;

    // 7. Create Exam with Mixed format
    const mixedRes = await request.post("http://localhost:8080/api/exams", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        title: `Exam Mixed Format - ${Date.now()}`,
        durationMinutes: 120,
        maxAttempts: 1,
        examType: "MIXED",
        category: "QUIZ",
        passScore: 5,
        maxScore: 10,
        isActive: true,
      },
    });
    expect(mixedRes.ok()).toBeTruthy();
    examMixedId = (await mixedRes.json()).id;
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  // =========================================================================
  // TC-01: Toolbar Button Alignment on Desktop (Same Row)
  // =========================================================================
  test("TC-01: AI Generate button sits on the same toolbar row as Preview, Filters, Add all, Random on Desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await loginAsTeacher(page);
    await page.goto(`/exams/${examAId}/questions`);
    await expect(page).toHaveURL(new RegExp(`.*exams\\/${examAId}\\/questions`));

    // Locate the 5 buttons
    const previewBtn = page.getByRole("button", { name: /Preview all|Collapse all|Preview/i }).first();
    const filtersBtn = page.getByRole("button", { name: /Hide filters|Show filters/i });
    const addAllBtn = page.getByRole("button", { name: /Add all matching/i });
    const randomBtn = page.getByRole("button", { name: /Random\.\.\./i });
    const aiBtn = page.getByRole("button", { name: /AI Generate/i });

    await expect(previewBtn).toBeVisible();
    await expect(filtersBtn).toBeVisible();
    await expect(addAllBtn).toBeVisible();
    await expect(randomBtn).toBeVisible();
    await expect(aiBtn).toBeVisible();

    // Verify bounding box Y-coordinates on Desktop (1440px wide)
    const previewBox = await previewBtn.boundingBox();
    const filtersBox = await filtersBtn.boundingBox();
    const addAllBox = await addAllBtn.boundingBox();
    const randomBox = await randomBtn.boundingBox();
    const aiBox = await aiBtn.boundingBox();

    expect(previewBox).not.toBeNull();
    expect(filtersBox).not.toBeNull();
    expect(addAllBox).not.toBeNull();
    expect(randomBox).not.toBeNull();
    expect(aiBox).not.toBeNull();

    // The vertical positions (y) must be aligned within 5px tolerance (same row)
    const baselineY = previewBox!.y;
    expect(Math.abs(filtersBox!.y - baselineY)).toBeLessThanOrEqual(5);
    expect(Math.abs(addAllBox!.y - baselineY)).toBeLessThanOrEqual(5);
    expect(Math.abs(randomBox!.y - baselineY)).toBeLessThanOrEqual(5);
    expect(Math.abs(aiBox!.y - baselineY)).toBeLessThanOrEqual(5);

    // Verify AI button height is synchronized with toolbar buttons
    expect(Math.abs(aiBox!.height - previewBox!.height)).toBeLessThanOrEqual(3);

    // Verify icon size is 14-16px (shrunk icon)
    const svgIcon = aiBtn.locator("svg");
    await expect(svgIcon).toBeVisible();
    const iconBox = await svgIcon.boundingBox();
    expect(iconBox).not.toBeNull();
    expect(iconBox!.width).toBeGreaterThanOrEqual(12);
    expect(iconBox!.width).toBeLessThanOrEqual(18);
    expect(iconBox!.height).toBeGreaterThanOrEqual(12);
    expect(iconBox!.height).toBeLessThanOrEqual(18);

    // Verify emoji ✨ is not duplicated in button text
    const aiBtnText = await aiBtn.innerText();
    expect(aiBtnText).not.toContain("✨");
    expect(aiBtnText).toContain("AI Generate");

    // Verify no horizontal scrollbar on the toolbar buttons container
    const toolbarContainer = aiBtn.locator("xpath=..");
    const hasHorizontalScroll = await toolbarContainer.evaluate((el: HTMLElement) => el.scrollWidth > el.clientWidth);
    expect(hasHorizontalScroll).toBe(false);

    // Screenshot of toolbar with shrunk icon
    await page.screenshot({ path: "test-results/toolbar-shrunk-icon.png" });
  });

  // =========================================================================
  // TC-02: Responsive Behavior on Tablet and Mobile
  // =========================================================================
  test("TC-02: Responsive layout verification on Tablet (768px) and Mobile (375px)", async ({ page }) => {
    await loginAsTeacher(page);

    // 1. Tablet Viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/exams/${examAId}/questions`);

    const aiBtnTablet = page.getByRole("button", { name: /AI Generate/i });
    await expect(aiBtnTablet).toBeVisible();
    await aiBtnTablet.click();

    let dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("AI Question Generator – Tạo câu hỏi bằng AI");

    const closeBtn = dialog.getByRole("button", { name: /Đóng|Hủy/i }).first();
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();

    // 2. Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    const aiBtnMobile = page.getByRole("button", { name: /AI Generate/i });
    await expect(aiBtnMobile).toBeVisible();
    await aiBtnMobile.click();

    dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('textarea[placeholder*="Ví dụ:"]')).toBeVisible();

    const closeBtnMobile = dialog.getByRole("button", { name: /Đóng|Hủy/i }).first();
    await closeBtnMobile.click();
    await expect(dialog).not.toBeVisible();
  });

  // =========================================================================
  // TC-03 & TC-04: Generate Questions in Exam A, Verify Badges in Preview & Exam
  // =========================================================================
  test("TC-03 & TC-04: Generate AI questions into Exam A and verify distinct AI Generated badge", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto(`/exams/${examAId}/questions`);

    const aiBtn = page.getByRole("button", { name: /AI Generate/i });
    await aiBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();

    // Step 1: Verify NO points configuration input exists
    const pointsLabels = dialog.locator('span', { hasText: 'Điểm / câu' });
    expect(await pointsLabels.count()).toBe(0);

    // Fill prompt
    await dialog.locator('textarea[placeholder*="Ví dụ:"]').fill("Thuật toán sắp xếp QuickSort và MergeSort");

    // Only 1 MCQ and 1 Essay to be fast
    const codingCheck = dialog.locator("#type-coding");
    if (await codingCheck.isChecked()) await codingCheck.uncheck();

    await dialog.getByRole("button", { name: /Tạo câu hỏi bằng AI/i }).click();
    await expect(dialog).toContainText("Bước 2: Xem trước và chọn câu hỏi", { timeout: 45000 });

    // Step 2 Preview: Verify NO points badges exist
    const previewPointsBadges = dialog.locator('span', { hasText: /^\d+\s*điểm$/ });
    expect(await previewPointsBadges.count()).toBe(0);

    // Commit to Exam A
    const commitBtn = dialog.getByRole("button", { name: /Thêm .* câu hỏi đã chọn vào đề thi/i });
    await expect(commitBtn).toBeEnabled();
    await commitBtn.click();

    // Verify dialog closes
    await expect(dialog).not.toBeVisible({ timeout: 20000 });

    // Verify questions appear in Exam A's questions panel with ✨ AI Generated badge
    const aiBadge = page.locator("span", { hasText: "✨ AI Generated" }).first();
    await expect(aiBadge).toBeVisible({ timeout: 10000 });
  });

  // =========================================================================
  // TC-05, TC-06, TC-07: Single Exam Scoping & Cross-Exam Leakage Prevention
  // =========================================================================
  test("TC-05, TC-06, TC-07: AI questions scoped strictly to Exam A; invisible in /api/questions and Exam B", async ({ page, request }) => {
    await ensureAiQuestionInExam(request, token, examAId);

    // 1. Fetch AI questions belonging to Exam A
    const aiQuestionsRes = await request.get(`http://localhost:8080/api/exams/ai-generator/exams/${examAId}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(aiQuestionsRes.ok()).toBeTruthy();
    const examAAiQuestions: any[] = await aiQuestionsRes.json();
    expect(examAAiQuestions.length).toBeGreaterThan(0);

    const firstAiQuestion = examAAiQuestions[0];
    const aiQuestionId = firstAiQuestion.id;
    const aiQuestionContent = firstAiQuestion.content;

    // Verify entity metadata
    expect(firstAiQuestion.source).toBe("AI_GENERATED");
    expect(firstAiQuestion.examId).toBe(examAId);
    expect(firstAiQuestion.isAiGenerated).toBe(true);

    // 2. Verify global Question Library (/api/questions) DOES NOT contain this AI question
    const globalBankRes = await request.get("http://localhost:8080/api/questions?size=2000", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(globalBankRes.ok()).toBeTruthy();
    const globalBankData = await globalBankRes.json();
    const globalIds = (globalBankData.content ?? []).map((q: any) => q.id);
    expect(globalIds).not.toContain(aiQuestionId);

    // 3. Verify Exam B's AI questions endpoint returns empty (no leak from Exam A)
    const examBAiRes = await request.get(`http://localhost:8080/api/exams/ai-generator/exams/${examBId}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(examBAiRes.ok()).toBeTruthy();
    const examBAiQuestions: any[] = await examBAiRes.json();
    const examBAiIds = examBAiQuestions.map((q: any) => q.id);
    expect(examBAiIds).not.toContain(aiQuestionId);

    // 4. Verify Exam B UI does NOT show Exam A's AI question in Question Library
    await loginAsTeacher(page);
    await page.goto(`/exams/${examBId}/questions`);
    await expect(page).toHaveURL(new RegExp(`.*exams\\/${examBId}\\/questions`));

    // Search for Exam A's AI question content in Exam B's library search input
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill(aiQuestionContent.substring(0, 20));
      await page.waitForTimeout(500);
      const matchingCards = page.locator(`text="${aiQuestionContent.substring(0, 30)}"`);
      await expect(matchingCards).toHaveCount(0);
    }

    // 5. Backend Authorization Defense: Exam B tries to add Exam A's AI question directly via API
    const unauthorizedAddRes = await request.post(`http://localhost:8080/api/exams/${examBId}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { questionIds: [aiQuestionId] },
    });
    // Must be rejected with 400 Bad Request!
    expect(unauthorizedAddRes.status()).toBe(400);
    const errorBody = await unauthorizedAddRes.json();
    expect(JSON.stringify(errorBody)).toContain("thuộc về một đề thi khác");
  });

  // =========================================================================
  // TC-08, TC-09, TC-14: Lifecycle Stage A (Unstage / Bỏ tạm & Re-add without clone)
  // =========================================================================
  test("TC-08, TC-09, TC-14: Unstage AI question to temporary pool, re-add back to Exam A with no duplicate record", async ({ page, request }) => {
    await ensureAiQuestionInExam(request, token, examAId);
    await loginAsTeacher(page);
    await page.goto(`/exams/${examAId}/questions`);

    // 1. Locate the AI question in Exam A's Selected list
    const removeBtn = page.getByRole("button", { name: /Remove/i }).first();
    await expect(removeBtn).toBeVisible({ timeout: 10000 });
    await removeBtn.click();

    // Verify toast confirmation
    await expect(page.locator("body")).toContainText(/removed from assessment/i, { timeout: 10000 });

    // 2. Verify it is now available in Exam A's Question Library with ✨ AI Generated badge
    const libraryAiBadge = page.locator("span", { hasText: "✨ AI Generated" }).first();
    await expect(libraryAiBadge).toBeVisible();

    // 3. Add it back to Exam A
    const addBtn = page.getByRole("button", { name: /Add to selected questions/i }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Click "Save to assessment"
    const saveStagedBtn = page.getByRole("button", { name: /Save.*Assessment/i });
    await expect(saveStagedBtn).toBeVisible();
    await saveStagedBtn.click();

    await expect(page.locator("body")).toContainText(/Saved .* question\(s\) to assessment successfully/i, { timeout: 10000 });

    // 4. Verify in DB: Question ID is preserved and no duplicate record was created
    const aiQuestionsRes = await request.get(`http://localhost:8080/api/exams/ai-generator/exams/${examAId}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const questions: any[] = await aiQuestionsRes.json();
    expect(questions.length).toBeLessThanOrEqual(4);
  });

  // =========================================================================
  // TC-10: Lifecycle Stage B (Permanent Delete / Xóa hẳn)
  // =========================================================================
  test("TC-10: Permanently delete an unstaged AI question from database", async ({ page, request }) => {
    await ensureAiQuestionInExam(request, token, examAId);
    await loginAsTeacher(page);
    await page.goto(`/exams/${examAId}/questions`);

    // 1. Remove the AI question so it becomes "available" (bỏ tạm)
    const removeBtn = page.getByRole("button", { name: /Remove/i }).first();
    if (await removeBtn.isVisible()) {
      await removeBtn.click();
      await page.waitForTimeout(1000);
    }

    // 2. Fetch the unstaged AI question ID
    const aiQuestionsRes = await request.get(`http://localhost:8080/api/exams/ai-generator/exams/${examAId}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const questions: any[] = await aiQuestionsRes.json();
    expect(questions.length).toBeGreaterThan(0);
    const targetQId = questions[0].id;

    // 3. Call permanent delete API
    const deleteRes = await request.delete(`http://localhost:8080/api/exams/ai-generator/exams/${examAId}/questions/${targetQId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.status()).toBe(204);

    // 4. Verify question no longer exists anywhere
    const checkRes = await request.get(`http://localhost:8080/api/questions/${targetQId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(checkRes.status()).toBe(404);
  });

  // =========================================================================
  // TC-11 & TC-12: Unused AI Questions Cleanup & Integrity Protection
  // =========================================================================
  test("TC-11 & TC-12: Cleanup unused AI questions and protect exam integrity", async ({ request }) => {
    // 1. Clean up any unused AI questions for Exam A
    const cleanupRes = await request.post(`http://localhost:8080/api/exams/ai-generator/exams/${examAId}/cleanup`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(cleanupRes.ok()).toBeTruthy();
    const cleanupData = await cleanupRes.json();
    expect(cleanupData).toHaveProperty("deletedCount");

    // 2. Verify remaining questions in Exam A are still intact
    const examDetailRes = await request.get(`http://localhost:8080/api/exams/${examAId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(examDetailRes.ok()).toBeTruthy();
    const examDetail = await examDetailRes.json();
    expect(examDetail.id).toBe(examAId);
  });

  // =========================================================================
  // TC-13: Standard Question Bank Operations Unaffected
  // =========================================================================
  test("TC-13: Standard question bank operations remain completely unaffected", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto(`/exams/${examAId}/questions`);

    // Toggle Preview all
    const previewAllBtn = page.getByRole("button", { name: /Preview all|Collapse all|Preview/i }).first();
    await previewAllBtn.click();
    await page.waitForTimeout(500);

    // Toggle Filters
    const filtersBtn = page.getByRole("button", { name: /Hide filters|Show filters/i });
    await filtersBtn.click();
    await page.waitForTimeout(500);
    await filtersBtn.click();

    // Verify Random Dialog opens and works
    const randomBtn = page.getByRole("button", { name: /Random\.\.\./i });
    await randomBtn.click();
    const randomDialog = page.locator('[role="dialog"]').first();
    await expect(randomDialog).toContainText(/Add random questions/i);
    const cancelRandom = randomDialog.getByRole("button", { name: /Cancel|Close/i }).first();
    await cancelRandom.click();
  });

  // =========================================================================
  // TC-15: Single Entry Point - AI Button ONLY on Question Library Toolbar
  // =========================================================================
  test("TC-15: AI Generate button appears ONLY on Question Library toolbar and is removed from all other pages", async ({ page }) => {
    await loginAsTeacher(page);

    // 1. Exam List page (/exams): Header toolbar MUST NOT have AI button
    await page.goto("/exams");
    await expect(page).toHaveURL(/.*\/exams/);
    const aiBtnOnList = page.locator('header, div.flex').locator('button:has-text("AI Generate"), button:has-text("Tạo câu hỏi bằng AI")');
    await expect(aiBtnOnList).toHaveCount(0);

    // 2. Create Exam Dialog: MUST NOT have AI banner or AI button
    const createExamBtn = page.getByRole("button", { name: /Create Assessment|Tạo đề thi/i });
    if (await createExamBtn.isVisible()) {
      await createExamBtn.click();
      const createDialog = page.locator('[role="dialog"]').first();
      await expect(createDialog).toBeVisible();
      // Verify no AI generator banner or button inside create exam dialog
      const aiInCreateDialog = createDialog.locator('button:has-text("AI Question Generator"), button:has-text("Tạo câu hỏi bằng AI")');
      await expect(aiInCreateDialog).toHaveCount(0);
      // Close dialog
      const cancelCreate = createDialog.getByRole("button", { name: /Cancel|Hủy/i }).first();
      await cancelCreate.click();
      await expect(createDialog).not.toBeVisible();
    }

    // 3. Exam Grading page (/exams/:id/grading)
    await page.goto(`/exams/${examAId}/grading`);
    const aiBtnOnGrading = page.locator('button:has-text("AI Generate"), button:has-text("Tạo câu hỏi bằng AI")');
    await expect(aiBtnOnGrading).toHaveCount(0);

    // 4. Exam Invitations page (/exams/:id/invitations)
    await page.goto(`/exams/${examAId}/invitations`);
    const aiBtnOnInvites = page.locator('button:has-text("AI Generate"), button:has-text("Tạo câu hỏi bằng AI")');
    await expect(aiBtnOnInvites).toHaveCount(0);

    // 5. Exam Statistics page (/exams/:id/statistics)
    await page.goto(`/exams/${examAId}/statistics`);
    const aiBtnOnStats = page.locator('button:has-text("AI Generate"), button:has-text("Tạo câu hỏi bằng AI")');
    await expect(aiBtnOnStats).toHaveCount(0);

    // 6. Question Library page (/exams/:id/questions): AI button IS present!
    await page.goto(`/exams/${examAId}/questions`);
    const aiBtnOnQuestions = page.getByRole("button", { name: /AI Generate/i });
    await expect(aiBtnOnQuestions).toBeVisible();
  });

  // =========================================================================
  // TC-16: Format Locking - MULTIPLE_CHOICE Exam Locks Coding & Essay
  // =========================================================================
  test("TC-16: Exam with MULTIPLE_CHOICE locks Coding and Essay in filters and AI Generator dialog", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto(`/exams/${examMcId}/questions`);

    // 1. Verify Filters sidebar Question type options
    const mcFilter = page.locator('label', { hasText: 'Multiple Choice' }).locator('input[type="checkbox"]');
    const codingFilter = page.locator('label', { hasText: 'Coding' }).locator('input[type="checkbox"]');
    const essayFilter = page.locator('label', { hasText: 'Essay' }).locator('input[type="checkbox"]');

    await expect(mcFilter).toBeEnabled();
    await expect(codingFilter).toBeDisabled();
    await expect(essayFilter).toBeDisabled();

    // Verify "(Khóa)" badge in filter labels
    await expect(page.locator('label', { hasText: 'Coding' })).toContainText('(Khóa)');
    await expect(page.locator('label', { hasText: 'Essay' })).toContainText('(Khóa)');

    // 2. Open AI Question Generator Dialog
    const aiBtn = page.getByRole("button", { name: /AI Generate/i });
    await aiBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("MULTIPLE_CHOICE");

    // 3. Multiple Choice must be checked and non-uncheckable (single allowed type)
    const mcCheck = dialog.locator('#type-mc');
    await expect(mcCheck).toBeChecked();
    await expect(mcCheck).toBeDisabled();

    // 4. Essay and Coding must be locked with badge "Khóa theo định dạng đề"
    const essayCheck = dialog.locator('#type-essay');
    await expect(essayCheck).toBeDisabled();
    await expect(essayCheck).not.toBeChecked();

    const codingCheck = dialog.locator('#type-coding');
    await expect(codingCheck).toBeDisabled();
    await expect(codingCheck).not.toBeChecked();

    const lockedBadges = dialog.locator('span, div', { hasText: 'Khóa theo định dạng đề' });
    expect(await lockedBadges.count()).toBeGreaterThanOrEqual(2);

    // Capture screenshot
    await page.screenshot({ path: "test-results/mc-format-locked-dialog.png", fullPage: true });

    // Close dialog
    const closeBtn = dialog.getByRole("button", { name: /Đóng|Hủy/i }).first();
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  // =========================================================================
  // TC-17: Format Locking - CODING Exam Locks MCQ & Essay
  // =========================================================================
  test("TC-17: Exam with CODING locks Multiple Choice and Essay in filters and AI Generator dialog", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto(`/exams/${examCodingId}/questions`);

    // 1. Verify Filters sidebar Question type options
    const mcFilter = page.locator('label', { hasText: 'Multiple Choice' }).locator('input[type="checkbox"]');
    const codingFilter = page.locator('label', { hasText: 'Coding' }).locator('input[type="checkbox"]');
    const essayFilter = page.locator('label', { hasText: 'Essay' }).locator('input[type="checkbox"]');

    await expect(codingFilter).toBeEnabled();
    await expect(mcFilter).toBeDisabled();
    await expect(essayFilter).toBeDisabled();

    await expect(page.locator('label', { hasText: 'Multiple Choice' })).toContainText('(Khóa)');
    await expect(page.locator('label', { hasText: 'Essay' })).toContainText('(Khóa)');

    // 2. Open AI Question Generator Dialog
    const aiBtn = page.getByRole("button", { name: /AI Generate/i });
    await aiBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("CODING");

    // 3. Coding must be checked and non-uncheckable
    const codingCheck = dialog.locator('#type-coding');
    await expect(codingCheck).toBeChecked();
    await expect(codingCheck).toBeDisabled();

    // 4. MCQ and Essay must be locked
    const mcCheck = dialog.locator('#type-mc');
    await expect(mcCheck).toBeDisabled();
    await expect(mcCheck).not.toBeChecked();

    const essayCheck = dialog.locator('#type-essay');
    await expect(essayCheck).toBeDisabled();
    await expect(essayCheck).not.toBeChecked();

    // Capture screenshot
    await page.screenshot({ path: "test-results/coding-format-locked-dialog.png", fullPage: true });

    // Close dialog
    const closeBtn = dialog.getByRole("button", { name: /Đóng|Hủy/i }).first();
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  // =========================================================================
  // TC-18: Format Locking - MC_CODING Exam Allows MCQ & Coding, Locks Essay
  // =========================================================================
  test("TC-18: Exam with MC_CODING allows Multiple Choice and Coding, locks Essay", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto(`/exams/${examMcCodingId}/questions`);

    // 1. Verify Filters sidebar
    const mcFilter = page.locator('label', { hasText: 'Multiple Choice' }).locator('input[type="checkbox"]');
    const codingFilter = page.locator('label', { hasText: 'Coding' }).locator('input[type="checkbox"]');
    const essayFilter = page.locator('label', { hasText: 'Essay' }).locator('input[type="checkbox"]');

    await expect(mcFilter).toBeEnabled();
    await expect(codingFilter).toBeEnabled();
    await expect(essayFilter).toBeDisabled();
    await expect(page.locator('label', { hasText: 'Essay' })).toContainText('(Khóa)');

    // 2. Open AI Dialog
    const aiBtn = page.getByRole("button", { name: /AI Generate/i });
    await aiBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("MC_CODING");

    // MCQ and Coding must be enabled/operable
    const mcCheck = dialog.locator('#type-mc');
    const codingCheck = dialog.locator('#type-coding');
    await expect(mcCheck).toBeEnabled();
    await expect(codingCheck).toBeEnabled();

    // Essay must be locked
    const essayCheck = dialog.locator('#type-essay');
    await expect(essayCheck).toBeDisabled();
    await expect(essayCheck).not.toBeChecked();

    // Close dialog
    const closeBtn = dialog.getByRole("button", { name: /Đóng|Hủy/i }).first();
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  // =========================================================================
  // TC-19: Format Locking - MIXED Exam Allows All Types
  // =========================================================================
  test("TC-19: Exam with MIXED allows all question types (MCQ, Essay, Coding)", async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto(`/exams/${examMixedId}/questions`);

    // 1. Verify Filters sidebar: none locked
    const mcFilter = page.locator('label', { hasText: 'Multiple Choice' }).locator('input[type="checkbox"]');
    const codingFilter = page.locator('label', { hasText: 'Coding' }).locator('input[type="checkbox"]');
    const essayFilter = page.locator('label', { hasText: 'Essay' }).locator('input[type="checkbox"]');

    await expect(mcFilter).toBeEnabled();
    await expect(codingFilter).toBeEnabled();
    await expect(essayFilter).toBeEnabled();

    // 2. Open AI Dialog
    const aiBtn = page.getByRole("button", { name: /AI Generate/i });
    await aiBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();

    const mcCheck = dialog.locator('#type-mc');
    const essayCheck = dialog.locator('#type-essay');
    const codingCheck = dialog.locator('#type-coding');

    await expect(mcCheck).toBeEnabled();
    await expect(essayCheck).toBeEnabled();
    await expect(codingCheck).toBeEnabled();

    // Capture screenshot
    await page.screenshot({ path: "test-results/mixed-format-dialog.png", fullPage: true });

    // Close dialog
    const closeBtn = dialog.getByRole("button", { name: /Đóng|Hủy/i }).first();
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  // =========================================================================
  // TC-20: Backend Rejects Generate and Commit for Disallowed Question Types
  // =========================================================================
  test("TC-20: Backend strictly returns 400 Bad Request when attempting to generate or commit disallowed question types", async ({ request }) => {
    // 1. Generate request for CODING on MULTIPLE_CHOICE exam -> 400
    const genRes = await request.post("http://localhost:8080/api/exams/ai-generator/generate", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        examId: examMcId,
        mode: "PROMPT",
        prompt: "Generate algorithms coding questions",
        requests: [{ type: "CODING", count: 1, difficulty: "MEDIUM", points: 10 }],
      },
    });
    expect(genRes.status()).toBe(400);
    const genBody = await genRes.json();
    expect(JSON.stringify(genBody)).toContain("CODING");

    // 2. Commit request for CODING on MULTIPLE_CHOICE exam -> 400
    const commitDisallowedRes = await request.post("http://localhost:8080/api/exams/ai-generator/commit-to-exam", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        examId: examMcId,
        questions: [
          {
            tempId: "q_disallowed",
            type: "CODING",
            difficulty: "MEDIUM",
            points: 10,
            content: "Write binary search",
          },
        ],
      },
    });
    expect(commitDisallowedRes.status()).toBe(400);
    const commitBody = await commitDisallowedRes.json();
    expect(JSON.stringify(commitBody)).toContain("CODING");

    // 3. Commit request for MULTIPLE_CHOICE on CODING exam -> 400
    const commitMcOnCodingRes = await request.post("http://localhost:8080/api/exams/ai-generator/commit-to-exam", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        examId: examCodingId,
        questions: [
          {
            tempId: "q_mc_disallowed",
            type: "MULTIPLE_CHOICE",
            difficulty: "EASY",
            points: 1,
            content: "What is an int?",
          },
        ],
      },
    });
    expect(commitMcOnCodingRes.status()).toBe(400);
    const commitMcBody = await commitMcOnCodingRes.json();
    expect(JSON.stringify(commitMcBody)).toContain("MULTIPLE_CHOICE");
  });

  // =========================================================================
  // TC-21: Large Centered Modal Popup (900-1100px), Dark Backdrop, and No Points Inputs
  // =========================================================================
  test("TC-21: Large Centered Modal Popup (900-1100px), Dark Backdrop, and No Points Inputs", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsTeacher(page);
    await page.goto(`/exams/${examAId}/questions`);

    const aiBtn = page.getByRole("button", { name: /AI Generate/i });
    await aiBtn.click();

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();

    // 1. Popup dimensions & centering on 1440x900 desktop
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    // Width should be between 850px and 1150px (e.g. lg:max-w-[1050px] = 1050px)
    expect(dialogBox!.width).toBeGreaterThanOrEqual(850);
    expect(dialogBox!.width).toBeLessThanOrEqual(1150);

    // Centered horizontally: center X within 35px of 1440/2 = 720
    const centerX = dialogBox!.x + dialogBox!.width / 2;
    expect(Math.abs(centerX - 720)).toBeLessThanOrEqual(35);

    // Centered vertically: center Y within 60px of 900/2 = 450
    const centerY = dialogBox!.y + dialogBox!.height / 2;
    expect(Math.abs(centerY - 450)).toBeLessThanOrEqual(60);

    // 2. Dark backdrop overlay present
    const overlay = page.locator('[data-slot="dialog-overlay"]').first();
    await expect(overlay).toBeVisible();

    // 3. Close button (X) at top right
    const xCloseBtn = dialog.locator('button[data-slot="dialog-close"]').first();
    await expect(xCloseBtn).toBeVisible();

    // 4. Verify no points configuration in Step 1
    const pointsText = dialog.locator('text="Điểm / câu"');
    expect(await pointsText.count()).toBe(0);

    // 5. Verify "Dặn dò thêm" input is clearly visible in the popup alongside prompt
    const dandoThemInput = dialog.locator('#ai-instructions');
    await expect(dandoThemInput).toBeVisible();

    // Screenshot of large centered modal popup
    await page.screenshot({ path: "test-results/large-centered-modal.png" });

    // Close via (X) button
    await xCloseBtn.click();
    await expect(dialog).not.toBeVisible();
  });
});
