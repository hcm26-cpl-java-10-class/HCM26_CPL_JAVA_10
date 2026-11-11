import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { utils, write } from "xlsx";
import { fakeHttp, type RecordedCall } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderRoutes } from "@/test/render";
import TopicMarkGradebookDemoPage from "./index";

vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));

function renderGradebook(route = "/topic-marks?classId=2&classCode=HCM26_FR_JAVA_03") {
  return renderRoutes(
    [
      { path: "/topic-marks", element: <TopicMarkGradebookDemoPage /> },
      { path: "/classes/:classId", element: <div>Class Detail View</div> },
    ],
    { route },
  );
}

const SAMPLE_GRADEBOOK_RESPONSE = {
  columns: [
    { key: "quiz2", label: "Quiz 2" },
    { key: "quiz1", label: "Quiz 1" },
    { key: "assignment", label: "Assignment" },
    { key: "attendance", label: "Attendance" },
    { key: "project", label: "Project" },
    { key: "practice", label: "Practice" },
    { key: "bonus", label: "Bonus" },
    { key: "final", label: "Final" },
    { key: "midterm", label: "Midterm" },
    { key: "FINAL_SCORE", label: "Final Score" },
    { key: "IS_PASSED", label: "Is Passed" },
  ],
  rows: {
    content: [
      {
        userId: "stu-101",
        fullName: "Hoàng Phương Bình",
        email: "phuongbinh.conan@gmail.com",
        values: {
          attendance: 10.0,
          quiz1: 8.0,
          quiz2: 8.5,
          assignment: 9.0,
          practice: 8.5,
          project: 9.0,
          midterm: 8.0,
          final: 8.5,
          bonus: 1.0,
          FINAL_SCORE: 7.83,
          IS_PASSED: true,
        },
      },
      {
        userId: "stu-102",
        fullName: "Trần Việt Anh",
        email: "anhviettran357@gmail.com",
        values: {
          attendance: 5.0,
          quiz1: 4.0,
          quiz2: 4.5,
          assignment: 4.0,
          practice: 4.5,
          project: 4.0,
          midterm: 3.5,
          final: 4.0,
          bonus: 0.0,
          FINAL_SCORE: 4.17,
          IS_PASSED: false,
        },
      },
    ],
    page: 0,
    size: 10,
    totalElements: 2,
    totalPages: 1,
  },
};

describe("TopicMarkGradebookDemoPage UI/UX Upgrade", () => {
  beforeEach(() => {
    fakeHttp.reset();
    grant("STUDENT_SCORE_READ");
    fakeHttp.on("get", "/topic-marks/gradebook/search", (_call: RecordedCall) => {
      return SAMPLE_GRADEBOOK_RESPONSE;
    });
  });

  it("renders sticky # and Student columns and chronological assessment columns", async () => {
    renderGradebook();

    expect(
      await screen.findByRole("heading", { name: "Topic Marks : HCM26_FR_JAVA_03" }),
    ).toBeInTheDocument();

    // 1. Header badge displays total trainees (e.g. 2 Trainees), not duplicate classCode
    expect(await screen.findByText("2 Trainees")).toBeInTheDocument();
    await screen.findByText("Hoàng Phương Bình");

    // 2. Action toolbar buttons (Export & Import)
    expect(screen.getByRole("button", { name: /export excel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /import scores/i })).toBeInTheDocument();

    // 3. Chronological column order check:
    // Attendance -> Quiz 1 -> Quiz 2 -> Assignment -> Practice -> Project -> Midterm -> Final -> Bonus -> Final Score -> Status
    const headers = screen.getAllByRole("columnheader").map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      "#",
      "Student",
      "Attendance",
      "Quiz 1",
      "Quiz 2",
      "Assignment",
      "Practice",
      "Project",
      "Midterm",
      "Final",
      "Bonus",
      "Final Score",
      "Status",
    ]);

    // 4. Auto-calculated Status pill badges (no toggle switch)
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    const passedBadges = screen.getAllByText("Passed");
    const failedBadges = screen.getAllByText("Failed");
    expect(passedBadges.length).toBeGreaterThanOrEqual(1);
    expect(failedBadges.length).toBeGreaterThanOrEqual(1);

    // 5. Back to Class Detail navigation link
    const backLink = screen.getByRole("link", { name: /back to class detail/i });
    expect(backLink).toHaveAttribute("href", "/classes/2?tab=trainees");
  });

  it("supports inline score editing with real-time Final Score recalculation and Save Changes", async () => {
    const user = userEvent.setup();
    renderGradebook();

    await screen.findByText("Hoàng Phương Bình");

    // Click on a score cell (e.g. Quiz 1 for Trần Việt Anh currently at 4.0)
    const anhRow = screen.getByText("Trần Việt Anh").closest("tr")!;
    expect(within(anhRow).getByText("Failed")).toBeInTheDocument();

    // Find the Quiz 1 cell in this row (column index 3: # is 0, Student is 1, Attendance is 2, Quiz 1 is 3)
    const cells = within(anhRow).getAllByRole("cell");
    const quiz1Cell = cells[3]; // Quiz 1
    expect(quiz1Cell).toHaveTextContent("4.0");

    // Click to start inline edit
    await user.click(quiz1Cell);

    // Input appears
    const input = within(quiz1Cell).getByRole("spinbutton") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("4");

    // Update to 10 and press Enter
    fireEvent.change(input, { target: { value: "10" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Cell is now modified (amber styling) and value is 10.0
    expect(quiz1Cell).toHaveTextContent("10.0");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument();

    // Discard restores original baseline
    await user.click(screen.getByRole("button", { name: /discard/i }));
    expect(quiz1Cell).toHaveTextContent("4.0");
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
  });

  it("strictly validates imported files and triggers All-or-Nothing rollback with error modal when errors exist", async () => {
    const user = userEvent.setup();
    renderGradebook();

    await screen.findByText("Hoàng Phương Bình");

    // Create an invalid spreadsheet with multiple validation errors:
    // 1. Row 2 (Hoàng Phương Bình): Quiz 1 is empty (''), Final is -2.5 (out of range)
    // 2. Row 3 (Trần Việt Anh): Assignment is 'invalid_score' (non-numeric)
    // 3. Row 4 (Unknown Student): not in class
    const invalidData = [
      [
        "Student",
        "Email",
        "Attendance",
        "Quiz 1",
        "Quiz 2",
        "Assignment",
        "Practice",
        "Project",
        "Midterm",
        "Final",
        "Bonus",
      ],
      [
        "Hoàng Phương Bình",
        "phuongbinh.conan@gmail.com",
        "10",
        "", // Error: empty score
        "8",
        "9",
        "8.5",
        "9",
        "8",
        "-2.5", // Error: out of range < 0
        "1",
      ],
      [
        "Trần Việt Anh",
        "anhviettran357@gmail.com",
        "5",
        "4",
        "4.5",
        "invalid_score", // Error: not a valid number
        "4.5",
        "4",
        "3.5",
        "4",
        "0",
      ],
      [
        "Unknown Student",
        "unknown@gmail.com",
        "10",
        "10",
        "10",
        "10",
        "10",
        "10",
        "10",
        "10",
        "0",
      ],
    ];

    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet(invalidData);
    utils.book_append_sheet(wb, ws, "Sheet1");
    const arrayBuffer = write(wb, { type: "array", bookType: "xlsx" });
    const invalidFile = new File([arrayBuffer], "invalid_scores.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    await user.upload(fileInput, invalidFile);

    // 1. Error Dialog Modal should appear
    expect(await screen.findByRole("heading", { name: "Import Validation Failed" })).toBeInTheDocument();
    expect(screen.getByText(/All-or-Nothing/i)).toBeInTheDocument();

    // 2. Exact error messages should be displayed
    expect(screen.getByText(/Column 'Quiz 1': Score cannot be empty/i)).toBeInTheDocument();
    expect(screen.getByText(/Column 'Final': Score -2.5 must be between 0 and 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Column 'Assignment': Score 'invalid_score' is not a valid number/i)).toBeInTheDocument();
    expect(screen.getByText(/does not exist in the current class's Trainee List/i)).toBeInTheDocument();

    // 3. All-or-Nothing Rollback: Baseline table scores remain 100% UNCHANGED
    // Close the error modal first
    const closeButtons = screen.getAllByRole("button", { name: "Close" });
    await user.click(closeButtons[0]);

    const anhRow = screen.getByText("Trần Việt Anh").closest("tr")!;
    expect(within(anhRow).getByText("Failed")).toBeInTheDocument();
    expect(within(anhRow).getAllByRole("cell")[3]).toHaveTextContent("4.0");
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();

    // 4. File input was reset
    expect(fileInput.value).toBe("");
  });

  it("atomically updates student scores and recalculates final grade when 100% of imported rows pass validation", async () => {
    const user = userEvent.setup();
    renderGradebook();

    await screen.findByText("Hoàng Phương Bình");

    // Verify initial status: Trần Việt Anh is Failed with final score 4.17
    const anhRow = screen.getByText("Trần Việt Anh").closest("tr")!;
    expect(within(anhRow).getByText("Failed")).toBeInTheDocument();

    // Create 100% valid import file boosting Trần Việt Anh scores to passing grade
    const validData = [
      [
        "Student",
        "Email",
        "Attendance",
        "Quiz 1",
        "Quiz 2",
        "Assignment",
        "Practice",
        "Project",
        "Midterm",
        "Final",
        "Bonus",
      ],
      [
        "Hoàng Phương Bình",
        "phuongbinh.conan@gmail.com",
        "10",
        "9",
        "9",
        "9",
        "9",
        "9",
        "9",
        "9",
        "1",
      ],
      [
        "Trần Việt Anh",
        "anhviettran357@gmail.com",
        "10",
        "8",
        "8",
        "8",
        "8",
        "8",
        "8",
        "8",
        "0",
      ],
    ];

    const wb = utils.book_new();
    const ws = utils.aoa_to_sheet(validData);
    utils.book_append_sheet(wb, ws, "Sheet1");
    const arrayBuffer = write(wb, { type: "array", bookType: "xlsx" });
    const validFile = new File([arrayBuffer], "valid_scores.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, validFile);

    // 1. Error Modal should NOT be open
    expect(screen.queryByRole("heading", { name: "Import Validation Failed" })).not.toBeInTheDocument();

    // 2. Table updated: Trần Việt Anh now has Passed badge and updated score
    await screen.findByText("Save Changes");
    expect(within(anhRow).queryByText("Failed")).not.toBeInTheDocument();
    expect(within(anhRow).getByText("Passed")).toBeInTheDocument();

    // 3. Save Changes button is visible
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();

    // 4. File input was reset
    expect(fileInput.value).toBe("");
  });

  it("enforces Auto-Fail on Zero Score (Disqualification) rule in real-time and visual indicators", async () => {
    const user = userEvent.setup();
    renderGradebook();

    await screen.findByText("Hoàng Phương Bình");

    const binhRow = screen.getByText("Hoàng Phương Bình").closest("tr")!;
    // Initially, Hoàng Phương Bình is Passed with finalScore ~7.83
    expect(within(binhRow).getByText("Passed")).toBeInTheDocument();

    // 1. Inline edit Quiz 1 (column 3: # is 0, Student is 1, Attendance is 2, Quiz 1 is 3) to 0
    const cells = within(binhRow).getAllByRole("cell");
    const quiz1Cell = cells[3]; // Quiz 1
    await user.click(quiz1Cell);

    const input = within(quiz1Cell).getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Cell score is now 0.0 with red text styling
    const scoreSpan = within(quiz1Cell).getByText("0.0");
    expect(scoreSpan).toHaveClass("text-red-600");

    // Status is now Failed despite average > 5.0
    expect(within(binhRow).queryByText("Passed")).not.toBeInTheDocument();
    const failedBadge = within(binhRow).getByText("Failed");
    expect(failedBadge).toBeInTheDocument();
    expect(failedBadge).toHaveAttribute(
      "title",
      "Failed due to zero score in mandatory component",
    );

    // 2. Attendance with 0 does NOT trigger auto-fail:
    // Change Quiz 1 back to 8.0, and change Attendance (column 2) to 0
    await user.click(quiz1Cell);
    const quiz1Input = within(quiz1Cell).getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(quiz1Input, { target: { value: "8" } });
    fireEvent.keyDown(quiz1Input, { key: "Enter" });

    const attCell = cells[2]; // Attendance
    await user.click(attCell);
    const attInput = within(attCell).getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(attInput, { target: { value: "0" } });
    fireEvent.keyDown(attInput, { key: "Enter" });

    // With Attendance = 0 and Quiz 1 = 8.0, Final Score is still >= 5.0 and no mandatory component is 0:
    // Student remains Passed!
    expect(within(binhRow).getByText("Passed")).toBeInTheDocument();
  });

  it("enforces Final exam floor score (Final >= 4.0) rule and turns Final Score red when failed", async () => {
    const user = userEvent.setup();
    renderGradebook();

    await screen.findByText("Hoàng Phương Bình");

    const binhRow = screen.getByText("Hoàng Phương Bình").closest("tr")!;
    const cells = within(binhRow).getAllByRole("cell");
    const practiceCell = cells[6]; // Practice
    const finalExamCell = cells[9]; // Final
    const finalScoreCell = cells[11]; // Final Score
    const finalScoreSpan = within(finalScoreCell).getByText("7.83");

    // Initially Passed, Final Score is blue
    expect(within(binhRow).getByText("Passed")).toBeInTheDocument();
    expect(finalScoreSpan).toHaveClass("text-blue-700");

    // 1. Edit Practice to 3.5: Practice floor rule was removed, so student remains Passed!
    await user.click(practiceCell);
    const pracInput = within(practiceCell).getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(pracInput, { target: { value: "3.5" } });
    fireEvent.keyDown(pracInput, { key: "Enter" });

    // Practice cell has no red text because 3.5 > 0
    expect(within(practiceCell).getByText("3.5")).not.toHaveClass("text-red-600");
    expect(within(binhRow).getByText("Passed")).toBeInTheDocument();

    // 2. Edit Final exam (column 9) from 8.5 to 3.5 (< 4.0 floor):
    await user.click(finalExamCell);
    const finalInput = within(finalExamCell).getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(finalInput, { target: { value: "3.5" } });
    fireEvent.keyDown(finalInput, { key: "Enter" });

    // Final exam cell is now highlighted with red bold text
    const finalSpan = within(finalExamCell).getByText("3.5");
    expect(finalSpan).toHaveClass("text-red-600");

    // Final Score is still >= 5.0 (6.72) but text color turns RED
    expect(within(finalScoreCell).getByText("6.72")).toHaveClass("text-rose-600");

    // Status is now Failed with Final exam floor tooltip
    expect(within(binhRow).queryByText("Passed")).not.toBeInTheDocument();
    const failedBadge = within(binhRow).getByText("Failed");
    expect(failedBadge).toBeInTheDocument();
    expect(failedBadge).toHaveAttribute(
      "title",
      "Failed due to Final Exam score < 4.0",
    );

    // 3. Edit Final exam to 4.0 (satisfies floor): returns to Passed and blue Final Score
    await user.click(finalExamCell);
    const finalInput2 = within(finalExamCell).getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(finalInput2, { target: { value: "4.0" } });
    fireEvent.keyDown(finalInput2, { key: "Enter" });

    expect(within(binhRow).getByText("Passed")).toBeInTheDocument();
    expect(within(finalScoreCell).getByText("6.78")).toHaveClass("text-blue-700");
  });
});
