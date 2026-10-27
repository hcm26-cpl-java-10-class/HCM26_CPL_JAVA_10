import { milestoneSubmissionApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReviewDecision, ReviewSubmissionRequest, RubricRatingLevel, SubmissionArtifactType } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CalendarClock, ExternalLink, FileText, Github, MonitorPlay, UserRound, Users } from "lucide-react";
import { useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ReviewHistory } from "../components/ReviewHistory";
import { SubmissionReviewForm, type ReviewFormError } from "../components/SubmissionReviewForm";
import { ExecutionStatusBadge, SubmissionStatusBadge } from "../components/SubmissionStatusBadge";

const date = (value?: string | null) => value ? new Date(value).toLocaleString("en-GB") : "—";
const errorOf = (error: unknown): ReviewFormError & { status?: number } => {
  const value = error as { response?: { status?: number; data?: ReviewFormError } };
  return { status: value.response?.status, message: value.response?.data?.message, errors: value.response?.data?.errors };
};
const artifactIcon = (type: SubmissionArtifactType) => type === "REPOSITORY" ? Github : type === "DEMO" ? MonitorPlay : FileText;
const fileSize = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function SubmissionReviewPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const client = useQueryClient();
  const retryKey = useRef<string | null>(null);
  const query = useQuery({ queryKey: ["milestone-submissions", submissionId], queryFn: () => milestoneSubmissionApi.getDetail(submissionId as string), enabled: Boolean(submissionId), retry: false });
  const mutation = useMutation({
    mutationFn: ({ payload, key }: { payload: ReviewSubmissionRequest; key: string }) => milestoneSubmissionApi.review(submissionId as string, payload, key),
    onSuccess: (data, variables) => {
      client.setQueryData(["milestone-submissions", submissionId], data);
      void client.invalidateQueries({ queryKey: ["milestone-submissions"] });
      retryKey.current = null;
      toast.success(variables.payload.decision === "ACCEPT" ? "Submission accepted" : variables.payload.decision === "REJECT" ? "Submission rejected" : "Student revision requested");
    },
    onError: (error) => {
      const parsed = errorOf(error);
      if (parsed.status === 404) { toast.error("The submission does not exist or has changed"); navigate("/milestone-submissions", { replace: true }); }
      else if (parsed.status === 422 && parsed.errors?.decision?.length) {
        toast.error("Không thể yêu cầu nộp lại do Milestone đã hết hạn theo Late Policy");
        void query.refetch();
      }
    },
  });

  if (query.isLoading) return <MainLayout pathName={{ "milestone-submissions": "Milestone reviews" }}><div className="mx-auto grid max-w-6xl gap-5"><Skeleton className="h-40" /><Skeleton className="h-[600px]" /></div></MainLayout>;
  if (query.isError || !query.data) return <MainLayout pathName={{ "milestone-submissions": "Milestone reviews" }}><Alert variant="destructive"><AlertCircle /><AlertTitle>Submission could not be loaded</AlertTitle><AlertDescription><Button variant="outline" className="mt-3" onClick={() => navigate("/milestone-submissions")}>Back to review queue</Button></AlertDescription></Alert></MainLayout>;
  const item = query.data;
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo;
  const safeReturnTo = returnTo && (returnTo.startsWith("/milestone-submissions")
    || returnTo.startsWith("/teams/") || returnTo.startsWith("/management/workspaces/"))
    ? returnTo : "/milestone-submissions";
  const back = () => navigate(safeReturnTo);
  const review = (decision: ReviewDecision, values: Record<string, { ratingLevel?: RubricRatingLevel; feedback: string }>, checklist: Record<string, boolean>, overallFeedback?: string) => {
    retryKey.current ??= crypto.randomUUID();
    mutation.mutate({ key: retryKey.current, payload: { decision, expectedVersion: item.lockVersion, overallFeedback, criteria: item.rubric.criteria.map((criterion) => ({ criterionId: criterion.id, ratingLevel: values[criterion.id].ratingLevel as RubricRatingLevel, feedback: values[criterion.id].feedback.trim() || undefined })), checklist: item.currentVersion.checklist.filter((entry) => entry.id).map((entry) => ({ checklistItemId: entry.id as string, completed: Boolean(checklist[entry.id as string]) })) } });
  };

  return (
    <MainLayout pathName={{ "milestone-submissions": "Milestone reviews", [item.id]: "Review" }}>
      <div className="mx-auto grid max-w-6xl gap-5">
        <Button variant="ghost" className="w-fit" onClick={back}><ArrowLeft className="size-4" /> Back</Button>
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4"><div><CardTitle className="text-2xl">Review submission</CardTitle><CardDescription className="mt-1">{item.milestoneTitle} · {item.currentVersion.title} · Version {item.currentVersionNumber}</CardDescription></div><div className="flex flex-wrap gap-2"><SubmissionStatusBadge status={item.status} /><ExecutionStatusBadge status={item.executionStatus} />{item.currentVersion.late ? <Badge variant="destructive">Late · {item.currentVersion.penaltyPercent}% penalty</Badge> : null}</div></div>
          </CardHeader>
          <CardContent className="grid gap-5 border-t pt-5">
            <div><h2 className="text-lg font-semibold">Submission information</h2><div className="mt-3 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><p className="flex items-center gap-2 text-muted-foreground"><Users className="size-4" /> Team</p><p className="mt-1 font-medium">{item.teamName}</p></div><div><p className="flex items-center gap-2 text-muted-foreground"><UserRound className="size-4" /> Submitted by</p><p className="mt-1 font-medium">{item.studentName}</p></div><div><p className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="size-4" /> Submitted at</p><p className="mt-1 font-medium">{date(item.currentVersion.submittedAt)}</p></div><div><p className="text-muted-foreground">Rubric</p><p className="mt-1 font-medium">{item.rubric.name} · {item.rubric.version}</p></div></div></div>
            {item.product ? <div className="grid gap-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Product information</h2><span className="text-xs text-muted-foreground">Artifact version {item.product.version} · {date(item.product.submittedAt)}</span></div><div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Repository</p>{item.product.repositoryUrl ? <a href={item.product.repositoryUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 break-all font-medium text-primary hover:underline"><Github className="size-4 shrink-0" />{item.product.repositoryUrl}<ExternalLink className="size-3 shrink-0" /></a> : <p className="mt-2 text-sm text-muted-foreground">Not provided</p>}</div>
              <div className="rounded-xl border p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Deployment</p>{item.product.deploymentUrl ? <a href={item.product.deploymentUrl} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 break-all font-medium text-primary hover:underline"><MonitorPlay className="size-4 shrink-0" />{item.product.deploymentUrl}<ExternalLink className="size-3 shrink-0" /></a> : <p className="mt-2 text-sm text-muted-foreground">Not provided</p>}</div>
            </div><div className="rounded-xl border p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Release notes</p><p className="mt-2 whitespace-pre-wrap text-sm">{item.product.releaseNotes || "Not provided"}</p></div>
              <div className="rounded-xl border p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attachments ({item.product.attachments.length})</p>{item.product.attachments.length ? <ul className="mt-3 grid gap-2">{item.product.attachments.map((attachment) => <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><FileText className="size-4 shrink-0" /><span className="truncate font-medium">{attachment.fileName}</span></span><span className="text-xs text-muted-foreground">{attachment.contentType} · {fileSize(attachment.sizeBytes)}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No files attached</p>}</div>
              {item.product.submittedLate ? <p className="text-sm text-destructive">Submitted late{item.product.latePenaltyPercent == null ? "" : ` · ${item.product.latePenaltyPercent}% penalty`}</p> : null}
            </div> : <div className="grid gap-3"><h2 className="text-lg font-semibold">Artifacts</h2>{item.currentVersion.artifacts.length ? <div className="grid gap-3 sm:grid-cols-2">{item.currentVersion.artifacts.map((artifact, index) => { const Icon = artifactIcon(artifact.type); return <a key={artifact.id ?? index} href={artifact.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border p-4 transition hover:border-primary hover:bg-muted/30"><span className="flex min-w-0 items-center gap-3"><Icon className="size-5 shrink-0" /><span className="min-w-0"><span className="block truncate font-medium">{artifact.name}</span><span className="text-xs text-muted-foreground">{artifact.type.replace("_", " ")}</span></span></span><ExternalLink className="size-4 shrink-0" /></a>; })}</div> : <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No artifact links were submitted.</p>}</div>}
          </CardContent>
        </Card>
        {item.status === "SUBMITTED" ? <SubmissionReviewForm key={`${item.id}-${item.currentVersionNumber}`} submission={item} pending={mutation.isPending} apiError={mutation.isError ? errorOf(mutation.error) : null} onReview={review} /> : <Alert><AlertCircle /><AlertTitle>This submission is not awaiting review</AlertTitle><AlertDescription>The review form is read-only because its current status is {item.status.replace("_", " ")}.</AlertDescription></Alert>}
        {item.status === "SUBMITTED" && !item.availableActions.requestChanges ? <Alert><AlertCircle /><AlertTitle>Student revision unavailable</AlertTitle><AlertDescription>The late-policy window or attempt limit has been reached. Accept and Reject remain available.</AlertDescription></Alert> : null}
        <ReviewHistory reviews={item.reviews} />
      </div>
    </MainLayout>
  );
}
