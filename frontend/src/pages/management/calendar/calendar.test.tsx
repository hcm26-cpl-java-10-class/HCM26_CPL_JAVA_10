import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import WeeklyCalendarPage from "./WeeklyCalendarPage";

vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));

describe("WeeklyCalendarPage", () => {
  beforeEach(() => {
    fakeHttp.reset();
    grant("SESSION_READ");
    fakeHttp.on("get", "/classes", {
      content: [{ id: 1, code: "JAVA_01", name: "Lớp Java Backend", status: "active" }],
      totalPages: 1,
    });
    fakeHttp.on("get", "/trainers", {
      content: [{ id: 1, fullName: "Nguyễn Ngọc Tân", status: "ACTIVE" }],
      totalPages: 1,
    });
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

  it("renders loaded weekly timetable sessions with class and trainer labels from API", async () => {
    renderAt(<WeeklyCalendarPage />, { route: "/calendar/preview?date=2026-10-01" });
    expect(await screen.findByText("[JAVA_CORE] OOP Lab")).toBeInTheDocument();
    expect(await screen.findByText(/Nguyễn Ngọc Tân/)).toBeInTheDocument();
    expect(screen.getByText(/JAVA_01 · JAVA_CORE/)).toBeInTheDocument();
    expect(fakeHttp.callsTo("get", "/classes")).toHaveLength(1);
    expect(fakeHttp.callsTo("get", "/trainers")).toHaveLength(1);
    expect(fakeHttp.callsTo("get", "/calendar/sessions")).toHaveLength(1);
  });
});
