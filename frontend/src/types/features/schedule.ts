/**
 * Study-session schedule types used by the calendar page.
 */

export type ScheduleRole = "STUDENT" | "TEACHER";

export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export type SessionCategory = "LESSON" | "REVIEW" | "EXAM" | "PROJECT" | "MENTORING";

export interface StudySession {
  id: string;
  /** Display title, e.g. "Math - Lesson 12" */
  title: string;
  /** Course / subject the session belongs to */
  course: string;
  /** Which role this schedule entry belongs to */
  role: ScheduleRole;
  category: SessionCategory;
  status: SessionStatus;
  teacher: string;
  location: string;
  /** ISO-8601 start */
  start: string;
  /** ISO-8601 end */
  end: string;
  description?: string;
  allDay?: boolean;
  /** Optional event color override (hex). Defaults to category color. */
  color?: string;
}

export interface ScheduleQuery {
  /** ISO-8601 range start */
  from: string;
  /** ISO-8601 range end */
  to: string;
  role?: ScheduleRole;
}

export type ScheduleView = "month" | "week";
