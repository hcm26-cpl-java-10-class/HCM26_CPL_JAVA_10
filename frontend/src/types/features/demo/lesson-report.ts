export type LessonReportReason =
  | "BROKEN_CONTENT"
  | "INCORRECT_CONTENT"
  | "OUTDATED_CONTENT"
  | "INAPPROPRIATE_CONTENT"
  | "OTHER";

export interface LessonReport {
  id: number;
  lessonId: number;
  reporterId: number;
  reporterName: string;
  reason: LessonReportReason;
  detail?: string | null;
  status: "OPEN" | "RESOLVED";
  createdAt?: string | null;
}

export interface LessonReportRequest {
  reason: LessonReportReason;
  detail?: string;
}

export type LessonReportStatus = "OPEN" | "RESOLVED";

/** A report with its lesson / section / course, for the instructor's reports page. */
export interface LessonReportInbox {
  id: number;
  reason: LessonReportReason;
  detail?: string | null;
  status: LessonReportStatus;
  createdAt?: string | null;
  reporterId: number;
  reporterName: string;
  lessonId: number;
  lessonTitle: string;
  sectionId: number;
  sectionTitle: string;
  courseId: number;
  courseName: string;
}

export interface LessonReportInboxPage {
  content: LessonReportInbox[];
  totalElements: number;
  totalPages: number;
  /** Zero-based index of this page. */
  number: number;
}
