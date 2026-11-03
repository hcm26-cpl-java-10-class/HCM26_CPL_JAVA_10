import { screen, within } from "@testing-library/react";
import { useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp, httpError, networkError } from "@/test/fake-http";
import { renderRoutes } from "@/test/render";
import type { ExternalClass } from "@/types";
import ClassListPage from "./ClassListPage";

vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));

const STATUSES = ["active", "completed", "planning", "assigned", "pending_close"];

// 23 classes: 3 pages of 10; status cycles through 5 values and program through 3
const classes: ExternalClass[] = Array.from({ length: 23 }, (_, index) => ({
    id: index + 1,
    code: `FSJ_${String(index + 1).padStart(2, "0")}`,
    name: `Java Batch ${index + 1}`,
    programId: (index % 3) + 1,
    startDate: `2026-${String((index % 12) + 1).padStart(2, "0")}-15`,
    status: STATUSES[index % STATUSES.length],
    plannedSize: 20 + index,
}));

function DetailStub() {
    return <div>class detail {useParams().classId}</div>;
}

function renderList(route = "/classes") {
    return renderRoutes(
        [
            { path: "/classes", element: <ClassListPage /> },
            { path: "/classes/:classId", element: <DetailStub /> },
            { path: "/sessions", element: <div>sessions page</div> },
        ],
        { route },
    );
}

const rowsOf = async () => within(await screen.findByRole("table", { name: "Classes" })).getAllByRole("row").slice(1);
const rowCodes = async () => (await rowsOf()).map((row) => within(row).getByRole("link", { name: /^FSJ_/ }).textContent);

beforeEach(() => {
    fakeHttp.reset();
    fakeHttp.on("get", "/external/classes", classes);
});

describe("Class List: loading data", () => {
    it("renders the classes the API returned, one page at a time, with the total", async () => {
        renderList();

        const rows = await rowsOf();
        expect(rows).toHaveLength(10);
        expect(screen.getByText("23 classes")).toBeInTheDocument();
        expect(screen.getByText("Showing 1–10 of 23 classes")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "FSJ_01" })).toHaveAttribute("href", "/classes/1");
        expect(within(rows[0]).getByText("In progress")).toBeInTheDocument();
        expect(within(rows[0]).getByText("Program #1")).toBeInTheDocument();
    });

    it("asks the backend for classes of every status, not only the active ones", async () => {
        renderList();
        await rowsOf();

        expect(fakeHttp.callsTo("get", "/external/classes")[0].params).toEqual({ status: "all" });
    });

    it("shows a column the master system does not provide as a dash, never as an invented value", async () => {
        renderList();

        const cells = within((await rowsOf())[0]).getAllByRole("cell");
        // No., Class, Site, Trainee Type, Program, Class Admin, Trainees, Start Date, Master Trainer, Status, Action
        expect(cells).toHaveLength(11);
        for (const index of [2, 3, 5, 8]) {
            expect(cells[index]).toHaveTextContent("—");
        }
        expect(cells[6]).toHaveTextContent("— / 20");
        expect(cells[7]).toHaveTextContent("15-Jan-2026");
    });

    it("shows a loading skeleton while the request is in flight", async () => {
        let release: (value: unknown) => void = () => {};
        fakeHttp.on("get", "/external/classes", () => new Promise((resolve) => (release = resolve)));
        renderList();

        expect(await screen.findByRole("status", { name: "Loading classes" })).toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();

        release(classes);
        expect(await screen.findByRole("table", { name: "Classes" })).toBeInTheDocument();
        expect(screen.queryByRole("status", { name: "Loading classes" })).not.toBeInTheDocument();
    });

    it("shows an empty state (not an error, not a 404) when the master system has no classes", async () => {
        fakeHttp.on("get", "/external/classes", []);
        renderList();

        expect(await screen.findByText("The master training system has no classes yet.")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.getByTestId("location")).toHaveTextContent("/classes");
    });

    it("shows the error state with a working retry when the master system is down", async () => {
        let down = true;
        fakeHttp.on("get", "/external/classes", () => {
            if (down) throw httpError(503);
            return classes;
        });
        const { user } = renderList();

        expect(await screen.findByRole("alert")).toHaveTextContent("Master training system unavailable");
        expect(screen.getByText("Could not load")).toBeInTheDocument();

        down = false;
        await user.click(screen.getByRole("button", { name: /try again/i }));

        expect(await screen.findByRole("table", { name: "Classes" })).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it.each([
        ["403", httpError(403), "Access denied"],
        ["401", httpError(401), "Session expired"],
        ["500", httpError(500), "Server error"],
        ["network", networkError(), "Cannot reach the server"],
    ])("tells a %s apart from an empty list", async (_name, error, title) => {
        fakeHttp.on("get", "/external/classes", () => {
            throw error;
        });
        renderList();

        expect(await screen.findByRole("alert")).toHaveTextContent(title);
        expect(screen.queryByText("The master training system has no classes yet.")).not.toBeInTheDocument();
    });
});

describe("Class List: search, filter, sort, pagination", () => {
    it("searches as you type and reports how many of the classes match", async () => {
        const { user } = renderList();
        await rowsOf();

        await user.type(screen.getByLabelText("Search classes"), "fsj_07");

        expect(await rowCodes()).toEqual(["FSJ_07"]);
        expect(screen.getByText("1 class of 23")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Clear search" }));
        expect(await rowsOf()).toHaveLength(10);
        expect(screen.getByText("23 classes")).toBeInTheDocument();
    });

    it("filters by status and program, shows how many filters are on, and clears them", async () => {
        const { user } = renderList();
        await rowsOf();
        const filterButton = screen.getByRole("button", { name: /^filter/i });
        expect(within(filterButton).queryByText("1")).not.toBeInTheDocument();

        await user.click(filterButton);
        await user.selectOptions(screen.getByLabelText("Status"), "Planning");

        expect(await rowCodes()).toEqual(["FSJ_03", "FSJ_08", "FSJ_13", "FSJ_18", "FSJ_23"]);
        expect(within(filterButton).getByText("1")).toBeInTheDocument();
        expect(screen.getByText("5 classes of 23")).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText("Program"), "Program #2");
        expect(await rowCodes()).toEqual(["FSJ_08", "FSJ_23"]);
        expect(within(filterButton).getByText("2")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Clear search and filters" }));
        expect(await rowsOf()).toHaveLength(10);
        expect(within(filterButton).queryByText("2")).not.toBeInTheDocument();
    });

    it("only offers the statuses that actually exist in the data", async () => {
        const { user } = renderList();
        await rowsOf();

        await user.click(screen.getByRole("button", { name: /^filter/i }));

        const options = within(screen.getByLabelText("Status")).getAllByRole("option").map((option) => option.textContent);
        expect(options).toEqual(["All statuses", "Assigned", "In progress", "Pending close", "Planning", "Training completed"]);
    });

    it("shows a 'no match' state with a way out when nothing matches", async () => {
        const { user } = renderList();
        await rowsOf();

        await user.type(screen.getByLabelText("Search classes"), "zzzz");

        expect(await screen.findByText("No classes match your search or filters.")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Clear search and filters" }));
        expect(await rowsOf()).toHaveLength(10);
    });

    it("sorts by a column and flips the direction on the second click", async () => {
        const { user } = renderList();
        const [firstBefore] = await rowCodes();
        expect(firstBefore).toBe("FSJ_01");
        expect(screen.getByRole("columnheader", { name: "Class" })).toHaveAttribute("aria-sort", "ascending");

        await user.click(screen.getByRole("button", { name: "Class" }));
        expect((await rowCodes())[0]).toBe("FSJ_23");
        expect(screen.getByRole("columnheader", { name: "Class" })).toHaveAttribute("aria-sort", "descending");

        await user.click(screen.getByRole("button", { name: "Class" }));
        expect((await rowCodes())[0]).toBe("FSJ_01");
    });

    it("sorts by the number of trainees", async () => {
        const { user } = renderList();
        await rowsOf();

        await user.click(screen.getByRole("button", { name: "Trainees" }));
        await user.click(screen.getByRole("button", { name: "Trainees" }));

        expect((await rowCodes())[0]).toBe("FSJ_23");
    });

    it("pages through the list and lets the user change the page size", async () => {
        const { user } = renderList();
        await rowsOf();
        expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "Next" }));
        expect(await rowCodes()).toEqual(Array.from({ length: 10 }, (_, i) => `FSJ_${i + 11}`));
        expect(screen.getByText("Showing 11–20 of 23 classes")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Next" }));
        expect(await rowCodes()).toEqual(["FSJ_21", "FSJ_22", "FSJ_23"]);
        expect(screen.getByText("Showing 21–23 of 23 classes")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

        await user.selectOptions(screen.getByLabelText("Rows per page"), "20");
        expect(await rowsOf()).toHaveLength(20);
        expect(screen.getByText("Showing 1–20 of 23 classes")).toBeInTheDocument();
        expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    it("goes back to the first page when the search changes", async () => {
        const { user } = renderList("/classes?page=3");
        expect(await rowCodes()).toEqual(["FSJ_21", "FSJ_22", "FSJ_23"]);

        await user.type(screen.getByLabelText("Search classes"), "fsj");

        expect(await rowsOf()).toHaveLength(10);
        expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    it("restores the whole view from the URL (search, filter, page) and clamps a page that is out of range", async () => {
        const first = renderList("/classes?q=fsj_0&status=In%20progress");
        expect(await rowCodes()).toEqual(["FSJ_01", "FSJ_06"]);
        expect(screen.getByLabelText("Search classes")).toHaveValue("fsj_0");
        expect(within(screen.getByRole("button", { name: /^filter/i })).getByText("1")).toBeInTheDocument();
        first.unmount();

        renderList("/classes?page=9");
        expect(await rowCodes()).toEqual(["FSJ_21", "FSJ_22", "FSJ_23"]);
        expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    });
});

describe("Class List: navigation", () => {
    it("opens the details of exactly the class that was clicked", async () => {
        const { user } = renderList();
        await rowsOf();

        await user.click(screen.getByRole("link", { name: "FSJ_05" }));

        expect(screen.getByTestId("location")).toHaveTextContent("/classes/5");
        expect(await screen.findByText("class detail 5")).toBeInTheDocument();
    });

    it("offers details, calendar and sessions from the row menu, each keeping the class context", async () => {
        const { user } = renderList();
        await rowsOf();

        await user.click(screen.getByRole("button", { name: "Actions for FSJ_05" }));
        const menu = await screen.findByRole("menu");

        expect(within(menu).getByRole("menuitem", { name: /view details/i })).toHaveAttribute("href", "/classes/5");
        expect(within(menu).getByRole("menuitem", { name: /view calendar/i })).toHaveAttribute("href", "/classes/5?tab=calendar");
        expect(within(menu).getByRole("menuitem", { name: /view sessions/i })).toHaveAttribute("href", "/sessions?classId=5");

        await user.click(within(menu).getByRole("menuitem", { name: /view sessions/i }));
        expect(screen.getByTestId("location")).toHaveTextContent("/sessions?classId=5");
    });

    it("offers no create / edit / delete controls, because the master system exposes no such API", async () => {
        renderList();
        await rowsOf();

        expect(screen.queryByRole("button", { name: /create class/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /delete|deactivate/i })).not.toBeInTheDocument();
    });
});
