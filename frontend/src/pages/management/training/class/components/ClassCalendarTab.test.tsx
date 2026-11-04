import { screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeHttp, httpError } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import { ClassCalendarTab } from "./ClassCalendarTab";

vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));

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
