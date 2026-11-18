/** Only course and assessment-management pages can be assessment return destinations. */
export function assessmentReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value !== value.trim()) return "/exams";
  try {
    const url = new URL(value, "https://app.invalid");
    const course = /^\/(courses|course-enrollments)\/[1-9]\d*\/?$/.test(url.pathname);
    const mapping = url.pathname === "/exams/curriculum";
    if (url.origin !== "https://app.invalid" || (!course && !mapping)) return "/exams";
    return url.pathname + url.search + url.hash;
  } catch { return "/exams"; }
}

/** Learner navigation is separate from management return destinations. */
export function learnerAssessmentReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value !== value.trim()) return "/student/exams";
  try {
    const url = new URL(value, "https://app.invalid");
    const allowed = /^\/enrollments\/[1-9]\d*\/learn\/?$/.test(url.pathname)
      || /^\/courses\/[1-9]\d*\/?$/.test(url.pathname)
      || ["/student/exams", "/invitations"].includes(url.pathname);
    return url.origin === "https://app.invalid" && allowed ? url.pathname + url.search + url.hash : "/student/exams";
  } catch { return "/student/exams"; }
}
export function assessmentPreparationPath(examId: number, returnTo: unknown) {
  return `/student/exams/${examId}/prepare?returnTo=${encodeURIComponent(learnerAssessmentReturnPath(returnTo))}`;
}
