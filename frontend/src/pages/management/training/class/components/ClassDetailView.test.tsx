import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import type { TraineeBatchPayload } from "@/api/features/trainee.api";
import { fakeHttp, httpError, type RecordedCall } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderRoutes } from "@/test/render";
import type { Trainee } from "@/types";
import ClassDetailPage from "../ClassDetailPage";
import ClassListPage from "../ClassListPage";
import { getMockTraineesByClass, MOCK_TRAINING_CLASSES } from "../mocks/classTrainee.mock";
import {
    buildClassSessionSchedule,
    resetClassAttendanceStoreForTest,
    resolveClassExpectedDates,
} from "./TraineeAttendanceView";
import { formatFptStudentIdForSite, getFptStudentIdRuleBySite } from "./TraineeModal";
import { resetClassTopicMarkStoreForTest, resolveTraineeAccount } from "./TraineeTopicMarkView";
import TopicMarkGradebookDemoPage from "@/pages/management/demo/topic_mark_gradebook";

vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));
vi.mock("xlsx", async (importOriginal) => ({
    ...(await importOriginal<typeof import("xlsx")>()),
    writeFile: vi.fn(),
}));

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
    resetClassTopicMarkStoreForTest();
    grant("SESSION_READ", "STUDENT_SCORE_READ");
    serverTraineesState = getMockTraineesByClass(2);
    fakeHttp.on("get", "/external/classes", MOCK_TRAINING_CLASSES);
    fakeHttp.on("get", "/classes", MOCK_TRAINING_CLASSES);
    fakeHttp.on("get", "/external/classes/2", MOCK_TRAINING_CLASSES[0]);
    fakeHttp.on("get", "/classes/2", MOCK_TRAINING_CLASSES[0]);
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
    it("opens HCM02666 by its own ID and does not reuse the HCM026 calendar", async () => {
        const first = { id: 1, code: "HCM026", name: "HCM026", status: "planning", startDate: "2026-11-09" };
        const second = { id: 2, code: "HCM02666", name: "HCM02666", status: "planning", startDate: "2026-11-09" };
        fakeHttp.on("get", "/classes", [first, second]);
        fakeHttp.on("get", "/classes/1", first);
        fakeHttp.on("get", "/classes/2", second);
        fakeHttp.on("get", "/classes/1/schedule", {
            classInfo: { id: 1, code: "HCM026", name: "HCM026", startDate: "2026-11-09" },
            program: { id: 10, code: "BACKEND_JAVA", name: "Java", courses: [{ id: 101, code: "JAVA-ONLY-1", name: "Java Only 1", durationHours: 4, orderIndex: 1, slotsNeeded: 1 }] },
            config: { slotHours: 4, slots: [{ slot: 1, start: "08:00", end: "12:00" }, { slot: 2, start: "13:00", end: "17:00" }], workingDays: [1, 2, 3, 4, 5], holidays: [] },
            hasSchedule: true,
            outdated: false,
            entries: [{ id: "e-1", classId: 1, courseId: 101, courseCode: "JAVA-ONLY-1", courseName: "Java Only 1", date: "2026-11-09", slot: 1, startTime: "08:00", endTime: "12:00", order: 1, isManual: false }],
        });
        fakeHttp.on("get", "/classes/2/schedule", {
            classInfo: { id: 2, code: "HCM02666", name: "HCM02666", startDate: "2026-11-09" },
            program: null,
            config: { slotHours: 4, slots: [{ slot: 1, start: "08:00", end: "12:00" }, { slot: 2, start: "13:00", end: "17:00" }], workingDays: [1, 2, 3, 4, 5], holidays: [] },
            hasSchedule: false,
            outdated: false,
            entries: [],
        });
        const { user } = renderClassFlow("/classes");
        await user.click(await screen.findByRole("link", { name: "HCM026" }));
        await user.click(await screen.findByRole("tab", { name: "Calendar" }));
        expect((await screen.findAllByText("JAVA-ONLY-1")).length).toBeGreaterThan(0);
        await user.click(screen.getAllByRole("link", { name: "Back to Class List" })[0]);
        await user.click(await screen.findByRole("link", { name: "HCM02666" }));
        await screen.findByRole("heading", { name: "Class Details : HCM02666" });
        await user.click(screen.getByRole("tab", { name: "Calendar" }));
        await screen.findByRole("heading", { name: "No schedule yet" });
        expect(screen.queryByText("JAVA-ONLY-1")).not.toBeInTheDocument();
        expect(fakeHttp.callsTo("get", "/classes/2/schedule")).toHaveLength(1);
    });
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

    it("renders all 9 Trainee List columns with Student ID, searches trainees, selects checkboxes, and navigates on Topic Mark", async () => {
        const { user } = renderClassFlow("/classes/2");

        const table = await screen.findByRole("table", { name: "Trainee List" });
        const headers = within(table).getAllByRole("columnheader");
        expect(headers).toHaveLength(9);
        expect(headers.slice(1).map((h) => h.textContent)).toEqual([
            "No.",
            "Full Name",
            "Student ID",
            "Personal Email",
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
        expect(firstRowCells[5]).toHaveTextContent("23-Aug-2004");
        expect(firstRowCells[6]).toHaveTextContent("Male");
        expect(firstRowCells[7]).toHaveTextContent("Active");

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

        // Topic Mark view opens in-place with dynamic class code and returns via Back to Trainee List
        await user.click(screen.getByRole("button", { name: "Topic Mark" }));
        expect(await screen.findByRole("heading", { name: "Topic Mark HCM26_FR_JAVA_03" })).toBeInTheDocument();

        const backButton = screen.getByRole("button", { name: /back to trainee list/i });
        expect(backButton).toBeInTheDocument();
        await user.click(backButton);
        expect(await screen.findByRole("table", { name: "Trainee List" })).toBeInTheDocument();
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
        expect(within(addDialog).getByText("Student ID is required.")).toBeInTheDocument();
        expect(within(addDialog).getByText("Personal Email is required.")).toBeInTheDocument();
        expect(within(addDialog).queryByLabelText(/National ID/i)).not.toBeInTheDocument();
        expect(within(addDialog).getByText("Date of Birth is required.")).toBeInTheDocument();

        // Full Name hard-capped at 100 characters
        const addNameInput = within(addDialog).getByLabelText(/Full Name/i) as HTMLInputElement;
        expect(addNameInput).toHaveAttribute("maxLength", "100");
        fireEvent.change(addNameInput, { target: { value: "A".repeat(120) } });
        expect(addNameInput.value).toHaveLength(100);
        fireEvent.change(addNameInput, { target: { value: "" } });

        // Reject invalid HN prefix on HCM class and DOB under 17 years old
        await user.type(addNameInput, "Nguyễn Minh Khang");
        await user.type(within(addDialog).getByLabelText(/Student ID/i), "HE180999");
        await user.type(within(addDialog).getByLabelText(/Personal Email/i), "khang.nguyen@gmail.com");
        const dobInput = within(addDialog).getByLabelText(/DOB/i);
        await user.type(dobInput, "2015-05-10");
        await user.click(within(addDialog).getByRole("button", { name: "Add Trainee" }));
        expect(
            within(addDialog).getByText(
                "Student ID for HCM site must be SE, SS, AI, or IA followed by 6 digits (e.g. SE180101).",
            ),
        ).toBeInTheDocument();
        expect(
            within(addDialog).getByText("Trainee must be at least 17 years old (University level)."),
        ).toBeInTheDocument();

        // Fill valid HCM Student ID and valid DOB (>= 17 years old)
        const studentIdInput = within(addDialog).getByLabelText(/Student ID/i);
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

    it("renders General section above Class Readiness section inside Class Info tab (Yêu cầu 2)", async () => {
        const { user } = renderClassFlow("/classes/2");

        await screen.findByRole("heading", { name: "Class Details : HCM26_FR_JAVA_03" });
        await user.click(screen.getByRole("tab", { name: "Class Info" }));

        const generalSection = screen.getByText("General");
        const readinessSection = screen.getByText(/Class Readiness/i);
        expect(generalSection).toBeInTheDocument();
        expect(readinessSection).toBeInTheDocument();

        expect(Boolean(generalSection.compareDocumentPosition(readinessSection) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
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

    it("switches to Attendance Tracker view, renders 3 interactive summary cards, clickable trainee name logs, sorting, Export Report, and Take Daily Attendance", async () => {
        const { user } = renderClassFlow("/classes/2");
        await screen.findByText("Hoàng Phương Bình");

        // 1. Switch to Attendance Tracker view
        await user.click(screen.getByRole("button", { name: /^attendance$/i }));
        expect(await screen.findByTestId("attendance-tracker-view")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Attendance & Absence Statistics" })).toBeInTheDocument();
        expect(screen.queryByText("Attendance Tracker")).not.toBeInTheDocument();
        expect(screen.queryByText(/< 10%: Good/)).not.toBeInTheDocument();
        expect(screen.queryByTestId("summary-sessions-conducted")).not.toBeInTheDocument();
        expect(screen.getByTestId("summary-attendance-rate")).toHaveTextContent("91%");
        expect(screen.getByTestId("summary-at-risk")).toHaveTextContent("3 Trainees");
        expect(screen.getByTestId("summary-critical")).toHaveTextContent("2 Trainees");

        // 2. Verify 9 Attendance Table columns (Full Name, Student ID & Email split, Action removed), English abbreviations, and standardized badges
        const attTable = screen.getByRole("table", { name: "Trainee Attendance Table" });
        expect(within(attTable).getAllByRole("columnheader")).toHaveLength(9);
        expect(within(attTable).getByRole("columnheader", { name: "Full Name" })).toBeInTheDocument();
        expect(within(attTable).getByRole("columnheader", { name: "Student ID" })).toBeInTheDocument();
        expect(within(attTable).getByRole("columnheader", { name: "Email" })).toBeInTheDocument();
        expect(within(attTable).queryByRole("columnheader", { name: "Personal Email" })).not.toBeInTheDocument();
        expect(within(attTable).queryByRole("columnheader", { name: "Action" })).not.toBeInTheDocument();
        const firstAttRowCells = within(within(attTable).getAllByRole("row")[1]).getAllByRole("cell");
        expect(firstAttRowCells[1]).toHaveTextContent("Hoàng Phương Bình");
        expect(firstAttRowCells[1]).not.toHaveTextContent("phuongbinh.conan@gmail.com");
        expect(firstAttRowCells[1]).not.toHaveTextContent("SE180101");
        expect(firstAttRowCells[2]).toHaveTextContent("SE180101");
        expect(firstAttRowCells[3]).toHaveTextContent("phuongbinh.conan@gmail.com");
        expect(within(attTable).getByText("Absent Rate (Max 20%)")).toBeInTheDocument();
        expect(within(attTable).queryByText("Max: 20%")).not.toBeInTheDocument();
        expect(within(attTable).getAllByText(/\(.*E \/ .*U\)/).length).toBeGreaterThan(0);
        expect(within(attTable).queryByText(/\(.*P \/ .*K\)/)).not.toBeInTheDocument();
        expect(within(attTable).getAllByText("Eligible").length).toBeGreaterThan(0);
        expect(within(attTable).getAllByText("At Risk").length).toBe(3);
        expect(within(attTable).getAllByText("Disqualified").length).toBe(2);

        // 2b. Interactive KPI cards sync with filter dropdown
        const statusSelect = screen.getByLabelText("Filter by Attendance Status");
        await user.click(screen.getByRole("button", { name: /At Risk \(10% - 19% Absent\)/i }));
        expect(statusSelect).toHaveValue("At Risk");
        expect(within(attTable).getAllByRole("row").slice(1)).toHaveLength(3);

        await user.click(screen.getByRole("button", { name: /Critical \(>= 20% Absent\)/i }));
        expect(statusSelect).toHaveValue("Disqualified");
        expect(within(attTable).getAllByRole("row").slice(1)).toHaveLength(2);

        // Clicking active KPI card again clears the filter
        await user.click(screen.getByRole("button", { name: /Critical \(>= 20% Absent\)/i }));
        expect(statusSelect).toHaveValue("");
        expect(within(attTable).getAllByRole("row").slice(1)).toHaveLength(10);

        // 2c. Column sorting (desc -> asc) and Export Report
        await user.click(screen.getByRole("button", { name: "Absent Rate (Max 20%)" }));
        const firstSortedRow = within(attTable).getAllByRole("row")[1];
        expect(within(firstSortedRow).getByText("25%")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /Export Report/i }));
        expect(XLSX.writeFile).toHaveBeenCalled();
        const reportBook = vi.mocked(XLSX.writeFile).mock.calls[
            vi.mocked(XLSX.writeFile).mock.calls.length - 1
        ][0];
        const reportCols = reportBook.Sheets["Attendance Report"]["!cols"] ?? [];
        expect(reportCols).toHaveLength(12);
        expect(reportCols.every((c) => (c.wch ?? 0) >= 8)).toBe(true);

        // 3. Click trainee's Full Name directly to open Attendance Logs modal
        const traineeNameLink = within(attTable).getByRole("button", { name: "View Logs for Trần Vũ Gia Bảo" });
        expect(traineeNameLink).toHaveTextContent("Trần Vũ Gia Bảo");
        expect(traineeNameLink).toHaveAttribute("title", "Click to view attendance logs");
        await user.click(traineeNameLink);
        const logsDialog = await screen.findByRole("dialog", {
            name: /Attendance Logs — Trần Vũ Gia Bảo/i,
        });
        expect(within(logsDialog).getByText(/Session History \(20 Sessions\)/i)).toBeInTheDocument();
        await user.click(within(logsDialog).getAllByRole("button", { name: "Close" })[0]);

        // 4. Take Daily Attendance: Session Selector, Excused Note Validation, Past Session Audit Trail & Real-Time Recalculation
        await user.click(screen.getByRole("button", { name: /take attendance/i }));
        const takeDialog = await screen.findByRole("dialog", {
            name: /Take Daily Attendance — Session #21/i,
        });

        // 4a. Current Session (#21) selected by default; Future Sessions (#22..#40) are locked/disabled; Past Sessions (#01..#20) are Completed (Editable with Audit Reason)
        const octToJanSchedule = buildClassSessionSchedule("2026-10-01", "2027-01-31", "2026-11-11");
        expect(octToJanSchedule).toHaveLength(40);
        expect(octToJanSchedule[0]).toBe("2026-10-01");
        expect(octToJanSchedule[19]).toBe("2026-11-10");
        expect(octToJanSchedule[20]).toBe("2026-11-11");
        expect(octToJanSchedule[21]).toBe("2026-11-13");
        expect(octToJanSchedule[39]).toBe("2027-01-31");
        expect(octToJanSchedule.every((d) => d >= "2026-10-01" && d <= "2027-01-31")).toBe(true);
        expect(
            resolveClassExpectedDates(
                { id: 1, code: "LOCAL_JAVA_01", name: "Java", startDate: "01-Oct-2026", endDate: "31-Jan-2027" } as any,
                "2026-11-11",
            ),
        ).toEqual({
            expectedStartDate: "2026-10-01",
            expectedEndDate: "2027-01-31",
            maxSelectableDate: "2026-11-11",
        });

        const sessionSelect = within(takeDialog).getByLabelText("Select Attendance Session") as HTMLSelectElement;
        expect(sessionSelect.value).toBe("21");
        const pastOption01 = within(sessionSelect).getByRole("option", {
            name: /Session #01.*Completed \(Editable with Audit Reason\)/i,
        }) as HTMLOptionElement;
        expect(pastOption01.disabled).toBe(false);
        const futureOption22 = within(sessionSelect).getByRole("option", {
            name: /Session #22.*Upcoming - Locked/i,
        }) as HTMLOptionElement;
        expect(futureOption22.disabled).toBe(true);

        // 4a-2. Selecting a future date (> today) strictly locks attendance and shows warning banner; min/max attributes match class dates
        const dateInput = within(takeDialog).getByLabelText("Session Date") as HTMLInputElement;
        expect(dateInput.min).toBe("2026-05-23");
        expect(dateInput.max).toBe(dateInput.value);
        const defaultTodayDate = dateInput.value;
        fireEvent.change(dateInput, { target: { value: "2099-11-26" } });
        expect(
            await within(takeDialog).findByText(
                /Cannot take attendance for a future date \(Session scheduled for 2099-11-26\)\./i,
            ),
        ).toBeInTheDocument();
        expect(within(takeDialog).getByRole("button", { name: /save changes/i })).toBeDisabled();
        expect(
            within(takeDialog).getByRole("button", { name: "Mark Hoàng Phương Bình as Present" }),
        ).toBeDisabled();

        // Restore today's date to unlock Current Session #21
        fireEvent.change(dateInput, { target: { value: defaultTodayDate } });
        expect(within(takeDialog).getByRole("button", { name: /save changes/i })).toBeEnabled();

        // 4b. Marking a trainee as Excused requires a Note / Reason
        await user.click(within(takeDialog).getByRole("button", { name: "Mark Hoàng Phương Bình as Excused" }));
        await user.click(within(takeDialog).getByRole("button", { name: /save changes/i }));
        expect(
            await within(takeDialog).findByText(
                /Note \/ Reason is required when marking Hoàng Phương Bình as Excused/i,
            ),
        ).toBeInTheDocument();

        // Reset to Present via Mark All Present, then mark Unexcused and save Current Session #21
        await user.click(within(takeDialog).getByRole("button", { name: /mark all present/i }));
        await user.selectOptions(
            within(takeDialog).getByLabelText("Attendance status for Hoàng Phương Bình"),
            "Unexcused",
        );
        await user.click(within(takeDialog).getByRole("button", { name: /save changes/i }));

        // Attended / Total updates in real time to reflect 21 conducted sessions
        expect((await within(attTable).findAllByText(/\/ 21$/)).length).toBe(10);

        // 4c. Open Take Attendance again -> Select Past Session #4 -> Edit status -> Require Audit Reason -> Verify Audit Trail in Logs
        await user.click(screen.getByRole("button", { name: /take attendance/i }));
        const pastDialog = await screen.findByRole("dialog", {
            name: /Take Daily Attendance — Session #21/i,
        });
        await user.selectOptions(
            within(pastDialog).getByLabelText("Select Attendance Session"),
            "4",
        );
        expect(await within(pastDialog).findByText("Editing Past Session")).toBeInTheDocument();

        // Change Hoàng Phương Bình in Session #4 from Present to Excused with a note
        await user.click(within(pastDialog).getByRole("button", { name: "Mark Hoàng Phương Bình as Excused" }));
        fireEvent.change(
            within(pastDialog).getByLabelText("Attendance note for Hoàng Phương Bình"),
            { target: { value: "Approved hospital visit" } },
        );

        // Saving without Audit Reason is blocked
        await user.click(within(pastDialog).getByRole("button", { name: /save changes/i }));
        expect(
            await within(pastDialog).findByText(
                /Audit Reason for Modification is required when updating past session attendance/i,
            ),
        ).toBeInTheDocument();

        // Enter Audit Reason and save
        fireEvent.change(
            within(pastDialog).getByLabelText("Audit Reason for Modification"),
            { target: { value: "Late medical certificate submitted" } },
        );
        await user.click(within(pastDialog).getByRole("button", { name: /save changes/i }));

        // Verify Audit Trail appears in Hoàng Phương Bình's Attendance Logs modal & test Session-Level editing
        await user.click(within(attTable).getByRole("button", { name: "View Logs for Hoàng Phương Bình" }));
        const updatedLogsDialog = await screen.findByRole("dialog", {
            name: /Attendance Logs — Hoàng Phương Bình/i,
        });
        expect(within(updatedLogsDialog).queryByText("Quick Edit Attendance Counts")).not.toBeInTheDocument();
        const auditBadge = await within(updatedLogsDialog).findByTestId("audit-trail-session-4");
        expect(auditBadge).toHaveTextContent(
            /Updated from Present to Excused by Admin on .* — Reason: Late medical certificate submitted/i,
        );

        // Edit Session #1 status directly inside Session History -> requires Reason for Edit -> Save Changes recalculates totals
        await user.selectOptions(
            within(updatedLogsDialog).getByLabelText("Session #1 status"),
            "Late",
        );
        await user.click(within(updatedLogsDialog).getByRole("button", { name: /save changes/i }));
        expect(
            await within(updatedLogsDialog).findByText(
                /Reason for Edit is required when changing a past session's attendance status/i,
            ),
        ).toBeInTheDocument();

        fireEvent.change(
            within(updatedLogsDialog).getByLabelText("Reason for Edit"),
            { target: { value: "Verified bus delay" } },
        );
        await user.click(within(updatedLogsDialog).getByRole("button", { name: /save changes/i }));

        // 5. Click Back to Trainee List returns to Trainee List table
        await user.click(screen.getByRole("button", { name: /back to trainee list/i }));
        expect(await screen.findByRole("table", { name: "Trainee List" })).toBeInTheDocument();
    }, 30000);

    it("switches to Topic Mark view with dynamic H2 assessment columns, inline editing & validation, live GPA calculation, Account handle generation, dynamic Excel template, and live Trainee List sync", async () => {
        expect(
            resolveTraineeAccount(
                { id: 1, fullName: "Vũ Mai Trang", fptAccount: "AI237193" } as Trainee,
                0,
            ),
        ).toBe("trangvm1");
        expect(
            resolveTraineeAccount(
                { id: 2, fullName: "Phan Phú Dũng", fptAccount: "IA506908" } as Trainee,
                1,
            ),
        ).toBe("dungpp2");

        let dynamicTopicMarksDb: {
            classId: number;
            passThreshold: number;
            topics: Array<{
                code: string;
                name: string;
                title: string;
                totalWeight: number;
                weightValid: boolean;
                columns: Array<{ key: string; name: string; weight: number }>;
                recordsByTraineeId: Record<
                    string,
                    {
                        traineeId: number;
                        componentScores: Record<string, number>;
                        totalGpa: number;
                        passed: boolean;
                    }
                >;
            }>;
        } = {
            classId: 2,
            passThreshold: 6.0,
            topics: [
                {
                    code: "JAVA_CORE",
                    name: "Java Core & OOP",
                    title: "1. [JAVA_CORE] Java Core & OOP",
                    totalWeight: 100,
                    weightValid: true,
                    columns: [
                        { key: "assessment_101", name: "Quiz", weight: 20 },
                        { key: "assessment_102", name: "Lab Practice", weight: 30 },
                        { key: "assessment_103", name: "Final Practical", weight: 50 },
                    ],
                    recordsByTraineeId: {
                        "101": {
                            traineeId: 101,
                            componentScores: { assessment_101: 8.5, assessment_102: 8.0, assessment_103: 8.2 },
                            totalGpa: 8.2,
                            passed: true,
                        },
                        "102": {
                            traineeId: 102,
                            componentScores: { assessment_101: 5.0, assessment_102: 5.5, assessment_103: 5.0 },
                            totalGpa: 5.2,
                            passed: false,
                        },
                    },
                },
                {
                    code: "SPRING_BOOT",
                    name: "Spring Boot Enterprise",
                    title: "2. [SPRING_BOOT] Spring Boot Enterprise",
                    totalWeight: 100,
                    weightValid: true,
                    columns: [
                        { key: "assessment_201", name: "Mini Quiz", weight: 10 },
                        { key: "assessment_202", name: "REST API Lab", weight: 25 },
                        { key: "assessment_203", name: "Midterm Review", weight: 25 },
                        { key: "assessment_204", name: "Capstone Defense", weight: 40 },
                    ],
                    recordsByTraineeId: {
                        "101": {
                            traineeId: 101,
                            componentScores: {
                                assessment_201: 8.0,
                                assessment_202: 8.0,
                                assessment_203: 8.0,
                                assessment_204: 8.0,
                            },
                            totalGpa: 8.0,
                            passed: true,
                        },
                    },
                },
            ],
        };

        fakeHttp.on("get", "/external/classes/2/topic-marks", () => dynamicTopicMarksDb);
        fakeHttp.on("put", "/external/classes/2/topic-marks", (call: RecordedCall) => {
            const payload = call.data as {
                topicCode: string;
                recordsByTraineeId: Record<string, { componentScores: Record<string, number> }>;
            };
            dynamicTopicMarksDb = {
                ...dynamicTopicMarksDb,
                topics: dynamicTopicMarksDb.topics.map((t) => {
                    if (t.code !== payload.topicCode) return t;
                    const updatedRecs: Record<
                        string,
                        {
                            traineeId: number;
                            componentScores: Record<string, number>;
                            totalGpa: number;
                            passed: boolean;
                        }
                    > = { ...t.recordsByTraineeId };
                    for (const [tid, rec] of Object.entries(payload.recordsByTraineeId)) {
                        updatedRecs[tid] = {
                            traineeId: Number(tid),
                            componentScores: rec.componentScores,
                            totalGpa: 9.0,
                            passed: true,
                        };
                    }
                    return { ...t, recordsByTraineeId: updatedRecs };
                }),
            };
            return dynamicTopicMarksDb;
        });

        const { user } = renderClassFlow("/classes/2");
        await screen.findByText("Hoàng Phương Bình");

        // 1. Live sync test: change Hoàng Phương Bình status to Inactive in Trainee List first
        await user.click(screen.getByRole("checkbox", { name: "Select Hoàng Phương Bình" }));
        await user.click(screen.getByRole("button", { name: /change status/i }));
        await user.click(await screen.findByRole("menuitem", { name: /inactive/i }));

        // 2. Open Topic Mark view
        await user.click(screen.getByRole("button", { name: "Topic Mark" }));
        const view = await screen.findByTestId("topic-mark-view");
        expect(within(view).getByRole("heading", { name: "Topic Mark HCM26_FR_JAVA_03" })).toBeInTheDocument();

        // 3. Verify 3 action buttons on top right & Topic Code selector hydrated with JAVA_CORE
        expect(within(view).getByRole("button", { name: /download template/i })).toBeInTheDocument();
        expect(within(view).getByRole("button", { name: /import mark/i })).toBeInTheDocument();
        expect(within(view).getByRole("button", { name: /export mark/i })).toBeInTheDocument();

        const topicSelect = within(view).getByLabelText("Topic Code") as HTMLSelectElement;
        await waitFor(() => expect(topicSelect.value).toBe("JAVA_CORE"));

        const topicTable = within(view).getByRole("table", { name: "Topic Mark Table" });
        const javaHeaders = within(topicTable).getAllByRole("columnheader").map((h) => h.textContent?.trim());
        expect(javaHeaders).toEqual([
            "No",
            "Full Name",
            "Personal Email",
            "Account",
            "Status",
            "Quiz (20%)",
            "Lab Practice (30%)",
            "Final Practical (50%)",
            "Total Topic GPA",
        ]);

        // Verify live Trainee List sync, Account generation & GPA failure highlighting
        const rows = within(topicTable).getAllByRole("row").slice(1);
        expect(rows).toHaveLength(10);
        const row1Cells = within(rows[0]).getAllByRole("cell");
        expect(row1Cells[1]).toHaveTextContent("Hoàng Phương Bình");
        expect(row1Cells[3]).toHaveTextContent("binhhp1");
        expect(row1Cells[4]).toHaveTextContent("Inactive"); // Synced from Trainee List!
        expect(within(view).getByTestId("gpa-cell-101")).toHaveTextContent("8.2");

        expect(within(view).getByTestId("gpa-cell-102")).toHaveTextContent("5.2");
        expect(within(view).getByTestId("gpa-cell-102")).toHaveClass("bg-red-50", "text-red-700", "font-semibold");

        // 4. Switch Topic Code to SPRING_BOOT -> columns morph dynamically to 4 assessments
        await user.selectOptions(topicSelect, "SPRING_BOOT");
        const springHeaders = within(topicTable).getAllByRole("columnheader").map((h) => h.textContent?.trim());
        expect(springHeaders).toEqual([
            "No",
            "Full Name",
            "Personal Email",
            "Account",
            "Status",
            "Mini Quiz (10%)",
            "REST API Lab (25%)",
            "Midterm Review (25%)",
            "Capstone Defense (40%)",
            "Total Topic GPA",
        ]);

        // 5. Inline edit validation: entering 12 disables Save Marks & shows validation alert
        const capstoneInput = within(topicTable).getByLabelText("Capstone Defense score for Hoàng Phương Bình");
        fireEvent.change(capstoneInput, { target: { value: "12" } });
        expect(await within(view).findByRole("alert")).toHaveTextContent(/between 0 and 10/i);
        const saveMarksBtn = within(view).getByRole("button", { name: /save marks/i });
        expect(saveMarksBtn).toBeDisabled();

        // Enter valid 9.5 -> live GPA recalculates (8*0.1 + 8*0.25 + 8*0.25 + 9.5*0.4 = 8.6) and Save Marks enables
        fireEvent.change(capstoneInput, { target: { value: "9.5" } });
        expect(within(view).getByTestId("gpa-cell-101")).toHaveTextContent("8.6");
        expect(saveMarksBtn).toBeEnabled();

        await user.click(saveMarksBtn);
        await waitFor(() => {
            expect(fakeHttp.callsTo("put", "/external/classes/2/topic-marks")).toHaveLength(1);
        });

        // 6. Download dynamic Template on SPRING_BOOT -> includes all 4 dynamic columns
        await user.click(within(view).getByRole("button", { name: /download template/i }));
        expect(XLSX.writeFile).toHaveBeenCalled();
        const templateBook = vi.mocked(XLSX.writeFile).mock.calls[
            vi.mocked(XLSX.writeFile).mock.calls.length - 1
        ][0];
        const templateRows = XLSX.utils.sheet_to_json<string[]>(templateBook.Sheets["Topic Mark Template"], {
            header: 1,
        });
        expect(templateRows[0]).toEqual([
            "No",
            "Full Name",
            "Personal Email",
            "Account",
            "Topic Code",
            "Mini Quiz (10%)",
            "REST API Lab (25%)",
            "Midterm Review (25%)",
            "Capstone Defense (40%)",
            "Total Topic GPA",
        ]);

        // 7. Return to Trainee List
        await user.click(within(view).getByRole("button", { name: /back to trainee list/i }));
        expect(await screen.findByRole("table", { name: "Trainee List" })).toBeInTheDocument();
    }, 20000);

    it("renders 360-degree Trainee Profile with Personal Info, Attendance, Academic Results tabs, peer switcher, Excel export, and view shortcuts", async () => {
        const activeClass = {
            ...MOCK_TRAINING_CLASSES[0],
            startDate: "2026-05-23",
            endDate: "2099-12-31",
            expectedStartDate: "2026-05-23",
            expectedEndDate: "2099-12-31",
        };
        fakeHttp.on("get", "/external/classes/2", activeClass);
        fakeHttp.on("get", "/classes/2", activeClass);

        const { user } = renderClassFlow("/classes/2");
        await screen.findByText("Trần Việt Anh");

        // 1. Open 360-degree Trainee Profile for Trần Việt Anh (index 1: 5% absent Eligible, Overall GPA 5.3 Not Qualified)
        await user.click(screen.getByRole("button", { name: "Trần Việt Anh" }));
        const profileDialog = await screen.findByRole("dialog", { name: "Trainee Profile" });

        expect(within(profileDialog).getByTestId("hero-attendance-kpi")).toHaveTextContent("19/20");
        expect(within(profileDialog).getByTestId("hero-attendance-kpi")).toHaveTextContent("Eligible");
        expect(within(profileDialog).getByTestId("hero-gpa-kpi")).toHaveTextContent("5.3");
        expect(within(profileDialog).getByTestId("hero-readiness-kpi")).toHaveTextContent("Not Qualified");

        // Personal Info tab (default)
        expect(within(profileDialog).getByText("anhviettran357@gmail.com")).toBeInTheDocument();
        expect(within(profileDialog).getByText("anhtv2")).toBeInTheDocument();

        // 2. Switch to Attendance tab & filter Non-Present sessions
        await user.click(within(profileDialog).getByRole("tab", { name: /attendance/i }));
        const attHistoryTable = await within(profileDialog).findByRole("table", {
            name: "Trainee Profile Attendance History",
        });
        expect(within(attHistoryTable).getAllByRole("row").slice(1)).toHaveLength(20);
        expect(within(profileDialog).getByText("19 / 20")).toBeInTheDocument();

        await user.click(within(profileDialog).getByRole("button", { name: /Non-Present \(2\)/i }));
        expect(within(attHistoryTable).getAllByRole("row").slice(1)).toHaveLength(2);

        // 3. Switch to Academic Results tab & verify all 4 topics
        await user.click(within(profileDialog).getByRole("tab", { name: /academic results/i }));
        const academicTable = await within(profileDialog).findByRole("table", {
            name: "Trainee Profile Academic Results",
        });
        for (const code of ["L1_AL_PSE", "L2_OOP_JAVA", "L3_SPRING_BOOT", "L4_DATABASE"]) {
            expect(within(academicTable).getByText(code)).toBeInTheDocument();
        }
        expect(within(academicTable).getAllByText("Failed").length).toBe(4);

        // 4. Switch to Previous trainee (Hoàng Phương Bình -> Qualified, 4 Passed topics) while staying on Academic tab
        await user.click(within(profileDialog).getByRole("button", { name: "Previous trainee" }));
        expect(within(profileDialog).getByTestId("profile-360-hero")).toHaveTextContent("Hoàng Phương Bình");
        expect(within(profileDialog).getByTestId("hero-readiness-kpi")).toHaveTextContent("Qualified");
        expect(within(academicTable).getAllByText("Passed").length).toBe(4);

        // 5. Export 360-degree Excel Report (3 worksheets)
        await user.click(within(profileDialog).getByRole("button", { name: /export 360° report/i }));
        expect(XLSX.writeFile).toHaveBeenCalled();
        const exportedBook = vi.mocked(XLSX.writeFile).mock.calls[
            vi.mocked(XLSX.writeFile).mock.calls.length - 1
        ][0];
        expect(exportedBook.SheetNames).toEqual([
            "Profile Overview",
            "Attendance History",
            "Academic Results",
        ]);

        // 6. Use Open Topic Marks shortcut -> closes modal & switches to Topic Mark view
        await user.click(within(profileDialog).getByRole("button", { name: /open topic marks/i }));
        expect(await screen.findByTestId("topic-mark-view")).toBeInTheDocument();
        expect(screen.queryByRole("dialog", { name: "Trainee Profile" })).not.toBeInTheDocument();
    }, 20000);

    it("supports locking Topic Marks with a 4-digit PIN, disables editing/importing while locked, enforces 3-attempt progressive cooldown, and unlocks with valid PIN", async () => {
        let lockedTopic1 = false;
        let lockedTopic2 = true;
        let failedAttempts1 = 0;
        let lockoutTier1 = 0;
        const issuedPin1 = "4829";
        const issuedPin2 = "7315";

        const buildGradebook = () => ({
            classId: 2,
            passThreshold: 6.0,
            topics: [
                {
                    code: "JAVA_CORE",
                    name: "Java Core",
                    totalWeight: 100,
                    weightValid: true,
                    columns: [
                        { key: "assessment_101", name: "Quiz", weight: 40 },
                        { key: "assessment_102", name: "Final", weight: 60 },
                    ],
                    recordsByTraineeId: {
                        "101": {
                            traineeId: 101,
                            componentScores: { assessment_101: 8.5, assessment_102: 8.5 },
                            totalGpa: 8.5,
                            passed: true,
                        },
                    },
                    lock: {
                        locked: lockedTopic1,
                        lockedBy: lockedTopic1 ? "admin@example.com" : "",
                        lockedAt: lockedTopic1 ? "25-Nov-2026 15:00:00" : "",
                        failedAttempts: failedAttempts1,
                        remainingAttempts: 3 - failedAttempts1,
                        maxAttempts: 3,
                        lockoutTier: lockoutTier1,
                        cooldownUntilEpochMs: lockoutTier1 > 0 ? Date.now() + 60_000 : null,
                        cooldownSecondsRemaining: lockoutTier1 > 0 ? 60 : 0,
                    },
                },
                {
                    code: "SPRING_BOOT",
                    name: "Spring Boot",
                    totalWeight: 100,
                    weightValid: true,
                    columns: [{ key: "assessment_201", name: "Capstone", weight: 100 }],
                    recordsByTraineeId: {
                        "101": {
                            traineeId: 101,
                            componentScores: { assessment_201: 9.0 },
                            totalGpa: 9.0,
                            passed: true,
                        },
                    },
                    lock: {
                        locked: lockedTopic2,
                        lockedBy: "admin@example.com",
                        lockedAt: "25-Nov-2026 14:55:00",
                        failedAttempts: 0,
                        remainingAttempts: 3,
                        maxAttempts: 3,
                        lockoutTier: 0,
                        cooldownUntilEpochMs: null,
                        cooldownSecondsRemaining: 0,
                    },
                },
            ],
        });

        fakeHttp.on("get", "/external/classes/2/topic-marks", () => buildGradebook());
        fakeHttp.on("post", "/external/classes/2/topic-marks/lock", (call: RecordedCall) => {
            const body = call.data as { topicCode: string };
            if (body.topicCode === "JAVA_CORE") {
                lockedTopic1 = true;
                failedAttempts1 = 0;
                lockoutTier1 = 0;
            }
            const gradebook = buildGradebook();
            return {
                locked: true,
                topicCode: body.topicCode,
                pin: issuedPin1,
                lock: gradebook.topics[0].lock,
                gradebook,
            };
        });
        fakeHttp.on("post", "/external/classes/2/topic-marks/unlock", (call: RecordedCall) => {
            const body = call.data as { topicCode: string; pin: string };
            if (body.topicCode === "JAVA_CORE") {
                if (body.pin !== issuedPin1) {
                    failedAttempts1 += 1;
                    if (failedAttempts1 >= 3) {
                        lockoutTier1 += 1;
                        failedAttempts1 = 0;
                        const lock = {
                            locked: true,
                            lockedBy: "admin@example.com",
                            lockedAt: "25-Nov-2026 15:00:00",
                            failedAttempts: 0,
                            remainingAttempts: 0,
                            maxAttempts: 3,
                            lockoutTier: lockoutTier1,
                            cooldownUntilEpochMs: Date.now() + 60_000,
                            cooldownSecondsRemaining: 60,
                        };
                        throw httpError(429, {
                            unlocked: false,
                            httpStatus: 429,
                            cooldownActive: true,
                            penaltyMinutes: 1,
                            topicCode: body.topicCode,
                            message: "Incorrect PIN entered 3 times. Locked for 1 minute(s).",
                            lock,
                        });
                    }
                    const remaining = 3 - failedAttempts1;
                    throw httpError(400, {
                        unlocked: false,
                        httpStatus: 400,
                        cooldownActive: false,
                        topicCode: body.topicCode,
                        message: `Incorrect 4-digit PIN. ${remaining} attempt(s) remaining before temporary lockout.`,
                        lock: {
                            locked: true,
                            lockedBy: "admin@example.com",
                            lockedAt: "25-Nov-2026 15:00:00",
                            failedAttempts: failedAttempts1,
                            remainingAttempts: remaining,
                            maxAttempts: 3,
                            lockoutTier: lockoutTier1,
                            cooldownUntilEpochMs: null,
                            cooldownSecondsRemaining: 0,
                        },
                    });
                }
            } else if (body.topicCode === "SPRING_BOOT" && body.pin === issuedPin2) {
                lockedTopic2 = false;
                const gradebook = buildGradebook();
                return {
                    unlocked: true,
                    httpStatus: 200,
                    topicCode: "SPRING_BOOT",
                    message: "Unlocked Topic Marks for SPRING_BOOT.",
                    lock: gradebook.topics[1].lock,
                    gradebook,
                };
            }
            throw httpError(400, { message: "Incorrect PIN." });
        });

        const { user } = renderClassFlow("/classes/2");
        await screen.findByText("Hoàng Phương Bình");

        await user.click(screen.getByRole("button", { name: "Topic Mark" }));
        const view = await screen.findByTestId("topic-mark-view");
        const topicSelect = within(view).getByLabelText("Topic Code") as HTMLSelectElement;
        await waitFor(() => expect(topicSelect.value).toBe("JAVA_CORE"));

        // 1. Lock JAVA_CORE -> Confirm & verify issued 4-digit PIN dialog
        await user.click(within(view).getByRole("button", { name: /^lock marks$/i }));
        const confirmDialog = await screen.findByRole("dialog", { name: /Lock Topic Marks \(JAVA_CORE\)/i });
        await user.click(within(confirmDialog).getByRole("button", { name: /confirm & generate pin/i }));

        const issuedPinDialog = await screen.findByRole("dialog", { name: /Security PIN Generated \(JAVA_CORE\)/i });
        expect(within(issuedPinDialog).getByTestId("issued-pin-code")).toHaveTextContent("4829");
        await user.click(within(issuedPinDialog).getByRole("button", { name: /^done$/i }));

        // 2. While locked: Lock badge + locked banner appear, score inputs & Import Mark are disabled
        expect(within(view).getByTestId("topic-lock-badge")).toHaveTextContent("Marks Locked");
        expect(within(view).getByTestId("topic-locked-banner")).toBeInTheDocument();
        expect(within(view).getByRole("button", { name: /import mark/i })).toBeDisabled();
        expect(
            within(view).getByLabelText("Quiz score for Hoàng Phương Bình"),
        ).toBeDisabled();

        // 3. Try unlocking JAVA_CORE with wrong PIN 3 times -> triggers 1m cooldown banner
        await user.click(within(view).getAllByRole("button", { name: /^unlock marks$/i })[0]);
        const unlockDialog = await screen.findByRole("dialog", { name: /Unlock Topic Marks \(JAVA_CORE\)/i });
        const pinField = within(unlockDialog).getByLabelText("4-Digit Security PIN");

        await user.type(pinField, "0000");
        await user.click(within(unlockDialog).getByRole("button", { name: /^unlock$/i }));
        expect(await within(unlockDialog).findByTestId("pin-remaining-attempts")).toHaveTextContent("2 / 3");

        await user.type(pinField, "1111");
        await user.click(within(unlockDialog).getByRole("button", { name: /^unlock$/i }));
        expect(await within(unlockDialog).findByTestId("pin-remaining-attempts")).toHaveTextContent("1 / 3");

        await user.type(pinField, "2222");
        await user.click(within(unlockDialog).getByRole("button", { name: /^unlock$/i }));
        expect(await within(unlockDialog).findByTestId("pin-lockout-banner")).toHaveTextContent(/Temporarily Locked \(Tier 1\)/i);
        expect(within(unlockDialog).getByRole("button", { name: /^unlock$/i })).toBeDisabled();
        await user.click(within(unlockDialog).getByRole("button", { name: /^cancel$/i }));

        // 4. Switch to locked SPRING_BOOT & unlock cleanly with valid PIN "7315"
        await user.selectOptions(topicSelect, "SPRING_BOOT");
        expect(within(view).getByLabelText("Capstone score for Hoàng Phương Bình")).toBeDisabled();
        await user.click(within(view).getAllByRole("button", { name: /^unlock marks$/i })[0]);
        const unlockSpringDialog = await screen.findByRole("dialog", { name: /Unlock Topic Marks \(SPRING_BOOT\)/i });
        await user.type(within(unlockSpringDialog).getByLabelText("4-Digit Security PIN"), issuedPin2);
        await user.click(within(unlockSpringDialog).getByRole("button", { name: /^unlock$/i }));

        await waitFor(() =>
            expect(within(view).getByTestId("topic-lock-badge")).toHaveTextContent("Editable"),
        );
        expect(within(view).getByLabelText("Capstone score for Hoàng Phương Bình")).toBeEnabled();
    }, 20000);
});
