import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderRoutes } from "@/test/render";
import ClassListPage from "../ClassListPage";
import ClassDetailPage from "../ClassDetailPage";
import { MOCK_TRAINING_CLASSES, getMockTraineesByClass } from "../mocks/classTrainee.mock";

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

beforeEach(() => {
    fakeHttp.reset();
    grant("SESSION_READ");
    fakeHttp.on("get", "/external/classes", MOCK_TRAINING_CLASSES);
    fakeHttp.on("get", "/external/classes/2", MOCK_TRAINING_CLASSES[0]);
    fakeHttp.on("get", "/external/classes/2/trainees", getMockTraineesByClass(2));
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
        expect(within(menu).getByRole("menuitem", { name: /edit trainee/i })).toBeInTheDocument();
        expect(within(menu).getByRole("menuitem", { name: /remove from class/i })).toBeInTheDocument();

        // Topic Mark navigation
        await user.click(screen.getByRole("button", { name: "Topic Mark" }));
        expect(await screen.findByText("Topic Mark Gradebook Page")).toBeInTheDocument();
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
