import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import api from "@/api/axios";
import { examApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
type Plan = { totalWeight: number; ready: boolean; issues: string[] };
export function CourseAssessmentPanel({ courseId }: { courseId: number }) {
  const { hasPermission, activeRole } = usePermissions();
  const location = useLocation();
  const returnTo = location.pathname + location.search + "#course-assessments";
  const returnQuery = "?returnTo=" + encodeURIComponent(returnTo);
  useEffect(() => {
    if (location.hash === "#course-assessments") document.getElementById("course-assessments")?.scrollIntoView({ block: "start" });
  }, [location.hash]);
  const staff = hasPermission("COURSE_UPDATE") || (activeRole !== "STUDENT" && activeRole !== "GUEST" && hasPermission("EXAM_READ"));
  const plan = useQuery({ queryKey: ["course-assessment-plan", courseId],
    queryFn: async () => (await api.get<Plan>(`/courses/${courseId}/assessment-plan`)).data, enabled: staff && courseId > 0 });
  const exams = useQuery({ queryKey: ["course-exams", courseId], queryFn: () => examApi.listByCourse(courseId), enabled: staff && courseId > 0 });
  if (!staff) return null;
  return <section id="course-assessments" className="scroll-mt-4 space-y-3 rounded-xl border bg-card p-4" aria-label="Course assessments and grading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Assessments and course grading</h2>
      <div className="flex gap-2"><Button asChild variant="outline"><Link to={`/exams/curriculum?courseId=${courseId}`}>Manage assessment links</Link></Button>
        <Button variant="outline" onClick={() => { void plan.refetch(); void exams.refetch(); }}>Refresh</Button></div>
    </div>
    {plan.isPending ? <p role="status">Loading assessment plan…</p> : plan.isError ? <p role="alert">Could not load the assessment plan.</p> : <>
      <p>Assessment weights: <strong>{plan.data.totalWeight}% / 100%</strong> · {plan.data.ready ? "Ready" : "Plan incomplete"}</p>
      <p className="text-sm text-muted-foreground">Final grade = sum of each assessment's normalized score × its weight. Pass threshold: 5/10. Results must be fully graded and published. A 0% assessment is practice.</p>
      {plan.data.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">{plan.data.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
    </>}
    {exams.isError && <p role="alert">Could not load linked assessments.</p>}
    {exams.data?.length === 0 && <p>No assessments linked. Courses without assessments use lesson completion.</p>}
    <div className="space-y-2">{exams.data?.map(exam => <div key={exam.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3">
      <div><p className="font-medium">{exam.title}</p><p className="text-sm text-muted-foreground">{exam.category} · Weight: {exam.courseWeight == null ? "Not set" : `${exam.courseWeight}%`} · {exam.lessonTitle || exam.sectionTitle || "Course assessment"}</p></div>
      <Button asChild variant="outline" size="sm"><Link to={`/exams/${exam.id}${returnQuery}`}>Questions, settings and results</Link></Button>
    </div>)}</div>
    <Button asChild variant="outline"><Link to={`/courses/${courseId}/grades?returnTo=${encodeURIComponent(returnTo)}`}>View learner grades</Link></Button>
  </section>;
}
