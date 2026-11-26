import { screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp, httpError } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import type { ClassScheduleResponse } from "@/api/features/classSchedule.api";
import { DEFAULT_SCHEDULE_CONFIG } from "@/pages/management/calendar/schedule.config";
import { ClassCalendarTab } from "./ClassCalendarTab";
import CalendarPage from "@/pages/management/calendar/CalendarPage";

vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));

function sampleSchedule(overrides: Partial<ClassScheduleResponse> = {}): ClassScheduleResponse {
    return {
        classInfo: {
            id: 2,
            code: "HCM02666",
            name: "Java Backend K26",
            startDate: "2026-11-09",
            endDate: "2027-02-07",
            status: "active",
            programCode: "BACKEND_JAVA",
        },
        program: {
            id: 10,
            code: "BACKEND_JAVA",
            name: "Java Backend",
            courses: [
                { id: 101, code: "JAVA-CORE", name: "Java Core", durationHours: 8, orderIndex: 1, slotsNeeded: 2 },
                { id: 102, code: "SPRING", name: "Spring Boot", durationHours: 4, orderIndex: 2, slotsNeeded: 1 },
            ],
        },
        config: DEFAULT_SCHEDULE_CONFIG,
        hasSchedule: true,
        outdated: false,
        outdatedReason: null,
        entries: [
            {
                id: "entry-1",
                classId: 2,
                courseId: 101,
                courseCode: "JAVA-CORE",
                courseName: "Java Core",
                date: "2026-11-09",
                slot: 1,
                startTime: "08:00",
                endTime: "12:00",
                order: 1,
                isManual: false,
            },
            {
                id: "entry-2",
                classId: 2,
                courseId: 101,
                courseCode: "JAVA-CORE",
                courseName: "Java Core",
                date: "2026-11-09",
                slot: 2,
                startTime: "13:00",
                endTime: "17:00",
                order: 2,
                isManual: false,
            },
            {
                id: "entry-3",
                classId: 2,
                courseId: 102,
                courseCode: "SPRING",
                courseName: "Spring Boot",
                date: "2026-11-10",
                slot: 1,
                startTime: "08:00",
                endTime: "12:00",
                order: 1,
                isManual: false,
            },
        ],
        ...overrides,
    };
}

beforeEach(() => {
    fakeHttp.reset();
    grant("SESSION_READ", "CLASS_READ");
});

describe("Read-only ClassCalendarTab inside Class Details", () => {
    it("displays saved weekly schedule in strictly read-only mode with zero edit/generate/save controls", async () => {
        grant("SESSION_READ", "CLASS_READ", "SESSION_UPDATE");
        fakeHttp.on("get", "/classes/2/schedule", sampleSchedule());

        renderAt(
            <ClassCalendarTab classItem={{ id: 2, code: "HCM02666", startDate: "2026-11-09", endDate: "2027-02-07" }} />,
            { route: "/classes/2?tab=calendar" },
        );

        expect(await screen.findByText("Read-only")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Open in Calendar/i })).toHaveAttribute(
            "href",
            "/calendar?tab=schedule&classId=2",
        );
        expect(screen.getAllByText("JAVA-CORE").length).toBeGreaterThan(0);
        expect(screen.getAllByText("SPRING").length).toBeGreaterThan(0);

        // Strictly read-only: no Generate, Save, or Edit buttons
        expect(screen.queryByRole("button", { name: /Auto Generate/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Manual Edit/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Save Schedule/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Add session/i })).not.toBeInTheDocument();
    });

    it("shows empty state with link to Calendar when class has no saved schedule", async () => {
        fakeHttp.on("get", "/classes/2/schedule", sampleSchedule({ hasSchedule: false, entries: [] }));

        renderAt(
            <ClassCalendarTab classItem={{ id: 2, code: "HCM02666", startDate: "2026-11-09" }} />,
            { route: "/classes/2?tab=calendar" },
        );

        expect(await screen.findByRole("heading", { name: "No schedule yet" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Go to Calendar to create schedule/i })).toHaveAttribute(
            "href",
            "/calendar?tab=schedule&classId=2",
        );
    });

    it("does not request schedule data without SESSION_READ permission", () => {
        grant();
        renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/classes/1?tab=calendar" });
        expect(fakeHttp.callsTo("get", "/classes/1/schedule")).toHaveLength(0);
    });

    it("shows retryable error state when the schedule API fails", async () => {
        fakeHttp.on("get", "/classes/1/schedule", () => {
            throw httpError(503);
        });
        renderAt(<ClassCalendarTab classItem={{ id: 1 }} />, { route: "/classes/1?tab=calendar" });
        expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
});

describe("Sidebar CalendarPage & ClassScheduleEditor", () => {
    it("shows class list badges, auto-generates draft for unscheduled class, saves atomically, and switches tabs", async () => {
        grant("SESSION_READ", "CLASS_READ", "SESSION_UPDATE");
        fakeHttp.on("get", "/classes", {
            content: [
                {
                    id: 1,
                    code: "LOCAL_JAVA_01",
                    name: "Java Backend K26",
                    status: "active",
                    startDate: "2026-11-09",
                    endDate: "2027-01-31",
                    program: "BACKEND_JAVA",
                    hasSchedule: true,
                },
                {
                    id: 2,
                    code: "LOCAL_JAVA_02",
                    name: "Fullstack K26",
                    status: "planning",
                    startDate: "2026-11-09",
                    endDate: "2027-03-15",
                    program: "FULLSTACK_JAVA",
                    hasSchedule: false,
                },
            ],
            totalPages: 1,
            totalElements: 2,
            number: 0,
            size: 100,
        });

        const generatedEntries = sampleSchedule({ classInfo: { id: 2, code: "LOCAL_JAVA_02", name: "Fullstack K26", startDate: "2026-11-09" } }).entries;
        fakeHttp.on(
            "get",
            "/classes/2/schedule",
            sampleSchedule({
                classInfo: { id: 2, code: "LOCAL_JAVA_02", name: "Fullstack K26", startDate: "2026-11-09", programCode: "FULLSTACK_JAVA" },
                hasSchedule: false,
                entries: [],
            }),
        );
        fakeHttp.on("post", "/classes/2/schedule/generate", generatedEntries);
        fakeHttp.on(
            "put",
            "/classes/2/schedule",
            sampleSchedule({
                classInfo: { id: 2, code: "LOCAL_JAVA_02", name: "Fullstack K26", startDate: "2026-11-09", programCode: "FULLSTACK_JAVA" },
                hasSchedule: true,
                entries: generatedEntries,
            }),
        );
        fakeHttp.on("get", "/calendar/sessions", {
            content: [],
            totalElements: 0,
            totalPages: 1,
            number: 0,
            size: 200,
            first: true,
            last: true,
        });

        const { user } = renderAt(<CalendarPage />, { route: "/calendar" });

        // Full-screen Class List shows "Scheduled" & "Not scheduled" badges
        const classList = await screen.findByLabelText("Class List");
        expect(await within(classList).findByText("Scheduled")).toBeInTheDocument();
        expect(within(classList).getByText("Not scheduled")).toBeInTheDocument();

        // Select unscheduled class LOCAL_JAVA_02 -> opens full-screen schedule editor & triggers auto-generate draft
        await user.click(within(classList).getByRole("button", { name: /LOCAL_JAVA_02/ }));

        await waitFor(() => expect(fakeHttp.callsTo("post", "/classes/2/schedule/generate")).toHaveLength(1));
        expect(screen.getByRole("button", { name: /Back to Class List/i })).toBeInTheDocument();
        expect(await screen.findByText(/auto-generated/i)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /View in Class/i })).toHaveAttribute(
            "href",
            "/classes/2?tab=calendar",
        );

        // Save schedule atomically
        const saveBtn = screen.getByRole("button", { name: /Save Schedule/i });
        expect(saveBtn).toBeEnabled();
        await user.click(saveBtn);
        await waitFor(() => expect(fakeHttp.callsTo("put", "/classes/2/schedule")).toHaveLength(1));

        // Switch to Weekly Timetable tab inside the same unified Calendar page
        await user.click(screen.getByRole("tab", { name: /Weekly Timetable/i }));
        expect(await screen.findByRole("heading", { name: /Thời khóa biểu & Lịch học/i })).toBeInTheDocument();
    });
});
