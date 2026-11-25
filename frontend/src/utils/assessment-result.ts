import type { ExamAttemptSummary } from "@/api/exam.api";
export function assessmentResult(a: Pick<ExamAttemptSummary, "status" | "resultPublished" | "finalScore" | "passed">) {
  if (!a.resultPublished || a.finalScore == null || ["IN_PROGRESS", "NOT_STARTED", "PENDING_REVIEW"].includes(a.status)) return null;
  return a.passed == null ? "COMPLETED" : a.passed ? "PASSED" : "FAILED";
}
const seen = new Set<string>();
export function hasResultNotice(accountAttempt: string): boolean {
  const key = `assessment-result-notice:${accountAttempt}`;
  if (seen.has(key)) return true;
  try { return !!localStorage.getItem(key); } catch { return false; }
}
export function claimResultNotice(accountAttempt: string): boolean {
  const key = `assessment-result-notice:${accountAttempt}`;
  if (seen.has(key)) return false;
  seen.add(key);
  try { if (localStorage.getItem(key)) return false; localStorage.setItem(key, "1"); } catch { /* In-memory tracking remains available. */ }
  return true;
}
