import { screen, within, waitFor } from "@testing-library/react";
import { writeFile } from "xlsx";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeHttp, httpError } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import { ClassCalendarTab } from "./ClassCalendarTab";

vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));
vi.mock("xlsx", async (importOriginal) => ({ ...await importOriginal<typeof import("xlsx")>(), writeFile: vi.fn() }));

const records = [
    { id: 1, classId: 1, name: "Java_Calendar_1.1", version: "1.1", historyChange: "Initial plan", lastModifiedDate: "2026-01-01T09:00:00", lastModifiedBy: "Trainer", status: "inactive" },
    { id: 2, classId: 1, name: "Java_Calendar_1.2", version: "1.2", historyChange: "Update trainer", lastModifiedDate: "2026-02-01T09:00:00", lastModifiedBy: "Admin", status: "active" },
];

beforeEach(() => {
    fakeHttp.reset();
    grant("SESSION_READ");
    fakeHttp.on("get", "/external/classes/1/calendars", records);
});

it("shows newest versions first, filters statuses and opens version details", async () => {
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await screen.findByRole("button", { name: "Java_Calendar_1.2" });
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Java_Calendar_1.2");
    await user.click(screen.getByRole("button", { name: "Filter calendar status" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /^Inactive$/ }));
    expect(screen.queryByRole("button", { name: "Java_Calendar_1.1" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Java_Calendar_1.2" }));
    expect(within(screen.getByRole("dialog")).getByText("Update trainer")).toBeInTheDocument();
});

it("keeps column headers visible on API errors", async () => {
    fakeHttp.on("get", "/external/classes/1/calendars", () => { throw httpError(503); });
    renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await screen.findByRole("button", { name: /try again/i });
    expect(screen.getByRole("columnheader", { name: "Calendar Name" })).toBeInTheDocument();
    expect(screen.queryByText("Java_Calendar_1.2")).not.toBeInTheDocument();
});

it("does not request calendar data without read permission", async () => {
    grant();
    renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    expect(fakeHttp.callsTo("get", "/external/classes/1/calendars")).toHaveLength(0);
});

it("offers all five actions, downloads a workbook and saves staged adjustments", async () => {
    grant("SESSION_READ", "SESSION_UPDATE");
    fakeHttp.on("put", "/external/classes/1/calendars", {});
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await screen.findByRole("button", { name: "Java_Calendar_1.2" });
    await user.click(screen.getByRole("button", { name: "Actions for calendar version 1.2" }));
    for (const name of ["Detail", "Download", "Download with detailed time", "Overview", "Adjust"]) {
        expect(screen.getByRole("menuitem", { name: new RegExp(`^${name}$`) })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("menuitem", { name: /^Download$/ }));
    expect(writeFile).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Actions for calendar version 1.2" }));
    await user.click(screen.getByRole("menuitem", { name: "Adjust" }));
    await user.clear(screen.getByRole("textbox", { name: "History Change" }));
    await user.type(screen.getByRole("textbox", { name: "History Change" }), "Updated calendar plan");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")).toHaveLength(1));
    expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")[0].data).toEqual({ updates: [{ id: 2, name: "Java_Calendar_1.2", historyChange: "Updated calendar plan" }] });
});

it("opens the overview chart with topic date ranges and closes back to the calendar", async () => {
    fakeHttp.on("get", "/external/classes/1/calendars", [{ ...records[1], sessions: [
        { id: 1, classId: 1, date: "2026-05-25", topic: "Java" },
        { id: 2, classId: 1, date: "2026-06-02", topic: "Java" },
        { id: 3, classId: 1, date: "2026-05-26", topic: "React" },
        { id: 4, classId: 1, date: "2026-02-30", topic: "Invalid date" },
    ] }]);
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await user.click(await screen.findByRole("button", { name: "Actions for calendar version 1.2" }));
    await user.click(screen.getByRole("menuitem", { name: "Overview" }));
    const dialog = screen.getByRole("dialog", { name: "Calendar Overview Chart" });
    expect(within(dialog).getByRole("rowheader", { name: "Java" })).toBeInTheDocument();
    expect(within(dialog).getByRole("cell", { name: "25-May - 02-Jun, 2 sessions" })).toBeInTheDocument();
    expect(within(dialog).getByRole("cell", { name: "26-May, 1 session" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("rowheader", { name: "Invalid date" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Close calendar overview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Java_Calendar_1.2" })).toBeInTheDocument();
});
