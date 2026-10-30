import type { LessonReportReason } from "@/types";

export const LESSON_REPORT_REASONS: { value: LessonReportReason; label: string }[] = [
  { value: "BROKEN_CONTENT", label: "Video, audio or link does not work" },
  { value: "INCORRECT_CONTENT", label: "Content is incorrect" },
  { value: "OUTDATED_CONTENT", label: "Content is outdated" },
  { value: "INAPPROPRIATE_CONTENT", label: "Inappropriate content" },
  { value: "OTHER", label: "Other" },
];

export function lessonReportReasonLabel(reason: LessonReportReason): string {
  return LESSON_REPORT_REASONS.find((item) => item.value === reason)?.label ?? reason;
}
