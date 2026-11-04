import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TraineeBatchPayload } from "@/api/features/trainee.api";
import { fakeHttp, type RecordedCall } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderRoutes } from "@/test/render";
import type { Trainee } from "@/types";
import ClassDetailPage from "../ClassDetailPage";
import ClassListPage from "../ClassListPage";
import { getMockTraineesByClass, MOCK_TRAINING_CLASSES } from "../mocks/classTrainee.mock";

vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));

function renderClassFlow(route = "/classes/2") {
    return renderRoutes(
        [
            { path: "/classes", element: <ClassListPage /> },
            { path: "/classes/:classId", element: <ClassDetailPage /> },
            { path: "/training-operations/class-details/:classCode", element: <ClassDetailPage /> },
            { path: "/topic-marks/gradebook-demo", element: <div>Topic Mark Gradebook Page</div> },
        ],
        { route },
    );
}

let serverTraineesState: Trainee[] = [];

beforeEach(() => {
    fakeHttp.reset();
    grant("SESSION_READ");
    serverTraineesState = getMockTraineesByClass(2);
    fakeHttp.on("get", "/external/classes", MOCK_TRAINING_CLASSES);
    fakeHttp.on("get", "/external/classes/2", MOCK_TRAINING_CLASSES[0]);
    fakeHttp.on("get", "/external/classes/2/trainees", () => serverTraineesState);
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

    it("renders all 12 Trainee List columns, searches trainees, selects checkboxes, and navigates on Topic Mark", async () => {
        const { user } = renderClassFlow("/classes/2");

        const table = await screen.findByRole("table", { name: "Trainee List" });
        const headers = within(table).getAllByRole("columnheader");
        expect(headers).toHaveLength(12);
        expect(headers.slice(1).map((h) => h.textContent)).toEqual([
            "No.",
            "Full Name",
            "FPT Student Account",
            "Personal Email",
            "National ID",
            "Employee ID",
            "Access Card ID",
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
        expect(firstRowCells[3]).toHaveTextContent("binhhp1");
        expect(firstRowCells[4]).toHaveTextContent("phuongbinh.conan@gmail.com");
        expect(firstRowCells[5]).toHaveTextContent("075204005839");
        expect(firstRowCells[8]).toHaveTextContent("23-Aug-2004");
        expect(firstRowCells[9]).toHaveTextContent("Male");
        expect(firstRowCells[10]).toHaveTextContent("Active");

        // Select all & individual selection
        const selectAll = screen.getByRole("checkbox", { name: "Select all trainees" });
        await user.click(selectAll);
        expect(screen.getByRole("checkbox", { name: "Select Hoàng Phương Bình" })).toBeChecked();

        // Filter trainees via search input
        const searchInput = screen.getByPlaceholderText("Search trainees");
        await user.type(searchInput, "anhtv68");
        const filteredRows = within(table).getAllByRole("row").slice(1);
        expect(filteredRows).toHaveLength(1);
        expect(within(filteredRows[0]).getByText("Trần Việt Anh")).toBeInTheDocument();

        // Row action menu (3 vertical dots)
        await user.click(screen.getByRole("button", { name: "Actions for Trần Việt Anh" }));
        const menu = await screen.findByRole("menu");
        expect(within(menu).getByRole("menuitem", { name: /view profile/i })).toBeInTheDocument();
        expect(within(menu).getByRole("menuitem", { name: /^edit$/i })).toBeInTheDocument();
        expect(within(menu).getByRole("menuitem", { name: /^delete$/i })).toBeInTheDocument();

        // Topic Mark navigation
        await user.click(screen.getByRole("button", { name: "Topic Mark" }));
        expect(await screen.findByText("Topic Mark Gradebook Page")).toBeInTheDocument();
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
        expect(within(addDialog).getByText("FPT Student Account is required.")).toBeInTheDocument();
        expect(within(addDialog).getByText("Personal Email is required.")).toBeInTheDocument();
        expect(within(addDialog).getByText("National ID is required.")).toBeInTheDocument();

        // Fill valid new trainee
        await user.type(within(addDialog).getByLabelText(/Full Name/i), "Nguyễn Minh Khang");
        await user.type(within(addDialog).getByLabelText(/FPT Student Account/i), "khangnm9");
        await user.type(within(addDialog).getByLabelText(/Personal Email/i), "khang.nguyen@gmail.com");
        await user.type(within(addDialog).getByLabelText(/National ID/i), "079204009999");
        await user.type(within(addDialog).getByLabelText(/Employee ID/i), "FPT26099");
        await user.type(within(addDialog).getByLabelText(/Access Card ID/i), "AC-88299");
        await user.type(within(addDialog).getByLabelText(/^DOB$/i), "2004-10-15");
        await user.selectOptions(within(addDialog).getByLabelText(/^Gender$/i), "Male");
        await user.selectOptions(within(addDialog).getByLabelText(/^Status$/i), "Active");
        await user.click(within(addDialog).getByRole("button", { name: "Add Trainee" }));

        expect(await screen.findByText("Nguyễn Minh Khang")).toBeInTheDocument();
        expect(screen.getByText("15-Oct-2004")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();

        // 2. Edit an existing trainee ("Trần Việt Anh")
        await user.click(screen.getByRole("button", { name: "Actions for Trần Việt Anh" }));
        await user.click(await screen.findByRole("menuitem", { name: /^edit$/i }));

        const editDialog = await screen.findByRole("dialog", { name: "Edit Trainee" });
        const empInput = within(editDialog).getByLabelText(/Employee ID/i);
        await user.clear(empInput);
        await user.type(empInput, "FPT26002");
        await user.selectOptions(within(editDialog).getByLabelText(/^Status$/i), "Inactive");
        await user.click(within(editDialog).getByRole("button", { name: "Update Trainee" }));

        expect(await screen.findByText("FPT26002")).toBeInTheDocument();
        expect(screen.getByText("Inactive")).toBeInTheDocument();

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
        expect(sentPayload.created[0].fptAccount).toBe("khangnm9");
        expect(sentPayload.updated).toHaveLength(1);
        expect(sentPayload.updated[0].id).toBe(102);
        expect(sentPayload.updated[0].employeeId).toBe("FPT26002");
        expect(sentPayload.deletedIds).toEqual([104]);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
        });
    });

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
});
