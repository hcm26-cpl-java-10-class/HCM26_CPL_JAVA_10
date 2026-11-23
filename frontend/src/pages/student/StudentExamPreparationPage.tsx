import { useAuth } from "@/contexts/AuthContext";
import { assessmentResult, claimResultNotice, hasResultNotice } from "@/utils/assessment-result";
import { getExamPreparation, startOrResumeExam } from "@/api/exam.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assessmentPreparationPath, learnerAssessmentReturnPath } from "@/utils/assessment-navigation";
import { formatScore } from "@/utils/examScore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, ClipboardCheck, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

function AssessmentResultNotice({ noticeKey, passed, attemptNumber, className }: { noticeKey: string; passed: boolean; attemptNumber: number; className: string }) {
  const [visible, setVisible] = useState(() => !hasResultNotice(noticeKey));
  useEffect(() => { claimResultNotice(noticeKey); }, [noticeKey]);
  if (!visible) return null;
  return <div role="status" aria-live="polite" aria-atomic="true" className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${className}`}>
    <span>{passed ? "Assessment passed." : "Assessment not passed."} Attempt {attemptNumber}.</span>
    <Button variant="ghost" onClick={() => setVisible(false)} aria-label="Dismiss assessment result">Dismiss</Button>
  </div>;
}

export function AssessmentPreparationContent({ id, returnTo: returnPath, onNext, onPrevious }: { id: number; returnTo?: string; onNext?: () => void; onPrevious?: () => void }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const returnTo = learnerAssessmentReturnPath(returnPath ?? new URLSearchParams(location.search).get("returnTo") ?? location.state?.returnTo);
  const courseReturn = returnTo.startsWith("/enrollments/") || returnTo.startsWith("/courses/");
  const query = useQuery({ queryKey: ["exam-preparation", id, user?.email], queryFn: () => getExamPreparation(id), enabled: Number.isSafeInteger(id) && id > 0, retry: false });
  const start = useMutation({
    mutationFn: () => startOrResumeExam(id, password),
    onSuccess: attempt => {
      client.setQueryData(["student-exam-attempt", id], attempt);
      void client.invalidateQueries({ queryKey: ["student-exam-attempts"] });
      void client.invalidateQueries({ queryKey: ["exam-preparation", id, user?.email] });
      navigate(`/student/exams/${id}/take?returnTo=${encodeURIComponent(returnTo)}`, { state: { returnTo } });
    },
    onError: () => { void query.refetch(); },
  });
  const data = query.data;
  const exam = data?.exam;
  const latest = [...(data?.attempts ?? [])].sort((a,b) => b.summary.attemptNumber-a.summary.attemptNumber)[0];
  const result = latest ? assessmentResult(latest.summary) : null;
  const noticeKey = user?.email && latest && result ? `${user.email}:${latest.summary.id}` : "";
  const resultClass = result === "PASSED" ? "border-green-300 bg-green-100 text-green-950 dark:border-green-800 dark:bg-green-950 dark:text-green-100" : result === "FAILED" ? "border-red-300 bg-red-100 text-red-950 dark:border-red-800 dark:bg-red-950 dark:text-red-100" : "border bg-muted";
  const errorMessage = (start.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;
  return <>
    <div className="mx-auto max-w-5xl space-y-5">
      {!returnPath && <Button variant="ghost" onClick={() => navigate(returnTo)}><ArrowLeft className="mr-2 size-4" />{courseReturn ? "Back to course" : returnTo === "/invitations" ? "Back to invitations" : "Back to assessments"}</Button>}
      {query.isLoading && <p role="status">Loading assessment overview…</p>}
      {(query.isError || !Number.isSafeInteger(id) || id < 1) && <div role="alert" className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Assessment unavailable</h1><p className="mt-2 text-muted-foreground">This assessment may be inactive, or your account may not have access.</p><Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>}
      {data && exam && <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <header className="flex items-center justify-between gap-6 bg-blue-50 p-6 sm:p-10 dark:bg-blue-950/50">
          <div className="space-y-3"><p className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200"><ClipboardCheck className="size-4" />Assessment overview</p><h1 className="text-2xl font-bold sm:text-3xl">{exam.title}</h1>{exam.courseName && <p className="flex items-center gap-2 text-muted-foreground"><BookOpen className="size-4" />{[exam.courseName, exam.sectionTitle, exam.lessonTitle].filter(Boolean).join(" › ")}</p>}</div>
          <ClipboardCheck aria-hidden="true" className="hidden size-24 shrink-0 text-blue-600/60 sm:block dark:text-blue-300/60" />
        </header>
        <div className="grid gap-6 p-6 sm:p-10 md:grid-cols-[1fr_18rem]">
          <section className="space-y-5" aria-labelledby="before-start">
            {result && latest && <div className={`space-y-3 rounded-xl border p-5 ${resultClass}`}>
              <h2 className="text-lg font-semibold">{result === "PASSED" ? "You passed!" : result === "FAILED" ? "This attempt did not pass" : "Attempt completed"}</h2>
              <p>Latest attempt ({latest.summary.attemptNumber}): {formatScore(latest.summary.finalScore!)} / {formatScore(latest.summary.maxScore ?? 10)}</p>
              <p className="text-sm">Course progress uses your best eligible result; this card shows your latest attempt.</p>
              {latest.canReview && <Button variant="outline" onClick={() => navigate(`/student/exams/attempts/${latest.summary.id}/review?returnTo=${encodeURIComponent(returnTo)}`)}>View feedback</Button>}
            </div>}
            {noticeKey && latest && (result === "PASSED" || result === "FAILED") && <AssessmentResultNotice key={noticeKey} noticeKey={noticeKey} passed={result === "PASSED"} attemptNumber={latest.summary.attemptNumber} className={resultClass} />}
<h2 id="before-start" className="text-lg font-semibold">Before you begin</h2>
            <p className="text-muted-foreground">Review the requirements before starting. Opening this overview does not start the timer or use an attempt. Select Start assessment when you are ready.</p>
            <p className="text-sm">Once started, the timer continues while you are away. Your answers save automatically during the assessment. Resume uses the existing attempt and its original deadline.</p>
            {data.antiCheatEnabled && <div className="rounded-xl border p-4 text-sm"><p className="flex items-center gap-2 font-medium"><ShieldCheck className="size-4" />Assessment integrity monitoring is enabled.</p>{data.requireFullscreen && <p className="mt-2">Fullscreen is required.</p>}{data.cameraProctoring && <p className="mt-2">Camera proctoring is required.</p>}</div>}
            {data.unavailableReason && <p role="status" className="rounded-xl border bg-muted p-4">{data.unavailableReason}</p>}
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (!start.isPending && (data.canStart || data.canResume)) start.mutate(); }}>
              {exam.hasPassword && !data.canResume && data.canStart && <label className="block text-sm font-medium">Assessment password<Input className="mt-2 max-w-sm" type="password" autoComplete="off" required value={password} onChange={e => setPassword(e.target.value)} /></label>}
              <Button size="lg" type="submit" disabled={start.isPending || (!data.canStart && !data.canResume) || (!!exam.hasPassword && !data.canResume && !password.trim())}>{start.isPending ? "Opening assessment…" : data.canResume ? "Resume assessment" : data.attemptsUsed > 0 ? "Try again" : "Start assessment"}</Button>
              {start.isError && <p role="alert" className="text-sm text-destructive">{errorMessage || "Could not open the assessment. Please try again."}</p>}
            </form>
          </section>
          <aside className="min-w-0 self-start rounded-xl border p-5" aria-label="Assessment requirements">
            <h2 className="mb-4 font-semibold">What to expect</h2>
            <dl className="space-y-3 text-sm">
              {[
                ["Duration", `${exam.durationMinutes} minutes`],
                ["Questions", `${data.questionCount} questions`],
                ["Maximum score", formatScore(exam.maxScore ?? 10)],
                ...(data.passScore != null ? [["Pass requirement", `${formatScore(data.passScore)} / ${formatScore(exam.maxScore ?? 10)}`]] : []),
                ["Attempts used", `${data.attemptsUsed} / ${exam.maxAttempts ?? 1}`],
                ["Attempts remaining", String(data.attemptsRemaining)],
                ...data.attempts.filter(a => a.summary.status === "IN_PROGRESS").map(a => ["Active attempt deadline", new Date(a.summary.deadlineAt).toLocaleString()]),
              ].map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-4 gap-y-1 leading-5">
                <dt className="min-w-0 break-words text-muted-foreground">{label}</dt>
                <dd className="m-0 min-w-0 break-words text-right font-medium tabular-nums">{value}</dd>
              </div>)}
            </dl>
          </aside>
          {data.attempts.length > 0 && <section className="space-y-3 md:col-span-2" aria-labelledby="attempt-history"><h2 id="attempt-history" className="text-lg font-semibold">Your attempts</h2>{data.attempts.map(({ summary: a, canReview }) => <div key={a.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"><div className="space-y-1"><h3 className="font-medium">Attempt {a.attemptNumber} · {a.status.replaceAll("_", " ")}</h3>{a.status === "IN_PROGRESS" && <p className="text-sm text-muted-foreground">Deadline: {new Date(a.deadlineAt).toLocaleString()}</p>}{a.submittedAt && <p className="text-sm text-muted-foreground">Submitted: {new Date(a.submittedAt).toLocaleString()}</p>}{a.status !== "IN_PROGRESS" && <p className="text-sm">{a.resultPublished ? a.finalScore != null ? `Score: ${formatScore(a.finalScore)} / ${formatScore(a.maxScore ?? 10)}${a.passed == null ? "" : a.passed ? " · Passed" : " · Not passed"}` : "Result published · Grading pending" : "Result awaiting publication"}</p>}</div>{canReview && <Button variant="outline" onClick={() => navigate(`/student/exams/attempts/${a.id}/review?returnTo=${encodeURIComponent(returnTo)}`, { state: { returnTo, preparation: assessmentPreparationPath(id, returnTo) } })}>{a.resultPublished ? "View feedback" : "View my submission"}</Button>}</div>)}</section>}
        </div>
      </article>}
      {returnPath && <nav aria-label="Assessment lesson navigation" className="flex flex-wrap justify-between gap-3 border-t pt-4">
        <Button variant="outline" disabled={!onPrevious} onClick={onPrevious}>Previous item</Button>
        <Button variant="outline" disabled={!onNext} onClick={onNext}>Next item</Button>
      </nav>}
    </div>
  </>;
}

export default function StudentExamPreparationPage() {
  const id = Number(useParams().examId);
  return <MainLayout pathName={{ exams: "Assessments", prepare: "Assessment overview" }} ignorePaths={["attempts"]}><AssessmentPreparationContent key={id} id={id} /></MainLayout>;
}
