import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp, httpError } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import WeeklyCalendarPage from "./WeeklyCalendarPage";

vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then((m) => m.layoutModule()));
vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then((m) => m.permissionsModule()));

describe("WeeklyCalendarPage", () => {
  beforeEach(() => {
    fakeHttp.reset();
    // User only has SESSION_READ (no TRAINER_READ, no CLASS_READ)
    grant("SESSION_READ");
    fakeHttp.on("get", "/classes", () => {
      throw httpError(403, { message: "Forbidden" });
    });
    fakeHttp.on("get", "/external/classes", [
      { id: 1, code: "EXT_JAVA_01", name: "Lớp Java Backend", status: "active" },
    ]);
    fakeHttp.on("get", "/external/trainers", [
      { id: 1, name: "External Trainer One", email: "ext1@example.com", status: "active" },
    ]);
    // Internal /trainers has a colliding ID=1 with a different name — must never be called.
    fakeHttp.on("get", "/trainers", {
      content: [{ id: 1, fullName: "Internal Colliding Trainer", status: "ACTIVE" }],
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
      size: 200,
      first: true,
      last: true,
    });
  });

  it("resolves Session trainer labels from external source without requiring TRAINER_READ or confusing colliding IDs", async () => {
    renderAt(<WeeklyCalendarPage />, { route: "/calendar/preview?date=2026-10-01" });

    expect(await screen.findByText("[JAVA_CORE] OOP Lab")).toBeInTheDocument();
    expect(await screen.findByText("External Trainer One")).toBeInTheDocument();
    expect(screen.queryByText("Internal Colliding Trainer")).not.toBeInTheDocument();
    expect(screen.getByText(/EXT_JAVA_01 · JAVA_CORE/)).toBeInTheDocument();

    expect(fakeHttp.callsTo("get", "/external/trainers")).toHaveLength(1);
    expect(fakeHttp.callsTo("get", "/trainers")).toHaveLength(0);
    expect(fakeHttp.callsTo("get", "/calendar/sessions")).toHaveLength(1);
  });

  it("uses start of next month for month boundary and renders cross-day sessions in every intersecting day cell", async () => {
    fakeHttp.on("get", "/calendar/sessions", {
      content: [
        {
          id: 201,
          isActive: true,
          classId: 1,
          topicId: 1,
          trainerId: 1,
          title: "[JAVA_CORE] Overnight Boundary",
          startTime: "2026-09-30T22:00:00",
          endTime: "2026-10-01T02:00:00",
          location: "Online",
          status: "SCHEDULED",
        },
        {
          id: 202,
          isActive: true,
          classId: 1,
          topicId: 1,
          trainerId: 1,
          title: "[JAVA_CORE] Two-Day Workshop",
          startTime: "2026-10-01T22:00:00",
          endTime: "2026-10-02T02:00:00",
          location: "Online",
          status: "SCHEDULED",
        },
      ],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 200,
      first: true,
      last: true,
    });

    renderAt(<WeeklyCalendarPage />, { route: "/calendar/preview?view=month&date=2026-10-15" });

    expect(await screen.findByText(/Overnight Boundary/)).toBeInTheDocument();
    // Two-Day Workshop spans Oct 1 and Oct 2 -> appears in BOTH day cells
    expect(screen.getAllByText(/Two-Day Workshop/)).toHaveLength(2);

    const call = fakeHttp.callsTo("get", "/calendar/sessions")[0];
    const params = call.params as Record<string, unknown> | undefined;
    expect(params?.from).toBe("2026-10-01T00:00:00");
    expect(params?.to).toBe("2026-11-01T00:00:00");
  });

  it("loads all pages of a multi-page personal schedule so search and CSV cover the entire period", async () => {
    fakeHttp.on("get", "/calendar/my-sessions", (req: { params?: Record<string, unknown> }) => {
      const pageNum = Number(req.params?.page ?? 0);
      if (pageNum === 0) {
        return {
          content: [
            {
              id: 301,
              isActive: true,
              classId: 1,
              topicId: 1,
              trainerId: 1,
              title: "[JAVA_CORE] Page Zero Session",
              startTime: "2026-10-05T08:00:00",
              endTime: "2026-10-05T12:00:00",
              location: "Lab 201",
              status: "SCHEDULED",
            },
          ],
          totalElements: 2,
          totalPages: 2,
          number: 0,
          size: 200,
          first: true,
          last: false,
        };
      }
      return {
        content: [
          {
            id: 302,
            isActive: true,
            classId: 1,
            topicId: 1,
            trainerId: 1,
            title: "[JAVA_CORE] Page One Session",
            startTime: "2026-10-06T08:00:00",
            endTime: "2026-10-06T12:00:00",
            location: "Lab 202",
            status: "SCHEDULED",
          },
        ],
        totalElements: 2,
        totalPages: 2,
        number: 1,
        size: 200,
        first: false,
        last: true,
      };
    });

    const { user } = renderAt(<WeeklyCalendarPage />, {
      route: "/calendar/preview?view=list&scope=mine&date=2026-10-05",
    });

    expect(await screen.findByText("[JAVA_CORE] Page Zero Session")).toBeInTheDocument();
    expect(await screen.findByText("[JAVA_CORE] Page One Session")).toBeInTheDocument();

    const myCalls = fakeHttp.callsTo("get", "/calendar/my-sessions");
    expect(myCalls).toHaveLength(2);
    expect((myCalls[0].params as Record<string, unknown> | undefined)?.page).toBe(0);
    expect((myCalls[1].params as Record<string, unknown> | undefined)?.page).toBe(1);

    // Search finds session from page 1 by title or trainer name
    await user.type(screen.getByPlaceholderText(/Tìm theo tiêu đề/i), "Page One");
    await waitFor(() => {
      expect(screen.queryByText("[JAVA_CORE] Page Zero Session")).not.toBeInTheDocument();
      expect(screen.getByText("[JAVA_CORE] Page One Session")).toBeInTheDocument();
    });
  });

  it("loads more than 25 pages with bounded concurrency so tail-page sessions appear in search and exported CSV", async () => {
    const TOTAL_PAGES = 27;
    let inFlight = 0;
    let maxInFlight = 0;

    fakeHttp.on("get", "/calendar/sessions", async (req: { params?: Record<string, unknown> }) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;

      const pageNum = Number(req.params?.page ?? 0);
      const isLast = pageNum === TOTAL_PAGES - 1;
      const title = isLast
        ? "[JAVA_CORE] Page 26 Tail Session"
        : `[JAVA_CORE] Page ${pageNum} Session`;

      return {
        content: [
          {
            id: 1000 + pageNum,
            isActive: true,
            classId: 1,
            topicId: 1,
            trainerId: 1,
            title,
            startTime: "2026-10-05T08:00:00",
            endTime: "2026-10-05T10:00:00",
            location: `Lab ${pageNum}`,
            status: "SCHEDULED",
          },
        ],
        totalElements: TOTAL_PAGES,
        totalPages: TOTAL_PAGES,
        number: pageNum,
        size: 200,
        first: pageNum === 0,
        last: isLast,
      };
    });

    const capturedBlobs: Blob[] = [];
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      if (blob instanceof Blob) {
        capturedBlobs.push(blob);
      }
      return "blob:mock-csv";
    });
    URL.revokeObjectURL = vi.fn();

    try {
      const { user } = renderAt(<WeeklyCalendarPage />, {
        route: "/calendar/preview?view=list&date=2026-10-05",
      });

      expect(await screen.findByText("[JAVA_CORE] Page 26 Tail Session")).toBeInTheDocument();

      const calls = fakeHttp.callsTo("get", "/calendar/sessions");
      expect(calls).toHaveLength(TOTAL_PAGES);
      expect(maxInFlight).toBeLessThanOrEqual(4);

      // Tail-page session is searchable
      await user.type(screen.getByPlaceholderText(/Tìm theo tiêu đề/i), "Page 26 Tail");
      await waitFor(() => {
        expect(screen.queryByText("[JAVA_CORE] Page 0 Session")).not.toBeInTheDocument();
        expect(screen.getByText("[JAVA_CORE] Page 26 Tail Session")).toBeInTheDocument();
      });

      // Clear search and export full CSV -> verify tail-page session is in CSV content
      await user.clear(screen.getByPlaceholderText(/Tìm theo tiêu đề/i));
      await waitFor(() => {
        expect(screen.getByText("[JAVA_CORE] Page 0 Session")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /Xuất Excel \(CSV\)/i }));
      expect(capturedBlobs).toHaveLength(1);
      const csvText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(capturedBlobs[0]);
      });
      expect(csvText).toContain("[JAVA_CORE] Page 0 Session");
      expect(csvText).toContain("[JAVA_CORE] Page 26 Tail Session");
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });

  it("shows a clear error message instead of partial data when a later calendar page fails", async () => {
    fakeHttp.on("get", "/calendar/sessions", (req: { params?: Record<string, unknown> }) => {
      const pageNum = Number(req.params?.page ?? 0);
      if (pageNum === 2) {
        throw httpError(500, { message: "Internal Server Error" });
      }
      return {
        content: [
          {
            id: 500 + pageNum,
            isActive: true,
            classId: 1,
            topicId: 1,
            trainerId: 1,
            title: `[JAVA_CORE] Partial Page ${pageNum}`,
            startTime: "2026-10-05T08:00:00",
            endTime: "2026-10-05T10:00:00",
            location: "Lab 1",
            status: "SCHEDULED",
          },
        ],
        totalElements: 4,
        totalPages: 4,
        number: pageNum,
        size: 200,
        first: pageNum === 0,
        last: pageNum === 3,
      };
    });

    renderAt(<WeeklyCalendarPage />, {
      route: "/calendar/preview?view=list&date=2026-10-05",
    });

    expect(await screen.findByText(/Không tải được lịch/i)).toBeInTheDocument();
    expect(screen.queryByText("[JAVA_CORE] Partial Page 0")).not.toBeInTheDocument();
  });

  it("renders Week View as a single 7-day horizontal row (Monday to Sunday) inside an overflow-x-auto container", async () => {
    fakeHttp.on("get", "/calendar/sessions", {
      content: [
        {
          id: 701,
          isActive: true,
          classId: 1,
          topicId: 1,
          trainerId: 1,
          title: "[JAVA_CORE] Java Core - Advanced Design Patterns",
          startTime: "2026-11-16T08:00:00",
          endTime: "2026-11-16T12:00:00",
          location: "Phòng Lab 201 (F-Town 2)",
          status: "SCHEDULED",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
      first: true,
      last: true,
    });

    renderAt(<WeeklyCalendarPage />, { route: "/calendar/preview?classId=1&date=2026-11-16&page=0" });

    expect(await screen.findByText("[JAVA_CORE] Java Core - Advanced Design Patterns")).toBeInTheDocument();

    const scrollContainer = screen.getByTestId("week-timetable-scroll");
    const grid = screen.getByTestId("week-timetable-grid");
    expect(scrollContainer.className).toContain("overflow-x-auto");
    expect(grid.className).toContain("grid-cols-7");

    const daySections = Array.from(grid.querySelectorAll("section"));
    expect(daySections).toHaveLength(7);

    const expectedLabels = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
    const actualLabels = daySections.map((section) => section.querySelector("header p")?.textContent?.trim());
    expect(actualLabels).toEqual(expectedLabels);
    expect(screen.getAllByText("Không có buổi học")).toHaveLength(6);
  });

  it("exports .ics only in personal scope (mine) and hides it in all-sessions scope", async () => {
    fakeHttp.on("get", "/calendar/my-sessions", {
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
      size: 200,
      first: true,
      last: true,
    });

    const capturedBlobs: Blob[] = [];
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      if (blob instanceof Blob) {
        capturedBlobs.push(blob);
      }
      return "blob:mock-ics";
    });
    URL.revokeObjectURL = vi.fn();

    try {
      const allView = renderAt(<WeeklyCalendarPage />, { route: "/calendar/preview?date=2026-10-01" });
      expect(await screen.findByText("[JAVA_CORE] OOP Lab")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Xuất lịch \(\.ics\)/i })).not.toBeInTheDocument();
      allView.unmount();

      const { user } = renderAt(<WeeklyCalendarPage />, { route: "/calendar/preview?scope=mine&date=2026-10-01" });
      expect(await screen.findByText("[JAVA_CORE] OOP Lab")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: /Xuất lịch \(\.ics\)/i }));
      expect(capturedBlobs).toHaveLength(1);

      const icsText = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(capturedBlobs[0]);
      });

      expect(icsText).toContain("BEGIN:VCALENDAR");
      expect(icsText).toContain("TZID:Asia/Ho_Chi_Minh");
      expect(icsText).toContain("BEGIN:VEVENT");
      expect(icsText).toContain("DTSTART;TZID=Asia/Ho_Chi_Minh:20261001T080000");
      expect(icsText).toContain("DTEND;TZID=Asia/Ho_Chi_Minh:20261001T120000");
      expect(icsText).toContain("SUMMARY:[EXT_JAVA_01] [JAVA_CORE] OOP Lab");
      expect(icsText).toContain("LOCATION:Phòng Lab 201 (F-Town 2)");
      expect(icsText).toContain("External Trainer One");
      expect(icsText).toContain("END:VCALENDAR");
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });
});
