import { courseMappingReturnPath } from "@/utils/assessment-navigation";
import { Input } from "@/components/ui/input";
import { validateWeightDraft } from "@/utils/course-weight-draft";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import api from "@/api/axios";
import { examApi } from "@/api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
type Plan = { totalWeight: number; ready: boolean; issues: string[] };
const formatWeight = (weight: number) => Number(weight.toFixed(2)).toString();
type CourseAssessmentPanelProps = { courseId: number; showManageLinks?: boolean };
export function CourseAssessmentPanel(props: CourseAssessmentPanelProps) {
  return <CourseAssessmentPanelContent key={props.courseId} {...props} />;
}
function CourseAssessmentPanelContent({ courseId, showManageLinks = true }: CourseAssessmentPanelProps) {
  const { hasPermission, activeRole } = usePermissions();
  const location = useLocation();
  const client = useQueryClient();
  const targetLessonId = Number(new URLSearchParams(location.search).get("assessmentLessonId"));
  const targetSectionId = Number(new URLSearchParams(location.search).get("assessmentSectionId"));
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [saved, setSaved] = useState(false);
  const returnTo = location.pathname + location.search + "#course-assessments";
  const returnQuery = "?returnTo=" + encodeURIComponent(returnTo);
  useEffect(() => {
    if (location.hash === "#course-assessments") document.getElementById("course-assessments")?.scrollIntoView({ block: "start" });
  }, [location.hash]);
  const staff = activeRole !== "STUDENT" && activeRole !== "GUEST" && (hasPermission("COURSE_UPDATE") || hasPermission("EXAM_READ"));
  const canEdit = staff && hasPermission("EXAM_UPDATE");
  const plan = useQuery({ queryKey: ["course-assessment-plan", courseId],
    queryFn: async () => (await api.get<Plan>(`/courses/${courseId}/assessment-plan`)).data, enabled: staff && courseId > 0 });
  const exams = useQuery({ queryKey: ["course-exams", courseId], queryFn: () => examApi.listByCourse(courseId), enabled: staff && courseId > 0 });
  useEffect(() => {
    if (!targetLessonId || !exams.data) return;
    const frame = requestAnimationFrame(() => {
      const assessment = exams.data.find(exam => exam.lessonId === targetLessonId);
      const target = assessment ? document.getElementById(`course-assessment-${assessment.id}`) : null;
      target?.scrollIntoView({ block: "center" }); target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [targetLessonId, exams.data]);
  const validation = validateWeightDraft(draft ?? {});
  if (draft && (exams.data ?? []).some(e => e.courseWeight != null && !draft[e.id]?.trim()))
    validation.error = "Enter a weight for each edited assessment; use 0 for practice.";
  const saving = useMutation({
    mutationFn: async () => {
      if (!draft || validation.error) throw new Error(validation.error || "No weights to save");
      const updates = (exams.data ?? []).filter(e => draft[e.id] !== (e.courseWeight == null ? "" : String(e.courseWeight)))
        .map(e => ({ examId: e.id, weight: Number(draft[e.id]) }));
      await api.put(`/courses/${courseId}/exam-weights`, updates);
    },
    onSuccess: async () => {
      setDraft(null); setSaved(true);
      await Promise.all([client.invalidateQueries({ queryKey: ["course-exams", courseId] }), client.invalidateQueries({ queryKey: ["course-assessment-plan", courseId] })]);
    },
  });
  const dirty = !!draft && (exams.data ?? []).some(e => draft[e.id] !== (e.courseWeight == null ? "" : String(e.courseWeight)));
  const editWeights = () => {
    setSaved(false); saving.reset();
    setDraft(Object.fromEntries((exams.data ?? []).map(exam => [exam.id, exam.courseWeight == null ? "" : String(exam.courseWeight)])));
  };
  if (!staff) return null;
  return <section id="course-assessments" className="scroll-mt-4 space-y-3 rounded-xl border bg-card p-4" aria-label="Course assessments and grading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Assessments and course grading</h2>
      <div className="flex flex-wrap gap-2">{showManageLinks && <Button asChild variant="outline"><Link to={`/exams/curriculum?courseId=${courseId}&returnTo=${encodeURIComponent(courseMappingReturnPath(returnTo, courseId))}`}>Manage assessment links</Link></Button>}
        <Button variant="outline" disabled={!!draft || saving.isPending} onClick={() => { void plan.refetch(); void exams.refetch(); }}>Refresh</Button></div>
    </div>
    {plan.isPending ? <p role="status">Loading assessment plan…</p> : plan.isError ? <p role="alert">Could not load the assessment plan.</p> : <>
      <p>Assessment weights: <strong>{formatWeight(plan.data.totalWeight)}% / 100%</strong> · {plan.data.ready ? "Ready" : "Plan incomplete"}
        {" · "}{plan.data.totalWeight <= 100
          ? `${formatWeight(100 - plan.data.totalWeight)}% remaining`
          : `${formatWeight(plan.data.totalWeight - 100)}% over target`}</p>
      <p className="text-sm text-muted-foreground">An incomplete course plan does not block an otherwise available Quiz or Exam. The course needs a complete 100% plan to calculate final grades and award course completion or certificates. Final grade = sum of each assessment's normalized score × its weight. Pass threshold: 5/10. Results must be fully graded and published. A 0% assessment is practice.</p>
      {plan.data.issues.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">{plan.data.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
    </>}
    {canEdit && !draft && <Button variant="outline" disabled={!exams.data?.length || exams.isFetching} onClick={editWeights}>Edit weights</Button>}
    {saved && <p role="status">Assessment weights saved.</p>}
    {draft && <div className="space-y-3 rounded-xl border p-4">
      <p role="status">{dirty ? "Unsaved changes" : "Editing weights"}. Total: {formatWeight(validation.total)}% / 100% · {validation.total > 100 ? `${formatWeight(validation.total-100)}% over allocated` : `${formatWeight(100-validation.total)}% remaining`}</p>
      <p className="text-sm text-muted-foreground">0% means practice. Incomplete plans can be saved. Existing published gradebook snapshots and certificates are preserved; publishing gradebook changes remains a separate action in Score Management.</p>
      {validation.error && <p role="alert" className="text-destructive">{validation.error}</p>}
      {saving.isError && <p role="alert" className="text-destructive">{(saving.error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not save weights. Your values are retained. Check permissions and course totals, then retry."}</p>}
      <div className="flex gap-2"><Button disabled={!dirty || !!validation.error || saving.isPending} onClick={() => saving.mutate()}>{saving.isPending ? "Saving weights…" : "Save weights"}</Button><Button variant="outline" disabled={saving.isPending} onClick={() => { setDraft(null); saving.reset(); }}>Cancel</Button></div>
    </div>}
    {targetLessonId > 0 && <div className="space-y-2 rounded border p-3">
      <Button asChild variant="outline"><Link to={`/curriculum?courseId=${courseId}${targetSectionId > 0 ? `&sectionId=${targetSectionId}&lessonId=${targetLessonId}` : ""}`}>Back to Curriculum</Link></Button>
      {exams.isSuccess && !exams.data.some(exam => exam.lessonId === targetLessonId) && <p role="status">This lesson has no linked assessment yet. <Link className="underline" to={`/exams/curriculum?courseId=${courseId}&returnTo=${encodeURIComponent(returnTo)}`}>Configure its assessment link</Link> using Assessment Management.</p>}
    </div>}
    {exams.isLoading && <p role="status">Loading linked assessments.</p>}
    {exams.isError && <p role="alert">Could not load linked assessments.</p>}
    {exams.data?.length === 0 && <p>No assessments linked. Courses without assessments use lesson completion.</p>}
    <div className="space-y-2">{exams.data?.map(exam => <div key={exam.id} id={`course-assessment-${exam.id}`} tabIndex={-1} aria-label={`Configure ${exam.title}`} className={`grid items-center gap-4 rounded border p-3 ${exam.lessonId === targetLessonId ? "ring-2 ring-ring" : ""} ${draft ? "lg:grid-cols-[minmax(0,1fr)_9rem_auto]" : "sm:grid-cols-[minmax(0,1fr)_auto]"}`}>
      <div className="min-w-0 break-words"><p className="font-medium">{exam.title}</p><p className="text-sm text-muted-foreground">{exam.category} · Weight: {exam.courseWeight == null ? "Not set" : `${exam.courseWeight}%`} · {exam.lessonTitle || exam.sectionTitle || "Course assessment"}</p></div>
      {draft && <div className="flex w-full min-w-0 flex-col gap-1.5 text-sm">
        <label htmlFor={`assessment-weight-${courseId}-${exam.id}`} className="font-medium">Weight (%)</label>
        <Input id={`assessment-weight-${courseId}-${exam.id}`} aria-label={`Weight (%) for ${exam.title}`} autoFocus={exam.lessonId === targetLessonId} className="block w-full tabular-nums" inputMode="decimal" value={draft[exam.id] ?? ""} disabled={saving.isPending} onChange={e => setDraft({ ...draft, [exam.id]: e.target.value })} />
      </div>}
      <div className="flex flex-wrap gap-2">
        {canEdit && !draft && exam.lessonId === targetLessonId && <Button variant="outline" size="sm" onClick={editWeights}>Edit assessment weight</Button>}
        <Button asChild variant="outline" size="sm" className="w-full lg:w-auto"><Link to={`/exams/${exam.id}${returnQuery}`}>Questions, settings and results</Link></Button>
      </div>
    </div>)}</div>
    <Button asChild variant="outline"><Link to={`/courses/${courseId}/grades?returnTo=${encodeURIComponent(returnTo)}`}>View learner grades</Link></Button>
  </section>;
}
