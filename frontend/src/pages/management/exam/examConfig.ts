import { EXAM_CATEGORY_LABEL, type ExamCategory, type ExamDTO, type ExamType, type LatePolicy, type ResultVisibility } from "@/types";

export interface ExamConfigForm {
  maxAttempts: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showAnswersAfterExam: boolean;
  /** "" = not chosen yet (the teacher must pick one). */
  category: ExamCategory | "";
  passScore: string;
  maxScore: string;
  courseWeight: string;
  latePolicy: LatePolicy;
  latePenaltyPercent: string;
  lateGraceMinutes: string;
  resultVisibility: ResultVisibility;
  /** "" = not chosen yet (the teacher must pick one). */
  examType: ExamType | "";
  accessCode: string;
  // NEW (anti-cheat)
  antiCheatEnabled: boolean;
  detectTabSwitch: boolean;
  blockCopyPaste: boolean;
  requireFullscreen: boolean;
  singleSession: boolean;
  cameraProctoring: boolean;
  notifyOnViolation: boolean;
  /** Anti-cheat coefficients, set at creation only. "" = keep the default. */
  headTurnAngleDeg: string;
  headTurnSeconds: string;
  fastSubmitPercent: string;
  /** Optional link to a course / section / lesson ("" = not linked). */
  courseId: string;
  sectionId: string;
  lessonId: string;
  courseName?: string;
  sectionTitle?: string;
  lessonTitle?: string;
}

export const DEFAULT_CONFIG: ExamConfigForm = {
  maxAttempts: "",
  shuffleQuestions: false,
  shuffleOptions: false,
  showAnswersAfterExam: true,
  category: "",
  passScore: "",
  maxScore: "",
  courseWeight: "",
  latePolicy: "NOT_ALLOWED",
  latePenaltyPercent: "",
  lateGraceMinutes: "0",
  resultVisibility: "IMMEDIATE",
  examType: "",
  accessCode: "",
  antiCheatEnabled: false,
  detectTabSwitch: true,
  blockCopyPaste: true,
  requireFullscreen: false,
  singleSession: true,
  cameraProctoring: false,
  notifyOnViolation: false,
  headTurnAngleDeg: "",
  headTurnSeconds: "",
  fastSubmitPercent: "",
  courseId: "",
  sectionId: "",
  lessonId: "",
  courseName: "",
  sectionTitle: "",
  lessonTitle: "",
};

export const LATE_POLICY_LABEL: Record<LatePolicy, string> = {
  NOT_ALLOWED: "Late submission not allowed",
  ALLOWED_WITH_PENALTY: "Allowed with point penalty",
  ALLOWED: "Allowed with no penalty",
};

export const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  MULTIPLE_CHOICE: "Multiple Choice Only",
  ESSAY: "Essay Only",
  CODING: "Coding Only",
  MC_CODING: "Multiple Choice & Coding",
  MIXED: "Mixed (Multiple Choice, Essay & Coding)",
};

export const EXAM_CATEGORY_OPTIONS = Object.keys(EXAM_CATEGORY_LABEL) as ExamCategory[];

export const RESULT_VISIBILITY_LABEL: Record<ResultVisibility, string> = {
  IMMEDIATE: "View immediately after grading",
  AFTER_EXAM_CLOSED: "View after exam closes",
  MANUAL_RELEASE: "Manually released by teacher",
};

export const getLocalDatetimeString = (date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const getFutureDatetimeString = (minutesAhead: number) =>
  getLocalDatetimeString(new Date(Date.now() + minutesAhead * 60 * 1000));

/** Keep an enum value only when it is one of the known options (unknown / empty -> fallback). */
const pickEnum = <T extends string, F extends string = T>(
  value: string | null | undefined,
  allowed: Record<T, unknown>,
  fallback: F,
): T | F => (value && value in allowed ? (value as T) : fallback);

export const configFromExam = (exam: ExamDTO): ExamConfigForm => ({
  maxAttempts: String(exam.maxAttempts ?? 1),
  shuffleQuestions: exam.shuffleQuestions ?? false,
  shuffleOptions: exam.shuffleOptions ?? false,
  showAnswersAfterExam: exam.showAnswersAfterExam ?? false,
  category: pickEnum(exam.category, EXAM_CATEGORY_LABEL, ""),
  passScore: exam.passScore != null ? String(exam.passScore) : "",
  courseWeight: exam.courseWeight != null ? String(exam.courseWeight) : "",
  maxScore: exam.maxScore != null ? String(exam.maxScore) : "",
  latePolicy: pickEnum(exam.latePolicy, LATE_POLICY_LABEL, "NOT_ALLOWED"),
  latePenaltyPercent: exam.latePenaltyPercent != null ? String(exam.latePenaltyPercent) : "",
  lateGraceMinutes: String(exam.lateGraceMinutes ?? 0),
  // AFTER_EXAM_CLOSED is a legacy value (exams no longer have a close time): treated as manual release.
  resultVisibility: pickEnum(
    exam.resultVisibility === "AFTER_EXAM_CLOSED" ? "MANUAL_RELEASE" : exam.resultVisibility,
    RESULT_VISIBILITY_LABEL,
    "IMMEDIATE",
  ),
  examType: pickEnum(exam.examType, EXAM_TYPE_LABEL, ""),
  accessCode: exam.accessCode ?? "",
  antiCheatEnabled: exam.antiCheatEnabled ?? false,
  detectTabSwitch: exam.detectTabSwitch ?? false,
  blockCopyPaste: exam.blockCopyPaste ?? false,
  requireFullscreen: exam.requireFullscreen ?? false,
  singleSession: exam.singleSession ?? false,
  cameraProctoring: exam.cameraProctoring ?? false,
  notifyOnViolation: exam.notifyOnViolation ?? false,
  headTurnAngleDeg: exam.headTurnAngleDeg != null ? String(exam.headTurnAngleDeg) : "",
  headTurnSeconds: exam.headTurnSeconds != null ? String(exam.headTurnSeconds) : "",
  fastSubmitPercent: exam.fastSubmitPercent != null ? String(exam.fastSubmitPercent) : "",
  courseId: exam.courseId != null ? String(exam.courseId) : "",
  sectionId: exam.sectionId != null ? String(exam.sectionId) : "",
  lessonId: exam.lessonId != null ? String(exam.lessonId) : "",
  courseName: exam.courseName ?? "",
  sectionTitle: exam.sectionTitle ?? "",
  lessonTitle: exam.lessonTitle ?? "",
});

/** Required selects that must be chosen by the teacher (no default value). */
export function getRequiredFieldErrors(cfg: ExamConfigForm): { examType?: string; category?: string; maxAttempts?: string } {
  const errors: { examType?: string; category?: string; maxAttempts?: string } = {};
  if (!cfg.examType) errors.examType = "Please select a question format.";
  if (!cfg.category) errors.category = "Please select a category.";
  // blank = default 1 attempt
  if (cfg.maxAttempts.trim() !== "" && !(Number(cfg.maxAttempts) >= 1)) errors.maxAttempts = "Maximum attempts must be at least 1.";
  return errors;
}

export function validateConfig(_duration: number, cfg: ExamConfigForm): string | null {
  const required = getRequiredFieldErrors(cfg);
  if (required.examType) return required.examType;
  if (required.category) return required.category;
  if (required.maxAttempts) return required.maxAttempts;

  if (cfg.maxAttempts.trim() !== "" && !(Number(cfg.maxAttempts) >= 1)) return "Maximum attempts must be at least 1.";
  if (cfg.courseWeight !== "" && (!Number.isFinite(Number(cfg.courseWeight)) || Number(cfg.courseWeight)<0 || Number(cfg.courseWeight)>100 || !/^\d+(\.\d{1,2})?$/.test(cfg.courseWeight))) return "Course weight must be 0–100 with at most two decimal places.";
  if (cfg.maxScore !== "" && !(Number(cfg.maxScore) > 0 && Number(cfg.maxScore) <= 1000)) return "Max score must be greater than 0 and at most 1000.";
  if (cfg.passScore !== "" && Number(cfg.passScore) < 0) return "Passing score must be >= 0.";
  if (cfg.passScore !== "" && Number(cfg.passScore) > (cfg.maxScore !== "" ? Number(cfg.maxScore) : 10)) return "Passing score cannot exceed the max score.";
  if (cfg.latePolicy === "ALLOWED_WITH_PENALTY") {
    const pct = Number(cfg.latePenaltyPercent);
    if (!(pct >= 1 && pct <= 100)) return "Late penalty percentage must be between 1% and 100%.";
  }
  if (Number(cfg.lateGraceMinutes) < 0) return "Grace period minutes must be >= 0.";
  if (cfg.latePolicy === "NOT_ALLOWED" && Number(cfg.lateGraceMinutes) > 0) return "Grace period can only be set when late submissions are allowed.";
  return null;
}

export const getErrorMessage = (error: unknown, fallback: string): string => {
  const err = error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
  const data = err?.response?.data;
  const fieldError = data?.errors ? (Object.values(data.errors).flat()[0]) : undefined;
  return fieldError || data?.message || fallback;
};

/** Request body for creating / updating an exam from the form values. */
export function buildExamRequest(title: string, duration: string, cfg: ExamConfigForm, isActive: boolean) {
  return {
    title: title.trim(),
    durationMinutes: Number(duration),
    isActive,
    maxAttempts: cfg.maxAttempts.trim() === "" ? 1 : Number(cfg.maxAttempts),
    shuffleQuestions: cfg.shuffleQuestions,
    shuffleOptions: cfg.shuffleOptions,
    showAnswersAfterExam: cfg.showAnswersAfterExam,
    category: cfg.category || undefined,
    // blank = 5 (capped at the max score when that is lower)
    passScore: cfg.passScore !== "" ? Number(cfg.passScore) : Math.min(5, cfg.maxScore !== "" ? Number(cfg.maxScore) : 10),
    courseWeight: cfg.courseWeight !== "" ? Number(cfg.courseWeight) : null,
    maxScore: cfg.maxScore !== "" ? Number(cfg.maxScore) : undefined,
    latePolicy: cfg.latePolicy || undefined,
    latePenaltyPercent:
      cfg.latePolicy === "ALLOWED_WITH_PENALTY" && cfg.latePenaltyPercent !== ""
        ? Number(cfg.latePenaltyPercent)
        : undefined,
    lateGraceMinutes: Number(cfg.lateGraceMinutes || 0),
    resultVisibility: cfg.resultVisibility || undefined,
    examType: cfg.examType || undefined,
    accessCode: cfg.accessCode ? cfg.accessCode.trim() : "",
    antiCheatEnabled: cfg.antiCheatEnabled,
    detectTabSwitch: cfg.detectTabSwitch,
    blockCopyPaste: cfg.blockCopyPaste,
    requireFullscreen: cfg.requireFullscreen,
    singleSession: cfg.singleSession,
    cameraProctoring: cfg.cameraProctoring,
    notifyOnViolation: cfg.notifyOnViolation,
    // blank = default; the server ignores these once students have attempted the exam
    headTurnAngleDeg: cfg.headTurnAngleDeg ? Number(cfg.headTurnAngleDeg) : null,
    headTurnSeconds: cfg.headTurnSeconds ? Number(cfg.headTurnSeconds) : null,
    fastSubmitPercent: cfg.fastSubmitPercent ? Number(cfg.fastSubmitPercent) : null,
    // null (not undefined) so that clearing the link on an existing exam is sent to the server
    courseId: cfg.courseId ? Number(cfg.courseId) : null,
    sectionId: cfg.sectionId ? Number(cfg.sectionId) : null,
    lessonId: cfg.lessonId ? Number(cfg.lessonId) : null,
  };
}
