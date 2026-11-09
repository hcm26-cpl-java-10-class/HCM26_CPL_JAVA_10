import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TraineeBatchPayload } from "@/api/features/trainee.api";
import { fakeHttp, type RecordedCall } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderRoutes } from "@/test/render";
import type { Trainee } from "@/types";
import ClassDetailPage from "../ClassDetailPage";
import ClassListPage from "../ClassListPage";
import { getMockTraineesByClass, MOCK_TRAINING_CLASSES } from "../mocks/classTrainee.mock";
import { resetClassAttendanceStoreForTest } from "./TraineeAttendanceView";
import { formatFptStudentIdForSite, getFptStudentIdRuleBySite } from "./TraineeModal";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";

vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));

function renderClassFlow(route = "/classes/2") {
    return renderRoutes(
        [
            { path: "/classes", element: <ClassListPage /> },
            { path: "/classes/:classId", element: <ClassDetailPage /> },
            { path: "/training-operations/class-details/:classCode", element: <ClassDetailPage /> },
            { path: "/topic-marks", element: <TopicMarkGradebookDemoPage /> },
        ],
        { route },
    );
}

let serverTraineesState: Trainee[] = [];

beforeEach(() => {
    fakeHttp.reset();
    resetClassAttendanceStoreForTest();
    grant("SESSION_READ", "STUDENT_SCORE_READ");
    serverTraineesState = getMockTraineesByClass(2);
    fakeHttp.on("get", "/external/classes", MOCK_TRAINING_CLASSES);
    fakeHttp.on("get", "/external/classes/2", MOCK_TRAINING_CLASSES[0]);
    fakeHttp.on("get", "/external/classes/2/trainees", () => serverTraineesState);
    fakeHttp.on("get", "/topic-marks/gradebook/search", () => {
        return {
            columns: [
                { key: "quiz1", label: "Quiz 1" },
                { key: "assignment", label: "Assignment" },
                { key: "FINAL_SCORE", label: "Final Score" },
                { key: "IS_PASSED", label: "Is Passed" },
            ],
            rows: {
                content: [
                    {
                        userId: "stu-101",
                        fullName: "Hoàng Phương Bình",
                        email: "phuongbinh.conan@gmail.com",
                        values: { quiz1: 8.5, assignment: 9.0, FINAL_SCORE: 8.75, IS_PASSED: true },
                    },
                ],
                page: 0,
                size: 10,
                totalElements: 1,
                totalPages: 1,
            },
        };
    });
    fakeHttp.on("put", "/external/classes/2/trainees/batch", (call: RecordedCall) => {
        const payload = call.data as TraineeBatchPayload;
        const deletedSet = new Set(payload.deletedIds);
        const updatedMap = new Map(payload.updated.map((item) => [item.id, item]));

        let next = serverTraineesState
            .filter((item) => !deletedSet.has(item.id))
            .map((item) => updatedMap.get(item.id) ?? item);

        let nextId = next.reduce((max, item) => Math.max(max, item.id), 100);
        for (const created of payload.created) {
            nextId += 1;
            next = [
                ...next,
                {
                    id: nextId,
                    code: created.fptAccount,
                    fptAccount: created.fptAccount,
                    fullName: created.fullName,
                    personalEmail: created.personalEmail,
                    email: created.personalEmail,
                    nationalId: created.nationalId,
                    employeeId: created.employeeId ?? "",
                    accessCardId: created.accessCardId ?? "",
                    dob: created.dob ?? "",
                    gender: created.gender,
                    status: created.status,
                },
            ];
        }

        serverTraineesState = next;
        return { message: "Trainee changes saved successfully!", trainees: serverTraineesState };
    });
});

describe("ClassDetailView & TraineeListTab", () => {
    it("navigates from Class List link to Class Details header and renders all 5 tabs", async () => {
        const { user } = renderClassFlow("/classes");

        const classLink = await screen.findByRole("link", { name: "HCM26_FR_JAVA_03" });
        await user.click(classLink);

        expect(await screen.findByRole("heading", { name: "Class Details : HCM26_FR_JAVA_03" })).toBeInTheDocument();
        expect(screen.getByText("In progress")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Class status information" })).toBeInTheDocument();

        for (const label of ["Class Info", "Trainee List", "Calendar", "Budget & Operation Info", "Activities"]) {
            expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
        }
    });

    it("resolves class details by classCode route (/training-operations/class-details/:classCode)", async () => {
        renderClassFlow("/training-operations/class-details/HCM26_FR_JAVA_03");

        expect(await screen.findByRole("heading", { name: "Class Details : HCM26_FR_JAVA_03" })).toBeInTheDocument();
        expect(await screen.findByText("Hoàng Phương Bình")).toBeInTheDocument();
    });

    it("renders all 10 Trainee List columns with FPT Student ID, searches trainees, selects checkboxes, and navigates on Topic Mark", async () => {
        const { user } = renderClassFlow("/classes/2");

        const table = await screen.findByRole("table", { name: "Trainee List" });
        const headers = within(table).getAllByRole("columnheader");
        expect(headers).toHaveLength(10);
        expect(headers.slice(1).map((h) => h.textContent)).toEqual([
            "No.",
            "Full Name",
            "FPT Student ID",
            "Personal Email",
            "National ID",
            "DOB",
            "Gender",
            "Status",
            "Action",
        ]);

        await screen.findByText("Hoàng Phương Bình");
        expect(screen.getByRole("button", { name: /\+ add trainee/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

        const rows = within(table).getAllByRole("row").slice(1);
        expect(rows).toHaveLength(10);

        const firstRowCells = within(rows[0]).getAllByRole("cell");
        expect(firstRowCells[1]).toHaveTextContent("1");
        expect(firstRowCells[2]).toHaveTextContent("Hoàng Phương Bình");
        expect(firstRowCells[3]).toHaveTextContent("SE180101");
        expect(firstRowCells[4]).toHaveTextContent("phuongbinh.conan@gmail.com");
        expect(firstRowCells[5]).toHaveTextContent("075204005839");
        expect(firstRowCells[6]).toHaveTextContent("23-Aug-2004");
        expect(firstRowCells[7]).toHaveTextContent("Male");
        expect(firstRowCells[8]).toHaveTextContent("Active");

        // Select all & individual selection
        const selectAll = screen.getByRole("checkbox", { name: "Select all trainees" });
        await user.click(selectAll);
        expect(screen.getByRole("checkbox", { name: "Select Hoàng Phương Bình" })).toBeChecked();

        // Filter trainees via search input by FPT Student ID
        const searchInput = screen.getByPlaceholderText("Search trainees");
        await user.type(searchInput, "SS180102");
        const filteredRows = within(table).getAllByRole("row").slice(1);
        expect(filteredRows).toHaveLength(1);
        expect(within(filteredRows[0]).getByText("Trần Việt Anh")).toBeInTheDocument();

        // Row action menu (3 vertical dots)
        await user.click(screen.getByRole("button", { name: "Actions for Trần Việt Anh" }));
        const menu = await screen.findByRole("menu");
        expect(within(menu).getByRole("menuitem", { name: /view profile/i })).toBeInTheDocument();
        expect(within(menu).getByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
        expect(within(menu).getByRole("menuitem", { name: /^delete$/i })).toBeInTheDocument();

        // Topic Mark navigation passes classId and classCode, displays Back to Class Detail, and returns
        await user.click(screen.getByRole("button", { name: "Topic Mark" }));
        expect(await screen.findByRole("heading", { name: "Topic Marks : HCM26_FR_JAVA_03" })).toBeInTheDocument();

        // Verify gradebook search received classId and classCode
        await waitFor(() => {
            const calls = fakeHttp.callsTo("get", "/topic-marks/gradebook/search");
            expect(calls.length).toBeGreaterThanOrEqual(1);
            const params = calls[calls.length - 1].params as Record<string, string>;
            expect(params.classId).toBe("2");
            expect(params.classCode).toBe("HCM26_FR_JAVA_03");
        });

        // Click "Back to Class Detail" navigates back to Class Details
        const backLink = screen.getByRole("link", { name: /back to class detail/i });
        expect(backLink).toBeInTheDocument();
        await user.click(backLink);
        expect(await screen.findByRole("heading", { name: "Class Details : HCM26_FR_JAVA_03" })).toBeInTheDocument();
    });

    it("enforces site-specific FPT Student ID rules (HCM: SE/SS/AI/IA, HN: HE/HS/AI/IA, Other: DE + 6 digits)", () => {
        const hcmRule = getFptStudentIdRuleBySite("TP. Ho Chi Minh");
        expect(hcmRule.pattern.test("SE180101")).toBe(true);
        expect(hcmRule.pattern.test("SS180102")).toBe(true);
        expect(hcmRule.pattern.test("AI180103")).toBe(true);
        expect(hcmRule.pattern.test("IA180104")).toBe(true);
        expect(hcmRule.pattern.test("HE180101")).toBe(false);
        expect(hcmRule.pattern.test("DE180101")).toBe(false);

        const hnRule = getFptStudentIdRuleBySite("Ha Noi");
        expect(hnRule.pattern.test("HE180101")).toBe(true);
        expect(hnRule.pattern.test("HS180102")).toBe(true);
        expect(hnRule.pattern.test("AI180103")).toBe(true);
        expect(hnRule.pattern.test("IA180104")).toBe(true);
        expect(hnRule.pattern.test("SE180101")).toBe(false);
        expect(hnRule.pattern.test("DE180101")).toBe(false);

        const otherRule = getFptStudentIdRuleBySite("Da Nang");
        expect(otherRule.pattern.test("DE180101")).toBe(true);
        expect(otherRule.pattern.test("SE180101")).toBe(false);
        expect(otherRule.pattern.test("HE180101")).toBe(false);

        expect(formatFptStudentIdForSite("SE180101", "HN", 101)).toBe("HE180101");
        expect(formatFptStudentIdForSite("SS180102", "Da Nang", 102)).toBe("DE180102");
    });

    it("validates Add Trainee form and stages new, edited, and deleted trainees before persisting via Save Changes", async () => {
        const { user } = renderClassFlow("/classes/2");
        const table = await screen.findByRole("table", { name: "Trainee List" });
        await screen.findByText("Hoàng Phương Bình");

        // 1. Open + Add Trainee modal and trigger validation
        await user.click(screen.getByRole("button", { name: /\+ add trainee/i }));
        const addDialog = await screen.findByRole("dialog", { name: "Add New Trainee" });
        await user.click(within(addDialog).getByRole("button", { name: "Add Trainee" }));

        expect(within(addDialog).getByText("Full Name is required.")).toBeInTheDocument();
        expect(within(addDialog).getByText("FPT Student ID is required.")).toBeInTheDocument();
        expect(within(addDialog).getByText("Personal Email is required.")).toBeInTheDocument();
        expect(within(addDialog).getByText("National ID is required.")).toBeInTheDocument();
        expect(within(addDialog).getByText("Date of Birth is required.")).toBeInTheDocument();

        // Full Name hard-capped at 100 characters
        const addNameInput = within(addDialog).getByLabelText(/Full Name/i) as HTMLInputElement;
        expect(addNameInput).toHaveAttribute("maxLength", "100");
        fireEvent.change(addNameInput, { target: { value: "A".repeat(120) } });
        expect(addNameInput.value).toHaveLength(100);
        fireEvent.change(addNameInput, { target: { value: "" } });

        // Reject invalid HN prefix on HCM class and DOB under 17 years old
        await user.type(addNameInput, "Nguyễn Minh Khang");
        await user.type(within(addDialog).getByLabelText(/FPT Student ID/i), "HE180999");
        await user.type(within(addDialog).getByLabelText(/Personal Email/i), "khang.nguyen@gmail.com");
        await user.type(within(addDialog).getByLabelText(/National ID/i), "079204009999");
        const dobInput = within(addDialog).getByLabelText(/DOB/i);
        await user.type(dobInput, "2015-05-10");
        await user.click(within(addDialog).getByRole("button", { name: "Add Trainee" }));
        expect(
            within(addDialog).getByText(
                "FPT Student ID for HCM site must be SE, SS, AI, or IA followed by 6 digits (e.g. SE180101).",
            ),
        ).toBeInTheDocument();
        expect(
            within(addDialog).getByText("Trainee must be at least 17 years old (University level)."),
        ).toBeInTheDocument();

        // Fill valid HCM FPT Student ID and valid DOB (>= 17 years old)
        const studentIdInput = within(addDialog).getByLabelText(/FPT Student ID/i);
        await user.clear(studentIdInput);
        await user.type(studentIdInput, "SE180999");
        await user.clear(dobInput);
        await user.type(dobInput, "2004-10-15");
        await user.selectOptions(within(addDialog).getByLabelText(/^Gender$/i), "Male");
        await user.selectOptions(within(addDialog).getByLabelText(/^Status$/i), "Active");
        await user.click(within(addDialog).getByRole("button", { name: "Add Trainee" }));

        expect(await screen.findByText("Nguyễn Minh Khang")).toBeInTheDocument();
        expect(screen.getByText("SE180999")).toBeInTheDocument();
        expect(screen.getByText("15-Oct-2004")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();

        // 2. Edit an existing trainee ("Trần Việt Anh")
        await user.click(screen.getByRole("button", { name: "Actions for Trần Việt Anh" }));
        await user.click(await screen.findByRole("menuitem", { name: /^edit$/i }));

        const editDialog = await screen.findByRole("dialog", { name: "Edit Trainee" });
        const nameInput = within(editDialog).getByLabelText(/Full Name/i);
        await user.clear(nameInput);
        await user.type(nameInput, "Trần Việt Anh Updated");
        await user.selectOptions(within(editDialog).getByLabelText(/^Status$/i), "Inactive");
        await user.click(within(editDialog).getByRole("button", { name: "Update Trainee" }));

        expect(await screen.findByText("Trần Việt Anh Updated")).toBeInTheDocument();
        expect(within(table).getByText("Inactive")).toBeInTheDocument();

        // 3. Delete an existing trainee ("Đỗ Gia Huy") with confirmation modal
        await user.click(screen.getByRole("button", { name: "Actions for Đỗ Gia Huy" }));
        await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));

        const deleteDialog = await screen.findByRole("dialog", { name: "Remove Trainee" });
        expect(
            within(deleteDialog).getByText("Are you sure you want to remove this trainee from class?"),
        ).toBeInTheDocument();
        await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));

        expect(within(table).queryByText("Đỗ Gia Huy")).not.toBeInTheDocument();
        expect(screen.getByText("3 unsaved changes")).toBeInTheDocument();

        // 4. Persist staged batch via Save Changes
        await user.click(screen.getByRole("button", { name: /save changes/i }));

        await waitFor(() => {
            expect(fakeHttp.callsTo("put", "/external/classes/2/trainees/batch")).toHaveLength(1);
        });

        const sentPayload = fakeHttp.callsTo("put", "/external/classes/2/trainees/batch")[0]
            .data as TraineeBatchPayload;
        expect(sentPayload.created).toHaveLength(1);
        expect(sentPayload.created[0].fptAccount).toBe("SE180999");
        expect(sentPayload.updated).toHaveLength(1);
        expect(sentPayload.updated[0].id).toBe(102);
        expect(sentPayload.updated[0].fullName).toBe("Trần Việt Anh Updated");
        expect(sentPayload.deletedIds).toEqual([104]);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
        });
    }, 15000);

    it("supports Discard to restore staged deletions and guards tab navigation when unsaved changes exist", async () => {
        const { user } = renderClassFlow("/classes/2");
        await screen.findByText("Hoàng Phương Bình");

        // Stage a deletion
        await user.click(screen.getByRole("button", { name: "Actions for Hoàng Phương Bình" }));
        await user.click(await screen.findByRole("menuitem", { name: /^delete$/i }));
        const deleteDialog = await screen.findByRole("dialog", { name: "Remove Trainee" });
        await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));

        expect(screen.queryByText("Hoàng Phương Bình")).not.toBeInTheDocument();

        // Attempt switching tab -> Unsaved Changes confirmation appears
        await user.click(screen.getByRole("tab", { name: "Class Info" }));
        const guardDialog = await screen.findByRole("dialog", { name: "Unsaved Changes" });
        expect(
            within(guardDialog).getByText("You have unsaved changes. Are you sure you want to leave?"),
        ).toBeInTheDocument();

        // Stay on Trainee List and click Discard -> row is restored
        await user.click(within(guardDialog).getByRole("button", { name: "Stay" }));
        await user.click(screen.getByRole("button", { name: /discard/i }));

        expect(await screen.findByText("Hoàng Phương Bình")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();

        // Open View Profile from row menu
        await user.click(screen.getByRole("button", { name: "Actions for Hoàng Phương Bình" }));
        await user.click(await screen.findByRole("menuitem", { name: /view profile/i }));
        const profileDialog = await screen.findByRole("dialog", { name: "Trainee Profile" });
        expect(within(profileDialog).getByText("phuongbinh.conan@gmail.com")).toBeInTheDocument();
        await user.click(within(profileDialog).getAllByRole("button", { name: "Close" })[0]);

        // Clicking directly on Full Name button opens View Profile dialog
        const traineeNameBtn = screen.getByRole("button", { name: "Trần Việt Anh" });
        expect(traineeNameBtn).toHaveAttribute("title", "View Profile");
        await user.click(traineeNameBtn);
        const nameProfileDialog = await screen.findByRole("dialog", { name: "Trainee Profile" });
        expect(within(nameProfileDialog).getByText("anhviettran357@gmail.com")).toBeInTheDocument();
        await user.click(within(nameProfileDialog).getAllByRole("button", { name: "Close" })[0]);

        // Bulk selection: Export Selected and Delete Selected start disabled
        const exportSelectedBtn = screen.getByRole("button", { name: /export selected/i });
        const deleteSelectedBtn = screen.getByRole("button", { name: /delete selected/i });
        expect(exportSelectedBtn).toBeDisabled();
        expect(deleteSelectedBtn).toBeDisabled();

        // Tick two trainees -> both buttons light up with count (2)
        await user.click(screen.getByRole("checkbox", { name: "Select Hoàng Phương Bình" }));
        await user.click(screen.getByRole("checkbox", { name: "Select Trần Việt Anh" }));
        expect(exportSelectedBtn).toBeEnabled();
        expect(deleteSelectedBtn).toBeEnabled();
        expect(exportSelectedBtn).toHaveTextContent("2");
        expect(deleteSelectedBtn).toHaveTextContent("2");

        // Click Delete Selected -> opens bulk delete confirmation dialog and stages deletion
        await user.click(deleteSelectedBtn);
        const bulkDeleteDialog = await screen.findByRole("dialog", { name: "Remove Selected Trainees" });
        expect(
            within(bulkDeleteDialog).getByText(/Are you sure you want to remove 2 selected trainees from class\?/i),
        ).toBeInTheDocument();
        await user.click(within(bulkDeleteDialog).getByRole("button", { name: /delete selected/i }));

        expect(screen.queryByText("Hoàng Phương Bình")).not.toBeInTheDocument();
        expect(screen.queryByText("Trần Việt Anh")).not.toBeInTheDocument();
        expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();
    });

    it("renders the 3x6 General property grid inside Class Info tab", async () => {
        const { user } = renderClassFlow("/classes/2");

        await screen.findByRole("heading", { name: "Class Details : HCM26_FR_JAVA_03" });
        await user.click(screen.getByRole("tab", { name: "Class Info" }));

        const expectedPairs: Array<[string, string]> = [
            ["Class Name", "HCM26_FR_JAVA_03"],
            ["Delivery Type", "Class"],
            ["Trainee Type", "Fresher"],
            ["Format Type", "Offline"],
            ["Skills", "Java"],
            ["Training Program", "[NFP] Fresher Full-stack Java Developer for SCM 1.0"],
            ["Site", "TP. Ho Chi Minh"],
            ["Location", "Center Building, HCM"],
            ["Expected Start Date", "23-May-2026"],
            ["Expected End Date", "22-Nov-2026"],
            ["Planned Trainee No.", "10"],
            ["Subject Type", "IT Technical"],
            ["Planned Revenue", "0 VND"],
            ["Scope", "Unit"],
            ["Supplier/Partner", "SCM"],
            ["Key Program", "—"],
            ["Global SE", "No"],
            ["Job Recommendation", "No"],
        ];

        for (const [label, value] of expectedPairs) {
            const term = screen.getByText(label);
            expect(term).toBeInTheDocument();
            expect(term.nextElementSibling).toHaveTextContent(value);
        }
    });

    it("supports extended Bulk Actions: selection count badge and Change Status", async () => {
        const { user } = renderClassFlow("/classes/2");
        await screen.findByText("Hoàng Phương Bình");

        const changeStatusBtn = screen.getByRole("button", { name: /change status/i });

        expect(screen.queryByRole("button", { name: /move to class/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /send email/i })).not.toBeInTheDocument();
        expect(changeStatusBtn).toBeDisabled();

        // 1. Select two trainees
        await user.click(screen.getByRole("checkbox", { name: "Select Hoàng Phương Bình" }));
        await user.click(screen.getByRole("checkbox", { name: "Select Trần Việt Anh" }));

        // Selection badge appears
        expect(screen.getByText("2 Trainees Selected")).toBeInTheDocument();
        expect(changeStatusBtn).toBeEnabled();

        // 2. Change Status in bulk to "Inactive"
        await user.click(changeStatusBtn);
        const inactiveItem = await screen.findByRole("menuitem", { name: /inactive/i });
        await user.click(inactiveItem);

        // Status badges for both trainees should now reflect "Inactive"
        const traineeTable = screen.getByRole("table", { name: "Trainee List" });
        const inactiveBadges = within(traineeTable).getAllByText("Inactive");
        expect(inactiveBadges.length).toBeGreaterThanOrEqual(2);
        expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    }, 15000);

    it("switches to Attendance Tracker view, renders 4 summary cards, attendance table, View Logs, and Take Daily Attendance", async () => {
        const { user } = renderClassFlow("/classes/2");
        await screen.findByText("Hoàng Phương Bình");

        // 1. Switch to Attendance Tracker view
        await user.click(screen.getByRole("button", { name: /^attendance$/i }));
        expect(await screen.findByTestId("attendance-tracker-view")).toBeInTheDocument();
        expect(screen.getByTestId("summary-sessions-conducted")).toHaveTextContent("20 / 40 Sessions");
        expect(screen.getByTestId("summary-attendance-rate")).toHaveTextContent("91%");
        expect(screen.getByTestId("summary-at-risk")).toHaveTextContent("3 Trainees");
        expect(screen.getByTestId("summary-critical")).toHaveTextContent("2 Trainees");

        // 2. Verify Attendance Table columns and status badges
        const attTable = screen.getByRole("table", { name: "Trainee Attendance Table" });
        expect(within(attTable).getAllByText("Eligible").length).toBeGreaterThan(0);
        expect(within(attTable).getAllByText("Warning").length).toBe(3);
        expect(within(attTable).getAllByText("Disqualified").length).toBe(2);

        // 3. Open View Logs modal for a trainee
        await user.click(screen.getByRole("button", { name: "View Logs for Trần Vũ Gia Bảo" }));
        const logsDialog = await screen.findByRole("dialog", {
            name: /Attendance Logs — Trần Vũ Gia Bảo/i,
        });
        expect(within(logsDialog).getByText(/Session History \(20 Sessions\)/i)).toBeInTheDocument();
        await user.click(within(logsDialog).getAllByRole("button", { name: "Close" })[0]);

        // 4. Take Daily Attendance -> mark one trainee Unexcused -> Save Changes
        await user.click(screen.getByRole("button", { name: /take attendance/i }));
        const takeDialog = await screen.findByRole("dialog", {
            name: /Take Daily Attendance — Session #21/i,
        });
        await user.click(within(takeDialog).getByRole("button", { name: /mark all present/i }));
        await user.selectOptions(
            within(takeDialog).getByLabelText("Attendance status for Hoàng Phương Bình"),
            "Unexcused",
        );
        await user.click(within(takeDialog).getByRole("button", { name: /save changes/i }));

        // Sessions Conducted increments to 21 / 40 Sessions
        expect(await screen.findByTestId("summary-sessions-conducted")).toHaveTextContent(
            "21 / 40 Sessions",
        );

        // 5. Click Back to Trainee List returns to Trainee List table
        await user.click(screen.getByRole("button", { name: /back to trainee list/i }));
        expect(await screen.findByRole("table", { name: "Trainee List" })).toBeInTheDocument();
    }, 15000);
});
