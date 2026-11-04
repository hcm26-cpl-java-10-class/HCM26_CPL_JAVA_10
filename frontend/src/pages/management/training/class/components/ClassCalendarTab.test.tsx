import { screen, within, waitFor, fireEvent } from "@testing-library/react";
import { writeFile } from "xlsx";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeHttp, httpError } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import { ClassCalendarTab } from "./ClassCalendarTab";

vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("./ClassInfoTab", () => ({ ClassInfoTab: () => <div>Class information</div> }));
vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));
vi.mock("xlsx", async (importOriginal) => ({ ...await importOriginal<typeof import("xlsx")>(), writeFile: vi.fn() }));
vi.mock("@/components/datatable/util/dataio.utils", () => ({ downloadBlob: vi.fn() }));

const records = [
    { id: 1, classId: 1, name: "Java_Calendar_1.1", version: "1.1", historyChange: "Initial plan", lastModifiedDate: "2026-01-01T09:00:00", lastModifiedBy: "Trainer", status: "inactive" },
    { id: 2, classId: 1, name: "Java_Calendar_1.2", version: "1.2", historyChange: "Update trainer", lastModifiedDate: "2026-02-01T09:00:00", lastModifiedBy: "Admin", status: "active" },
];

beforeEach(() => {
    fakeHttp.reset();
    grant("SESSION_READ");
    fakeHttp.on("get", "/external/classes/1/calendars", records);
});

it("links the bottom horizontal scrollbar to the table in both directions", async () => {
    renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await screen.findByRole("button", { name: "Java_Calendar_1.2" });
    const viewport = screen.getByRole("region", { name: "Scrollable calendar table" });
    const scrollbar = screen.getByRole("region", { name: "Scroll calendar columns horizontally" });
    expect(within(viewport).getByRole("table").parentElement).toBe(viewport);
    expect(scrollbar.closest("footer")).not.toBeNull();
    fireEvent.scroll(scrollbar, { target: { scrollLeft: 350 } });
    expect(viewport.scrollLeft).toBe(350);
    fireEvent.scroll(viewport, { target: { scrollLeft: 100 } });
    expect(scrollbar.scrollLeft).toBe(100);
});

it("downloads the formatted detailed workbook from the selected calendar export endpoint", async () => {
    const file = new Blob(["xlsx workbook"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    fakeHttp.on("get", "/external/classes/1/calendars/2/export", file);
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await user.click(await screen.findByRole("button", { name: "Actions for calendar version 1.2" }));
    await user.click(screen.getByRole("menuitem", { name: "Download with detailed time" }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(file, "Java_Calendar_1.2_detailed_time.xlsx"));
});

it("shows newest versions first, filters statuses and opens version details", async () => {
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await screen.findByRole("button", { name: "Java_Calendar_1.2" });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Java_Calendar_1.2");
    await user.click(screen.getByRole("button", { name: "Filter calendar status" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /^Inactive$/ }));
    expect(screen.queryByRole("button", { name: "Java_Calendar_1.1" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Java_Calendar_1.2" }));
    expect(screen.getByRole("region", { name: "Calendar Detail" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to Calendar List" }));
    expect(screen.getByRole("button", { name: "Java_Calendar_1.2" })).toBeInTheDocument();
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

it("offers all five actions and saves Adjust as a new version", async () => {
    grant("SESSION_READ", "SESSION_UPDATE");
    fakeHttp.on("get", "/external/classes/1/calendars", [{ ...records[1], classStartDate: "2026-05-23", actualLearningStartDate: "2026-05-25", overviewItems: [
        { id: "topic-1", label: "[OC]", name: "Opening Ceremony", startDate: "2026-05-25", endDate: "2026-05-25", lessons: [] },
    ] }]);
    fakeHttp.on("post", "/external/classes/1/calendars/2/versions", { ...records[1], id: 3, version: "1.3", status: "draft" });
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
    expect(screen.getByRole("heading", { name: "Adjust calendar : Class 1" })).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Actual Learning Start Date", { exact: true }));
    await user.type(screen.getByLabelText("Actual Learning Start Date", { exact: true }), "2026-05-01");
    await user.click(screen.getByRole("button", { name: "Save as New Version" }));
    expect(screen.getByRole("alert")).toHaveTextContent("on or after Class Start Date");
    expect(fakeHttp.callsTo("post", "/external/classes/1/calendars/2/versions")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Actual Learning Start Date", { exact: true }), { target: { value: "2026-05-25" } });
    await user.click(screen.getByRole("button", { name: /\[OC\] Opening Ceremony/ }));
    await user.clear(screen.getByRole("textbox", { name: "Topic Name" }));
    await user.type(screen.getByRole("textbox", { name: "Topic Name" }), "New opening plan");
    await user.click(screen.getByRole("button", { name: "Save as New Version" }));
    await waitFor(() => expect(fakeHttp.callsTo("post", "/external/classes/1/calendars/2/versions")).toHaveLength(1));
    expect(fakeHttp.callsTo("post", "/external/classes/1/calendars/2/versions")[0].data).toMatchObject({
        classStartDate: "2026-05-23", actualLearningStartDate: "2026-05-25", overviewItems: [{ id: "topic-1", name: "New opening plan" }],
    });
    expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")).toHaveLength(0);
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

it("draws calendar subject ranges even when the version has no session records", async () => {
    fakeHttp.on("get", "/external/classes/1/calendars", [{ ...records[1], sessions: [], overviewItems: [
        { id: "OC", label: "[OC]", startDate: "2026-05-25", endDate: "2026-05-25" },
        { id: "JS", label: "[L2_JA_JS]", startDate: "2026-06-18", endDate: "2026-06-29" },
    ] }]);
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await user.click(await screen.findByRole("button", { name: "Actions for calendar version 1.2" }));
    await user.click(screen.getByRole("menuitem", { name: "Overview" }));
    const chart = screen.getByRole("dialog", { name: "Calendar Overview Chart" });
    expect(within(chart).getByRole("img", { name: "[L2_JA_JS]: 18-Jun - 29-Jun" }).querySelector("rect")).toHaveAttribute("height", "30");
    expect(within(chart).getByRole("rowheader", { name: "[OC]" })).toBeInTheDocument();
    expect(within(chart).queryByText("No dated sessions available for this calendar version.")).not.toBeInTheDocument();
});

it("opens Detail as a topic page with expandable lesson rows and preserves list filters on return", async () => {
    fakeHttp.on("get", "/external/classes/1/calendars", [{ ...records[1], actualLearningStartDate: "2026-05-25", overviewItems: [{
        id: "teamwork", label: "[L1_AL_TESO]", name: "Teamwork Essentials", version: "1.0",
        startDate: "2026-05-27", endDate: "2026-05-27", slot: "Morning (08:30-12:00)",
        lessons: [{ id: "lesson-1", name: "Stand Out as a Valuable Team Member", from: "2026-05-27", to: "2026-05-27", trainer: "NgaTTT45" }],
    }] }]);
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1, code: "HCM26_FR_JAVA_03", startDate: "2026-05-23" }} />, { route: "/" });
    await user.click(await screen.findByRole("button", { name: "Actions for calendar version 1.2" }));
    await user.click(screen.getByRole("menuitem", { name: "Detail" }));
    expect(screen.getByRole("heading", { name: "Calendar Detail : HCM26_FR_JAVA_03" })).toBeInTheDocument();
    expect(screen.getByText("Class Start Date:").parentElement).toHaveTextContent("23-May-2026");
    expect(screen.getByText("Actual Learning Start Date:").parentElement).toHaveTextContent("25-May-2026");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Lessons for [L1_AL_TESO]" });
    expect(within(table).getByRole("columnheader", { name: "Day No" })).toBeInTheDocument();
    expect(within(table).getAllByText("27-May-2026")).toHaveLength(2);
    await user.click(within(table).getByRole("button", { name: "Show lesson details: Stand Out as a Valuable Team Member" }));
    expect(within(table).getByText("NgaTTT45")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /\[L1_AL_TESO\] Teamwork Essentials/ }));
    expect(screen.queryByRole("table", { name: "Lessons for [L1_AL_TESO]" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back to Calendar List" }));
    expect(screen.getByRole("table", { name: "Calendar version history" })).toBeInTheDocument();
});

it("enables Save changes when inline changes are made and submits update batch", async () => {
    grant("SESSION_READ", "SESSION_UPDATE");
    fakeHttp.on("put", "/external/classes/1/calendars", { message: "Saved" });
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await screen.findByRole("button", { name: "Java_Calendar_1.2" });
    const saveBtn = screen.getByRole("button", { name: "Save changes" });
    expect(saveBtn).toBeDisabled();
    expect(screen.getByText("No unsaved changes")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit calendar version 1.2" }));
    const noteInput = screen.getByLabelText("History change note for version 1.2");
    await user.clear(noteInput);
    await user.type(noteInput, "Updated schedule for sprint");

    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    expect(saveBtn).toBeEnabled();

    await user.click(saveBtn);
    await waitFor(() => expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")).toHaveLength(1));
    expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")[0].data).toEqual({
        updates: [
            { id: 2, name: "Java_Calendar_1.2", historyChange: "Updated schedule for sprint" }
        ]
    });
});


it("requires Edit, restores both fields on Cancel or Escape, and detects reverted changes", async () => {
    grant("SESSION_READ", "SESSION_UPDATE");
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await screen.findByRole("button", { name: "Java_Calendar_1.2" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit calendar version 1.2" }));
    const name = screen.getByLabelText("Calendar name for version 1.2");
    const note = screen.getByLabelText("History change note for version 1.2");
    fireEvent.change(name, { target: { value: "Renamed" } });
    fireEvent.change(note, { target: { value: "Changed note" } });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Cancel editing version 1.2" }));
    expect(screen.getByRole("button", { name: "Java_Calendar_1.2" })).toBeInTheDocument();
    expect(screen.getByText("Update trainer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Edit calendar version 1.2" }));
    fireEvent.change(screen.getByLabelText("Calendar name for version 1.2"), { target: { value: "Renamed" } });
    fireEvent.keyDown(screen.getByLabelText("Calendar name for version 1.2"), { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Edit calendar version 1.2" }));
    fireEvent.change(screen.getByLabelText("Calendar name for version 1.2"), { target: { value: "Renamed" } });
    fireEvent.change(screen.getByLabelText("Calendar name for version 1.2"), { target: { value: "Java_Calendar_1.2" } });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
});

it("validates required fields and lengths before sending any request", async () => {
    grant("SESSION_READ", "SESSION_UPDATE");
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await user.click(await screen.findByRole("button", { name: "Edit calendar version 1.2" }));
    const name = screen.getByLabelText("Calendar name for version 1.2");
    const note = screen.getByLabelText("History change note for version 1.2");
    fireEvent.change(name, { target: { value: "   " } });
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Calendar name is required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.change(name, { target: { value: "x".repeat(101) } });
    expect(screen.getByText("Calendar name must be 100 characters or fewer.")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "Valid name" } });
    fireEvent.change(note, { target: { value: "" } });
    expect(screen.getByText("History change note is required.")).toBeInTheDocument();
    fireEvent.change(note, { target: { value: "x".repeat(201) } });
    expect(screen.getByText("History change note must be 200 characters or fewer.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.change(name, { target: { value: "x".repeat(100) } });
    fireEvent.change(note, { target: { value: "x".repeat(200) } });
    expect(screen.queryByText(/characters or fewer/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    fireEvent.change(note, { target: { value: "x".repeat(201) } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")).toHaveLength(0);
});

it("locks edits during saving and preserves drafts after failure for retry", async () => {
    grant("SESSION_READ", "SESSION_UPDATE");
    let rejectSave!: (reason: unknown) => void;
    fakeHttp.on("put", "/external/classes/1/calendars", () => new Promise((_, reject) => { rejectSave = reject; }));
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await user.click(await screen.findByRole("button", { name: "Edit calendar version 1.2" }));
    fireEvent.change(screen.getByLabelText("Calendar name for version 1.2"), { target: { value: " New name " } });
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByRole("button", { name: "Saving…" });
    expect(screen.getByLabelText("Calendar name for version 1.2")).toBeDisabled();
    expect(screen.getByLabelText("History change note for version 1.2")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel editing version 1.2" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit calendar version 1.1" })).toBeDisabled();
    rejectSave(httpError(503));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
    expect(screen.getByLabelText("Calendar name for version 1.2")).toHaveValue(" New name ");
    fakeHttp.on("put", "/external/classes/1/calendars", {});
    fakeHttp.on("get", "/external/classes/1/calendars", [{ ...records[1], name: "New name" }, records[0]]);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByRole("button", { name: "New name" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")[1].data).toEqual({ updates: [{ id: 2, name: "New name", historyChange: "Update trainer" }] });
});

it("cancels only the selected row and saves the remaining changes together", async () => {
    grant("SESSION_READ", "SESSION_UPDATE");
    fakeHttp.on("put", "/external/classes/1/calendars", {});
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await user.click(await screen.findByRole("button", { name: "Edit calendar version 1.2" }));
    await user.click(screen.getByRole("button", { name: "Edit calendar version 1.1" }));
    fireEvent.change(screen.getByLabelText("History change note for version 1.2"), { target: { value: "New active note" } });
    fireEvent.change(screen.getByLabelText("History change note for version 1.1"), { target: { value: "New inactive note" } });
    expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel editing version 1.1" }));
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Actions for calendar version 1.2" }));
    expect(screen.getByRole("menuitem", { name: "Adjust" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")).toHaveLength(1));
    expect(fakeHttp.callsTo("put", "/external/classes/1/calendars")[0].data).toEqual({ updates: [{ id: 2, name: records[1].name, historyChange: "New active note" }] });
});

it("warns before leaving through a link or closing the page and removes the warning after Cancel", async () => {
    grant("SESSION_READ", "SESSION_UPDATE");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { user } = renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/" });
    await user.click(await screen.findByRole("button", { name: "Edit calendar version 1.2" }));
    fireEvent.change(screen.getByLabelText("Calendar name for version 1.2"), { target: { value: "Draft name" } });
    await user.click(screen.getByRole("link", { name: "Back to Class List" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
    const close = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(close);
    expect(close.defaultPrevented).toBe(true);
    await user.click(screen.getByRole("button", { name: "Cancel editing version 1.2" }));
    const cleanClose = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanClose);
    expect(cleanClose.defaultPrevented).toBe(false);
    confirm.mockRestore();
});

it("keeps Calendar drafts when switching tabs is declined and discards them only after confirmation", async () => {
    grant("SESSION_READ", "SESSION_UPDATE");
    fakeHttp.on("get", "/external/classes/1", { id: 1, code: "JAVA_01", status: "active" });
    fakeHttp.on("get", "/classes/1", { id: 1, code: "JAVA_01", status: "active" });
    const { default: ClassDetailPage } = await import("../ClassDetailPage");
    const { user } = renderAt(<ClassDetailPage />, { route: "/classes/1?tab=calendar", path: "/classes/:classId" });
    await user.click(await screen.findByRole("button", { name: "Edit calendar version 1.2" }));
    fireEvent.change(screen.getByLabelText("Calendar name for version 1.2"), { target: { value: "Draft name" } });
    await user.click(screen.getByRole("tab", { name: "Class Info" }));
    const leaveDialog = await screen.findByRole("dialog", { name: "Unsaved Changes" });
    await user.click(within(leaveDialog).getByRole("button", { name: "Stay" }));
    expect(screen.getByRole("tab", { name: "Calendar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Calendar name for version 1.2")).toHaveValue("Draft name");
    await user.click(screen.getByRole("tab", { name: "Class Info" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Unsaved Changes" })).getByRole("button", { name: "Leave" }));
    expect(screen.getByRole("tab", { name: "Class Info" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Calendar" }));
    expect(await screen.findByRole("button", { name: "Java_Calendar_1.2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
});
