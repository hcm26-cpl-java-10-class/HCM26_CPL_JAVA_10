import type { LessonContentType } from "@/types/features/demo/lesson";

/** This uses the same content model as Course Manager / LessonFormModal. */
export type LessonContentDraft = {
  contentType?: LessonContentType;
  contentUrl?: string | null;
  material?: string | null;
  duration?: number | null;
  assessmentIssue?: string | null;
  planned?: boolean;
};
export const requiresResourceUrl = (type: LessonContentType) =>
  ["VIDEO", "AUDIO", "DOCUMENT", "LINK"].includes(type);

export const isAssessmentLesson = (type: LessonContentType) =>
  ["QUIZ", "EXAM", "ASSIGNMENT"].includes(type);

export function isHttpResourceUrl(value: string): boolean {
  try {
    const input = value.trim();
    if (!/^https?:\/\//i.test(input) || /[\s\\]/.test(input)) return false;
    const url = new URL(input);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch { return false; }
}

export function lessonContentIssue(lesson: LessonContentDraft): string | null {
  const type = lesson.contentType ?? "TEXT";
  if (isAssessmentLesson(type) && lesson.assessmentIssue) return lesson.assessmentIssue;
  const content = (lesson.material ?? "").trim();
  const url = (lesson.contentUrl ?? "").trim();
  if (requiresResourceUrl(type) && (!url || url.length > 500 || !isHttpResourceUrl(url))) {
    return `${type.charAt(0)}${type.slice(1).toLowerCase()} lessons require a valid resource URL (http/https, up to 500 characters).`;
  }
  // A FROM_SYLLABUS Draft may contain assessment headings without Exam content.
  // Resource lessons need their URL; notes are optional. Keep Text's existing quality rule.
  if (type === "TEXT" && (content.length < 80 || content.length > 12000)) {
    return "Add Text learning content (80–12,000 characters).";
  }
  if (requiresResourceUrl(type) && content.length > 12000) {
    return "Learning notes must not exceed 12,000 characters.";
  }
  if (lesson.duration != null && (!Number.isInteger(lesson.duration) || lesson.duration < 0 || lesson.duration > 2147483647)) {
    return "Duration must be a non-negative whole number.";
  }
  return null;
}

/** Only AI-suggested incomplete headings may skip missing material checks at Draft creation. */
export function lessonDraftSaveIssue(lesson: LessonContentDraft): string | null {
  if (lesson.duration != null && (!Number.isInteger(lesson.duration) || lesson.duration < 0 || lesson.duration > 2147483647)) {
    return "Duration must be a non-negative whole number.";
  }
  const type = lesson.contentType ?? "TEXT";
  if (lesson.planned && requiresResourceUrl(type) && !(lesson.contentUrl ?? "").trim()) {
    return (lesson.material ?? "").trim().length > 12000 ? "Learning notes must not exceed 12,000 characters." : null;
  }
  return lessonContentIssue(lesson);
}
