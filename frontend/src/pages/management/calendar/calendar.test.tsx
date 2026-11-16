import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import TrainingCalendarPage from "./TrainingCalendarPage";
import WeeklyCalendarPage from "./WeeklyCalendarPage";
import {
  buildSessionPayloads,
  calculateEndTime,
  formatFamsDate,
  generateDaysFromDuration,
  getFamsDayOfWeek,
  groupSessionsIntoTopics,
  parseDurationHours,
  validateScheduleLogic,
} from "./calendar.utils";

vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));

describe("calendar.utils", () => {
  it("computes end times and parses duration labels accurately", () => {
    expect(calculateEndTime("08:00", 2.5)).toBe("10:30");
    expect(calculateEndTime("13:30", 4)).toBe("17:30");
    expect(parseDurationHours("2.5h")).toBe(2.5);
    expect(parseDurationHours("4")).toBe(4);
  });

  it("formats FAMS dates and day-of-week labels", () => {
    expect(formatFamsDate("2026-10-01")).toBe("01-Oct-2026");
    expect(getFamsDayOfWeek("2026-10-01")).toBe("Thursday");
  });

  it("generates days skipping Saturdays and Sundays when skipWeekends is true", () => {
    // 2026-10-02 is Friday; 16h @ 4h/session (2 sessions/day) -> 2 days (Friday + Monday 2026-10-05)
    const days = generateDaysFromDuration({
      topicName: "Java Core",
      totalHours: 16,
      sessionHours: 4,
      startDateStr: "2026-10-02",
      skipWeekends: true,
    });
    expect(days).toHaveLength(2);
    expect(days[0].date).toBe("2026-10-02");
    expect(days[1].date).toBe("2026-10-05");
  });

  it("validates learning start dates and builds normalized session payloads", () => {
    const days = generateDaysFromDuration({
      topicName: "Spring Boot",
      totalHours: 8,
      sessionHours: 4,
      startDateStr: "2026-10-01",
    });
    const topics = [
      {
        id: "t1",
        code: "SPRING_BOOT",
        name: "Spring Boot",
        trainer: "Nguyễn Ngọc Tân (Trainer)",
        mentor: "",
        prerequisite: "",
        location: "Phòng Lab 201 (F-Town 2)",
        slot: "1",
        days,
      },
    ];

    expect(validateScheduleLogic(topics, "2026-10-05", "2026-10-05")).toContain("cannot be before actual learning start");
    expect(validateScheduleLogic(topics, "2026-10-01", "2026-10-01")).toBeNull();

    const { sessions, candidates } = buildSessionPayloads({
      topics,
      classId: 1,
      systemSubjects: [{ id: 2, code: "SPRING_BOOT", name: "Spring Boot", version: "1.0", durationHours: 48, status: "ACTIVE" } as never],
      realTrainers: [{ id: 1, name: "Nguyễn Ngọc Tân (Trainer)", email: "tan@example.com", status: "active" } as never],
      realRooms: [{ id: 1, name: "Phòng Lab 201 (F-Town 2)" }],
    });

    expect(sessions).toHaveLength(2);
    expect(candidates).toHaveLength(2);
    expect(sessions[0].topicId).toBe(2);
    expect(sessions[0].trainerId).toBe(1);
    expect(sessions[0].title).toContain("[SPRING_BOOT]");
  });

  it("groups persisted sessions into topics and days", () => {
    const grouped = groupSessionsIntoTopics(
      [
        {
          id: 10,
          classId: 1,
          topicId: 1,
          trainerId: 1,
          title: "[JAVA_CORE] OOP Basics",
          startTime: "2026-10-01T08:00:00",
          endTime: "2026-10-01T12:00:00",
          location: "Phòng Lab 201 (F-Town 2)",
        },
      ],
      [{ id: 1, code: "JAVA_CORE", name: "Java Core & OOP" } as never],
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0].code).toBe("JAVA_CORE");
    expect(grouped[0].days).toHaveLength(1);
    expect(grouped[0].days[0].activities[0].name).toBe("OOP Basics");
  });
});

describe("TrainingCalendarPage", () => {
  beforeEach(() => {
    fakeHttp.reset();
    grant("SESSION_READ", "SESSION_CREATE", "SESSION_UPDATE", "SESSION_DELETE");
    fakeHttp.on("get", "/external/classes", [{ id: 1, code: "LOCAL_JAVA_01", name: "Lớp Java Backend", startDate: "2026-10-01" }]);
    fakeHttp.on("get", "/external/trainers", [{ id: 1, name: "Nguyễn Ngọc Tân (Trainer)", email: "tan@example.com", status: "active" }]);
    fakeHttp.on("get", "/external/rooms", [{ id: 1, name: "Phòng Lab 201 (F-Town 2)" }]);
    fakeHttp.on("get", "/topics/active", [{ id: 1, code: "JAVA_CORE", name: "Java Core", version: "1.0", durationHours: 8, status: "ACTIVE" }]);
    fakeHttp.on("get", "/sessions", {
      content: [
        {
          id: 1,
          classId: 1,
          topicId: 1,
          trainerId: 1,
          title: "[JAVA_CORE] Java Syntax",
          startTime: "2026-10-01T08:00:00",
          endTime: "2026-10-01T12:00:00",
          location: "Phòng Lab 201 (F-Town 2)",
        },
      ],
    });
  });

  it("loads class schedule and calls POST /calendar/validate when checking conflicts", async () => {
    fakeHttp.on("post", "/calendar/validate", {
      valid: false,
      issues: [{ code: "DB_TRAINER_OVERLAP", message: "Trainer #1 already teaches class #2 at this time" }],
    });

    const { user } = renderAt(<TrainingCalendarPage defaultClassId="LOCAL_JAVA_01" />, { route: "/calendar/adjust" });
    expect(await screen.findByText(/Adjust calendar : LOCAL_JAVA_01/)).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Java Syntax")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Check Conflicts/i }));
    expect(await screen.findByText(/Validation Alert: Conflicts Found/i)).toBeInTheDocument();
    expect(screen.getByText(/Trainer #1 already teaches class #2/)).toBeInTheDocument();
    expect(fakeHttp.callsTo("post", "/calendar/validate")).toHaveLength(1);
  });
});

describe("WeeklyCalendarPage", () => {
  beforeEach(() => {
    fakeHttp.reset();
    grant("SESSION_READ");
    fakeHttp.on("get", "/external/classes", [{ id: 1, code: "LOCAL_JAVA_01", name: "Lớp Java Backend", status: "active" }]);
    fakeHttp.on("get", "/external/trainers", [{ id: 1, name: "Nguyễn Ngọc Tân (Trainer)" }]);
    fakeHttp.on("get", "/topics", { content: [{ id: 1, code: "JAVA_CORE", name: "Java Core" }] });
    fakeHttp.on("get", "/calendar/sessions", {
      content: [
        {
          id: 101,
          isActive: true,
          classId: 1,
          topicId: 1,
          trainerId: 1,
          title: "[JAVA_CORE] OOP Lab",
          startTime: "2026-10-01T08:00:00",
          endTime: "2026-10-01T12:00:00",
          location: "Phòng Lab 201 (F-Town 2)",
          status: "SCHEDULED",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 100,
      first: true,
      last: true,
    });
  });

  it("renders loaded weekly timetable sessions with class and trainer labels", async () => {
    renderAt(<WeeklyCalendarPage />, { route: "/calendar/preview?date=2026-10-01" });
    expect(await screen.findByText("[JAVA_CORE] OOP Lab")).toBeInTheDocument();
    expect(screen.getByText(/Nguyễn Ngọc Tân \(Trainer\)/)).toBeInTheDocument();
    expect(fakeHttp.callsTo("get", "/calendar/sessions")).toHaveLength(1);
  });
});

