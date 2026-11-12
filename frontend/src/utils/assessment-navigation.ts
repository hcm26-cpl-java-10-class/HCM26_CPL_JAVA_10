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
