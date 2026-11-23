export interface LearnerGrade {
  studentId: number; studentName: string; studentEmail?: string | null;
  grade: { overallScore: number | null; status: string };
}
export const LEARNER_GRADES_PAGE_SIZE = 10;
const searchable = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLowerCase();
/** Filter the entire roster before taking a page, so matching learners are never missed. */
export function learnerGradesPage(rows: LearnerGrade[], search: string, status: string, requestedPage: number) {
  const term = searchable(search.trim());
  const filtered = rows.filter(row => (status === "ALL" || row.grade.status === status) &&
    (!term || searchable(`${row.studentName} ${row.studentEmail ?? ""} ${row.studentId}`).includes(term)));
  const totalPages = Math.max(1, Math.ceil(filtered.length / LEARNER_GRADES_PAGE_SIZE));
  const page = Math.min(totalPages, Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1);
  const offset = (page - 1) * LEARNER_GRADES_PAGE_SIZE;
  return { rows: filtered.slice(offset, offset + LEARNER_GRADES_PAGE_SIZE), page, totalPages, total: filtered.length,
    first: filtered.length ? offset + 1 : 0, last: Math.min(offset + LEARNER_GRADES_PAGE_SIZE, filtered.length) };
}
