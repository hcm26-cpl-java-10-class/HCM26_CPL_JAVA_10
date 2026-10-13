import dayjs from "dayjs";
import type { SessionCategory, StudySession } from "@/types/features/schedule";

/* ------------------------------------------------------------------ */
/*  Calendar math (weeks start on Monday, like Google Calendar in VN)  */
/* ------------------------------------------------------------------ */

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const startOfWeek = (date: dayjs.Dayjs): dayjs.Dayjs =>
  date.subtract((date.day() + 6) % 7, "day").startOf("day");

export const getWeekDays = (anchor: dayjs.Dayjs): dayjs.Dayjs[] =>
  Array.from({ length: 7 }, (_, index) => startOfWeek(anchor).add(index, "day"));

export const getMonthGrid = (year: number, month: number): dayjs.Dayjs[] => {
  const first = dayjs(new Date(year, month, 1)).startOf("day");
  const offset = (first.day() + 6) % 7;
  const daysInMonth = first.daysInMonth();
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
  const gridStart = first.subtract(offset, "day");

  return Array.from({ length: cellCount }, (_, index) => gridStart.add(index, "day"));
};

export const isSameDay = (left: dayjs.Dayjs, right: dayjs.Dayjs): boolean =>
  left.isSame(right, "day");

export const isToday = (date: dayjs.Dayjs): boolean => isSameDay(date, dayjs());

/* ------------------------------------------------------------------ */
/*  Session helpers                                                    */
/* ------------------------------------------------------------------ */

export const getSessionsForDay = (sessions: StudySession[], day: dayjs.Dayjs): StudySession[] =>
  sessions.filter((session) => {
    if (!session.start) return false;
    return isSameDay(dayjs(session.start), day);
  });

export const sortSessionsByStart = (sessions: StudySession[]): StudySession[] =>
  [...sessions].sort((a, b) => dayjs(a.start).valueOf() - dayjs(b.start).valueOf());

/** Minutes from 00:00 for an ISO date, clamped to a 24h window. */
export const minutesOfDay = (iso: string): number => {
  const value = dayjs(iso);
  return value.hour() * 60 + value.minute();
};

export const sessionDurationMinutes = (session: StudySession): number =>
  Math.max(dayjs(session.end).diff(dayjs(session.start), "minute"), 15);

/* ------------------------------------------------------------------ */
/*  Week-view lane layout (Google Calendar style side-by-side events)  */
/* ------------------------------------------------------------------ */

export interface LaidOutSession {
  session: StudySession;
  /** 0-based column inside its overlapping cluster */
  lane: number;
  /** Total columns in its overlapping cluster */
  lanes: number;
}

export const layoutDaySessions = (sessions: StudySession[]): LaidOutSession[] => {
  const sorted = [...sessions].sort((a, b) => {
    const startDiff = dayjs(a.start).valueOf() - dayjs(b.start).valueOf();
    if (startDiff !== 0) return startDiff;
    return dayjs(b.end).valueOf() - dayjs(a.end).valueOf();
  });

  const clusters: StudySession[][] = [];
  let current: StudySession[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  for (const session of sorted) {
    const start = dayjs(session.start).valueOf();
    const end = dayjs(session.end).valueOf();

    if (start < clusterEnd) {
      current.push(session);
      clusterEnd = Math.max(clusterEnd, end);
    } else {
      if (current.length > 0) clusters.push(current);
      current = [session];
      clusterEnd = end;
    }
  }

  if (current.length > 0) clusters.push(current);

  const result: LaidOutSession[] = [];

  for (const cluster of clusters) {
    const laneEnds: number[] = [];

    for (const session of cluster) {
      const start = dayjs(session.start).valueOf();
      const end = dayjs(session.end).valueOf();
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);

      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }

      result.push({ session, lane, lanes: cluster.length });
    }
  }

  return result;
};

/* ------------------------------------------------------------------ */
/*  Category colors (Google Calendar palette)                          */
/* ------------------------------------------------------------------ */

export const SESSION_CATEGORY_COLORS: Record<SessionCategory, string> = {
  LESSON: "#039BE5",
  REVIEW: "#33B679",
  EXAM: "#E67C73",
  PROJECT: "#F6C026",
  MENTORING: "#7986CB",
};

export const DEFAULT_SESSION_COLOR = "#039BE5";

export const getSessionColor = (session: StudySession): string =>
  session.color || SESSION_CATEGORY_COLORS[session.category] || DEFAULT_SESSION_COLOR;

/** "rgb(r g b / alpha)" from a hex color. */
export const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const int = parseInt(full, 16);
  const red = (int >> 16) & 255;
  const green = (int >> 8) & 255;
  const blue = int & 255;

  return `rgb(${red} ${green} ${blue} / ${alpha})`;
};

export const darken = (hex: string, amount: number): string => {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  const int = parseInt(full, 16);
  const red = Math.max(0, Math.min(255, ((int >> 16) & 255) - amount));
  const green = Math.max(0, Math.min(255, ((int >> 8) & 255) - amount));
  const blue = Math.max(0, Math.min(255, (int & 255) - amount));

  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
};

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

export const formatSessionTime = (session: StudySession): string =>
  `${dayjs(session.start).format("HH:mm")} – ${dayjs(session.end).format("HH:mm")}`;

export const formatLongDate = (date: dayjs.Dayjs): string =>
  date.format("dddd, MMMM D, YYYY");
