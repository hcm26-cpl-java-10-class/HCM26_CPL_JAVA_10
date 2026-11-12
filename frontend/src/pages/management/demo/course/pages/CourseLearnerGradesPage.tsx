import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import api from "@/api/axios";
import { courseApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COURSE_GRADE_STATUS_LABEL } from "@/types/features/course-my-scores";
import { assessmentReturnPath } from "@/utils/assessment-navigation";
import { learnerGradesPage, type LearnerGrade } from "@/utils/course-learner-grades";

export default function CourseLearnerGradesPage() {
  const { id = "" } = useParams();
  const courseId = Number(id);
  const validId = Number.isInteger(courseId) && courseId > 0;
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const rawStatus = params.get("status") ?? "ALL";
  const status = Object.hasOwn(COURSE_GRADE_STATUS_LABEL, rawStatus) ? rawStatus : "ALL";
  const back = assessmentReturnPath(params.get("returnTo") || `/courses/${id}#course-assessments`);
  const results = useQuery({ queryKey: ["course-assessment-results", courseId],
    queryFn: async () => (await api.get<LearnerGrade[]>(`/courses/${courseId}/assessment-results`)).data,
    enabled: validId, retry: false });
  const course = useQuery({ queryKey: ["course-detail", courseId], queryFn: () => courseApi.getCatalogDetail(courseId), enabled: validId, retry: false });
  const roster = useMemo(() => learnerGradesPage(results.data ?? [], search, status, Number(params.get("page") || 1)), [results.data, search, status, params]);
  function update(key: string, value: string) {
    setParams(current => { const next = new URLSearchParams(current);
      if (value && value !== "ALL") next.set(key, value); else next.delete(key);
      if (key !== "page") next.delete("page"); return next;
    }, { replace: true });
  }
  return <MainLayout dense pathName={{ courses: "Courses", [id]: course.data?.name || `Course ${id}`, grades: "Learner grades" }} pathLinks={{ [id]: `/courses/${id}` }}>
    <div className="space-y-4">
      <Button asChild variant="outline" className="w-fit"><Link to={back}><ArrowLeft className="size-4" /> Back to course</Link></Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Learner grades</h1><p className="text-muted-foreground">{course.data?.name || `Course ${id}`} · 10 learners per page</p></div>
        <Button variant="outline" disabled={results.isFetching || !validId} onClick={() => void results.refetch()}>{results.isFetching ? "Refreshing…" : "Refresh grades"}</Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input className="pl-9" aria-label="Search learners" placeholder="Search by name, email or learner ID" value={search} onChange={event => update("q", event.target.value)} /></div>
        <select aria-label="Filter by grade status" className="rounded-md border bg-background px-3 py-2 text-sm" value={status} onChange={event => update("status", event.target.value)}>
          <option value="ALL">All grade statuses</option>{Object.entries(COURSE_GRADE_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {(search || status !== "ALL") && <Button variant="outline" onClick={() => setParams(current => { const next = new URLSearchParams(current); next.delete("q"); next.delete("status"); next.delete("page"); return next; }, { replace: true })}>Clear filters</Button>}
      </div>
      {!validId ? <p role="alert">Invalid course.</p> : results.isPending ? <p role="status">Loading learner grades…</p> : results.isError ?
        <p role="alert" className="text-destructive">Could not load learner grades. Only the course instructor or an administrator can access this course's roster.</p> : <>
        <p className="text-sm text-muted-foreground" role="status">Showing {roster.first}–{roster.last} of {roster.total} learners</p>
        <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm">
          <thead className="bg-muted/40"><tr><th className="p-3">Learner</th><th className="p-3">Email</th><th className="p-3">Final grade / 10</th><th className="p-3">Status</th></tr></thead>
          <tbody>{roster.rows.map(row => <tr key={row.studentId} className="border-t"><td className="p-3 font-medium">{row.studentName}</td><td className="p-3">{row.studentEmail || "—"}</td>
            <td className="p-3">{row.grade.overallScore?.toFixed(2) ?? "Pending"}</td><td className="p-3">{COURSE_GRADE_STATUS_LABEL[row.grade.status] || row.grade.status}</td></tr>)}
            {roster.total === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No learners match these filters.</td></tr>}</tbody>
        </table></div>
        <nav aria-label="Learner grades pagination" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Page {roster.page} of {roster.totalPages}</p><div className="flex gap-2">
            <Button variant="outline" disabled={roster.page <= 1} onClick={() => update("page", String(roster.page - 1))}>Previous</Button>
            <Button variant="outline" disabled={roster.page >= roster.totalPages} onClick={() => update("page", String(roster.page + 1))}>Next</Button>
          </div>
        </nav>
      </>}
    </div>
  </MainLayout>;
}
