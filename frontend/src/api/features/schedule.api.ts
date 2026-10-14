import axiosInstance from "@/api/axios";
import type { ScheduleQuery, StudySession } from "@/types/features/schedule";
import dayjs from "dayjs";

/**
 * Study-session schedule API.
 *
 * The primary endpoint is `GET /study-sessions?from&to&role`.
 * If the backend endpoint is not available yet, the API falls back to
 * locally generated demo data so the calendar stays fully usable.
 */

const CATEGORY_POOL = ["LESSON", "REVIEW", "EXAM", "PROJECT", "MENTORING"] as const;

const COURSES = ["Mathematics", "Physics", "English", "Programming", "Chemistry"];

const TEACHERS = ["Mr. Nguyen", "Ms. Tran", "Mr. Le", "Ms. Pham"];

const LOCATIONS = ["Room A-101", "Room B-204", "Lab 3", "Online", "Library"];

const STATUS_POOL = ["SCHEDULED", "SCHEDULED", "SCHEDULED", "COMPLETED"] as const;

type RawSession = Record<string, unknown>;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asBoolean = (value: unknown): boolean =>
  typeof value === "boolean" ? value : String(value).toLowerCase() === "true";

const normalizeSession = (raw: RawSession, index: number): StudySession => ({
  id: asString(raw.id) || `session-${index}`,
  title: asString(raw.title) || asString(raw.name) || "Study session",
  course: asString(raw.course) || asString(raw.courseName) || "General",
  role: String(raw.role ?? "STUDENT").toUpperCase() === "TEACHER" ? "TEACHER" : "STUDENT",
  category: (String(raw.category ?? "LESSON").toUpperCase() as StudySession["category"]) || "LESSON",
  status: (String(raw.status ?? "SCHEDULED").toUpperCase() as StudySession["status"]) || "SCHEDULED",
  teacher: asString(raw.teacher) || asString(raw.teacherName) || "—",
  location: asString(raw.location) || asString(raw.room) || "—",
  start: asString(raw.start) || asString(raw.startTime) || "",
  end: asString(raw.end) || asString(raw.endTime) || "",
  description: asString(raw.description) || undefined,
  allDay: asBoolean(raw.allDay),
  color: asString(raw.color) || undefined,
});

const toDateString = (value: string | number | Date): string =>
  dayjs(value).format("YYYY-MM-DD");

/** Simple deterministic PRNG so demo data is stable within a day. */
const createSeededRandom = (seed: number) => {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
};

const buildDemoSessions = (query: ScheduleQuery): StudySession[] => {
  const sessions: StudySession[] = [];
  const from = dayjs(query.from).startOf("day");
  const to = dayjs(query.to).endOf("day");
  const role = query.role ?? "STUDENT";

  let cursor = from;
  let id = 0;

  while (!cursor.isAfter(to, "day")) {
    const dayOfWeek = cursor.day();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const random = createSeededRandom(cursor.year() * 10000 + (cursor.month() + 1) * 100 + cursor.date());

      const slots: Array<{ startHour: number; duration: number }> = [
        { startHour: 7 + Math.floor(random() * 2), duration: 1.5 },
        { startHour: 13 + Math.floor(random() * 2), duration: 1.5 },
        { startHour: 17 + Math.floor(random() * 2), duration: 1 },
      ];

      const count = random() > 0.75 ? 3 : random() > 0.4 ? 2 : 1;

      for (let i = 0; i < count; i += 1) {
        const slot = slots[i];
        const category = CATEGORY_POOL[Math.floor(random() * CATEGORY_POOL.length)];
        const course = COURSES[Math.floor(random() * COURSES.length)];
        const start = cursor.hour(slot.startHour).minute(i === 2 ? 0 : 30).second(0).millisecond(0);
        const end = start.add(slot.duration, "hour");
        const status = STATUS_POOL[Math.floor(random() * STATUS_POOL.length)];

        sessions.push({
          id: `demo-${cursor.format("YYYYMMDD")}-${id}`,
          title: `${category === "EXAM" ? `${course} exam` : `${course} - ${category.toLowerCase()}`}`,
          course,
          role,
          category,
          status,
          teacher: TEACHERS[Math.floor(random() * TEACHERS.length)],
          location: LOCATIONS[Math.floor(random() * LOCATIONS.length)],
          start: start.toISOString(),
          end: end.toISOString(),
          description:
            category === "EXAM"
              ? "Mid-term assessment. Bring your student card."
              : `Scheduled ${category.toLowerCase()} session for ${course}.`,
        });
        id += 1;
      }
    }

    cursor = cursor.add(1, "day");
  }

  return sessions;
};

const unwrapResponse = (data: unknown): unknown[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    for (const key of ["content", "items", "sessions", "data"]) {
      if (Array.isArray(record[key])) {
        return record[key] as unknown[];
      }
    }
  }

  return [];
};

export const scheduleApi = {
  getSessions: async (query: ScheduleQuery): Promise<StudySession[]> => {
    try {
      const response = await axiosInstance.get("/study-sessions", {
        params: {
          from: toDateString(query.from),
          to: toDateString(query.to),
          role: query.role,
        },
      });

      return unwrapResponse(response.data).map((item, index) =>
        normalizeSession(item as RawSession, index),
      );
    } catch (error) {
      console.warn(
        "[schedule-api] Backend /study-sessions is not available, using demo data instead.",
        error,
      );
      return buildDemoSessions(query);
    }
  },

  /** Read-only CRUD stubs are not needed for the calendar display. */
  getById: async (id: string): Promise<StudySession | null> => {
    const response = await axiosInstance.get(`/study-sessions/${id}`);
    return normalizeSession(response.data as RawSession, 0);
  },
};
