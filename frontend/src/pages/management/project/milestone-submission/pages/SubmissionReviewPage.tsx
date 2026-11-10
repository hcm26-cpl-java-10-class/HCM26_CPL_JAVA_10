import styles from "../components/SubmissionReview.module.css";
import { milestoneSubmissionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReviewDecision, ReviewSubmissionRequest, RubricRatingLevel } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CalendarClock, UserRound, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ReviewHistory } from "../components/ReviewHistory";
import { ReviewResult } from "../components/ReviewResult";
import { SubmissionEvidence } from "../components/SubmissionEvidence";
import { outcomeOf, resultPath, reviewPath } from "../review-outcome";
import { SubmissionReviewForm, type ReviewFormError } from "../components/SubmissionReviewForm";
import { ExecutionStatusBadge, SubmissionStatusBadge } from "../components/SubmissionStatusBadge";

const date = (value?: string | null) => value ? new Date(value).toLocaleString("en-GB") : "—";
const RETURN_PREFIXES = ["/milestone-submissions", "/teams/", "/management/workspaces/", "/team-allocation/classes/"];
/** Where to go back to: the in-app page that opened the review (validated), else the review queue. */
function returnTarget(state: unknown) {
  const returnTo = (state as { returnTo?: string } | null)?.returnTo;
  return returnTo && RETURN_PREFIXES.some(prefix => returnTo.startsWith(prefix)) ? returnTo : "/milestone-submissions";
}
/** Pages that show the review outcome banner themselves, so the toast would only repeat it. */
function showsOutcomeBanner(target: string) {
  const path = target.split("?")[0];
  return path === "/milestone-submissions" || /^\/teams\/[^/]+\/milestones\/[^/]+\/submissions$/.test(path);
}
const errorOf = (error: unknown): ReviewFormError => {
  const value = error as { response?: { status?: number; data?: ReviewFormError } };
  return { status: value.response?.status, message: value.response?.data?.message, errors: value.response?.data?.errors };
};

export function SubmissionReviewPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const sending = useRef(false);
  const retry = useRef<{ key: string; payload: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [reloadEpoch, setReloadEpoch] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const gradingRoute = location.pathname.endsWith("/review");
  const query = useQuery({ queryKey: ["milestone-submissions", submissionId], queryFn: () => milestoneSubmissionApi.getDetail(submissionId as string), enabled: Boolean(submissionId), retry: false });
  const mutation = useMutation({
    mutationFn: ({ payload, key }: { payload: ReviewSubmissionRequest; key: string }) => milestoneSubmissionApi.review(submissionId as string, payload, key),
    onSettled: () => { sending.current = false; },
    onSuccess: (data, variables) => {
      client.setQueryData(["milestone-submissions", submissionId], data);
      for (const key of ["milestone-submissions", "team-milestone-submissions", "team-milestone", "workspace-master-milestones", "project-completion"]) void client.invalidateQueries({ queryKey: [key] });
      retry.current = null;
      setDirty(false);
      // Grading is done: go straight back to where the review started, carrying the outcome for its banner.
      const target = returnTarget(location.state);
      if (!showsOutcomeBanner(target)) {
        toast.success(variables.payload.decision === "ACCEPT" ? "Submission accepted" : variables.payload.decision === "REJECT" ? "Submission rejected" : "Student revision requested");
      }
      setLeaving(true);
      navigate(target, { replace: true, state: { reviewOutcome: outcomeOf(data, variables.payload.decision) } });
    },
    onError: (error) => {
      const parsed = errorOf(error);
      if (parsed.status && parsed.status < 500) retry.current = null; // Network and server failures may have an uncertain outcome.
      if (parsed.status === 404) { toast.error("The submission does not exist or has changed"); navigate("/milestone-submissions", { replace: true }); }
      else if (parsed.status === 422 && parsed.errors?.decision?.length) { toast.error(parsed.errors.decision[0]); void query.refetch(); }
    },
  });
  const setDraftDirty = useCallback((value: boolean) => setDirty(value), []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const guardLink = (event: MouseEvent) => {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a[href]") : null;
      if (!anchor || anchor.getAttribute("target") === "_blank") return;
      const destination = new URL(anchor.getAttribute("href") || "", window.location.href);
      if (destination.origin === window.location.origin && destination.pathname !== window.location.pathname && !window.confirm("Discard your unsaved review?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    document.addEventListener("click", guardLink, true);
    return () => document.removeEventListener("click", guardLink, true);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const currentIndex = window.history.state?.idx;
    if (typeof currentIndex !== "number") return;
    let restoring = false;
    const guardHistory = (event: PopStateEvent) => {
      if (restoring) { restoring = false; event.stopImmediatePropagation(); return; }
      const nextIndex = event.state?.idx;
      if (typeof nextIndex !== "number" || nextIndex === currentIndex) return;
      if (!window.confirm("Discard your unsaved review?")) {
        event.stopImmediatePropagation();
        restoring = true;
        window.history.go(currentIndex - nextIndex);
      }
    };
    window.addEventListener("popstate", guardHistory, true);
    return () => window.removeEventListener("popstate", guardHistory, true);
  }, [dirty]);

  if (query.isLoading || leaving) return <MainLayout pathName={{ "milestone-submissions": "Milestone reviews" }}><div className="mx-auto grid max-w-6xl gap-5"><Skeleton className="h-32" /><Skeleton className="h-96" /></div></MainLayout>;
  if (query.isError || !query.data) return <MainLayout pathName={{ "milestone-submissions": "Milestone reviews" }}><Alert variant="destructive"><AlertCircle /><AlertTitle>Submission could not be loaded</AlertTitle><AlertDescription><Button type="button" variant="outline" className="mt-3" onClick={() => navigate("/milestone-submissions")}>Back to review queue</Button></AlertDescription></Alert></MainLayout>;
  const item = query.data;
  const safeReturnTo = returnTarget(location.state);
  const back = () => { if (!dirty || window.confirm("Discard your unsaved review?")) navigate(safeReturnTo); };
  const reload = () => {
    if (dirty && !window.confirm("Reload the latest submission? Your review draft will be lost.")) return;
    void query.refetch().then(result => {
      if (!result.isSuccess) { toast.error("Could not load the latest submission"); return; }
      retry.current = null;
      mutation.reset();
      setDirty(false);
      setReloadEpoch(value => value + 1);
    });
  };
  const review = (decision: ReviewDecision, values: Record<string, { ratingLevel?: RubricRatingLevel; feedback: string }>, checklist: Record<string, boolean>, overallFeedback?: string) => {
    if (sending.current || mutation.isPending) return;
    sending.current = true;
    const payload: ReviewSubmissionRequest = { decision, expectedVersion: item.lockVersion, overallFeedback, criteria: item.rubric.criteria.map(criterion => ({ criterionId: criterion.id, ratingLevel: values[criterion.id].ratingLevel as RubricRatingLevel, feedback: values[criterion.id].feedback.trim() || undefined })), checklist: item.currentVersion.checklist.filter(entry => entry.id).map(entry => ({ checklistItemId: entry.id as string, completed: Boolean(checklist[entry.id as string]) })) };
    const serialized = JSON.stringify(payload);
    if (retry.current?.payload !== serialized) retry.current = { key: crypto.randomUUID(), payload: serialized };
    mutation.mutate({ key: retry.current.key, payload });
  };
  const canReview = item.teamId != null && item.status === "SUBMITTED" && (item.availableActions.accept || item.availableActions.reject || item.availableActions.requestChanges);
  // `/review` is only for grading and the plain URL only for the result; keep each URL truthful (and old links working).
  if (gradingRoute && !canReview) return <Navigate to={resultPath(item.id)} replace state={location.state} />;
  if (!gradingRoute && canReview) return <Navigate to={reviewPath(item.id)} replace state={location.state} />;

  return <MainLayout pathName={gradingRoute ? { "milestone-submissions": "Milestone reviews", review: "Review" } : { "milestone-submissions": "Milestone reviews", [item.id]: "Review result" }}><div className={`mx-auto grid w-full min-w-0 max-w-[1200px] ${gradingRoute ? "gap-4" : "gap-3"} pb-6 ${styles.page}`}>
    {gradingRoute ? <>
    <Button type="button" variant="ghost" className="w-fit" onClick={back}><ArrowLeft className="size-4" /> Back</Button>
    <Card className="border-sky-200/70 dark:border-sky-900/70"><CardContent className="grid gap-3 py-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="text-xl font-semibold">{item.milestoneTitle}</h1><p className="mt-1 text-sm text-muted-foreground">{item.currentVersion.title} · Version {item.currentVersionNumber}</p></div><div className="flex flex-wrap gap-2"><SubmissionStatusBadge status={item.status} /><ExecutionStatusBadge status={item.executionStatus} />{item.currentVersion.late ? <Badge className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Late · {item.currentVersion.penaltyPercent}% penalty</Badge> : null}</div></div><div className="flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><Users className="size-4" /> {item.teamName}</span><span className="flex items-center gap-1.5"><UserRound className="size-4" /> {item.studentName}</span><span className="flex items-center gap-1.5"><CalendarClock className="size-4" /> {date(item.currentVersion.submittedAt)}</span><span>Rubric {item.rubric.name} · {item.rubric.version}</span></div></CardContent></Card>
    </> : <header className="grid min-w-0 gap-1.5 border-b pb-3">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={back}><ArrowLeft className="size-4" /> Back</Button>
        <SubmissionEvidence submission={item} variant="button" />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <h1 className="min-w-0 break-words text-lg font-semibold">{item.milestoneTitle}</h1>
        <SubmissionStatusBadge status={item.status} />
        <ExecutionStatusBadge status={item.executionStatus} />
        {item.currentVersion.late ? <Badge className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Late · {item.currentVersion.penaltyPercent}%</Badge> : null}
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Users className="size-3.5" /> {item.teamName}</span>
        <span className="flex items-center gap-1"><UserRound className="size-3.5" /> {item.studentName}</span>
        <span className="flex items-center gap-1"><CalendarClock className="size-3.5" /> {date(item.currentVersion.submittedAt)}</span>
        <span>Version {item.currentVersionNumber}</span>
        <span>Rubric {item.rubric.name} · {item.rubric.version}</span>
      </p>
    </header>}
    {gradingRoute ? <>
      <SubmissionReviewForm key={`${item.id}-${item.currentVersion.id}-${reloadEpoch}`} submission={item} pending={mutation.isPending} apiError={mutation.isError ? errorOf(mutation.error) : null} onReview={review} onDirtyChange={setDraftDirty} onEdit={() => { if (mutation.isError) { const status = errorOf(mutation.error).status; if (status !== 409 && status !== 412) mutation.reset(); } }} onReload={reload} />
      {item.reviews.length ? <details className="rounded-xl border bg-card"><summary className="cursor-pointer px-4 py-3 font-medium">Earlier reviews ({item.reviews.length})</summary><div className="border-t p-4"><ReviewHistory reviews={item.reviews} /></div></details> : null}
    </> : <ReviewResult submission={item} />}
  </div></MainLayout>;
}
