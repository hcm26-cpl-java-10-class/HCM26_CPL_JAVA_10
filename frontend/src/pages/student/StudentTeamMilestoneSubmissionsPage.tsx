import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CalendarClock, ChevronDown, ExternalLink, FileCheck2, GitBranch, Globe, History, MessageSquare, Paperclip, Pencil, RotateCw, Undo2, Upload } from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import type { ArtifactSubmission, ArtifactSubmissionAttachment } from "@/types";
import { ArtifactReviewStatusBadge } from "./components/ArtifactReviewStatusBadge";

type HistoryItem = Awaited<ReturnType<typeof milestoneApi.getMyTeamArtifactSubmissions>>[number];

function displayTime(value?: string | null) {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : "Not available";
}

function ArtifactLink({ label, url }: { label: string; url?: string | null }) {
  let safe = false;
  try { safe = Boolean(url && ["http:", "https:"].includes(new URL(url).protocol)); } catch { /* Unavailable links remain text. */ }
  return <div className="grid min-w-0 gap-2 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    {url && safe ? <a href={url} target="_blank" rel="noopener noreferrer" title={url} className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-300 dark:hover:bg-blue-950/30">
      {label === "Repository" ? <GitBranch className="size-3.5 shrink-0 text-muted-foreground" /> : <Globe className="size-3.5 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate">{url}</span><ExternalLink className="size-3.5 shrink-0" /><span className="sr-only">Open {label.toLowerCase()} in a new tab</span>
    </a> : <span className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{url || "Not provided"}</span>}
  </div>;
}

function ArtifactDetails({ repositoryUrl, deploymentUrl, releaseNotes, attachments = [] }: {
  repositoryUrl?: string | null;
  deploymentUrl?: string | null;
  releaseNotes?: string | null;
  attachments?: ArtifactSubmissionAttachment[];
}) {
  return <div className="min-w-0 space-y-3">
    <ArtifactLink label="Repository" url={repositoryUrl} />
    <ArtifactLink label="Deployment" url={deploymentUrl} />
    <div className="grid min-w-0 gap-2 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
      <span className="pt-2 text-xs font-medium text-muted-foreground">Release notes</span>
      <div tabIndex={releaseNotes ? 0 : undefined} aria-label="Release notes" className="max-h-44 min-w-0 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]">{releaseNotes?.trim() ? releaseNotes : <span className="text-muted-foreground">No release notes provided.</span>}</div>
    </div>
    <div className="grid min-w-0 gap-2 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
      <span className="pt-1 text-xs font-medium text-muted-foreground">Attachments</span>
      {attachments.length ? <ul className="min-w-0 space-y-2">{attachments.map((attachment) => <li key={attachment.id} className="flex min-w-0 items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm"><Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{attachment.fileName || "Unnamed attachment"}</span><span className="shrink-0 text-xs text-muted-foreground">{Number.isFinite(attachment.sizeBytes) ? `${Math.ceil(attachment.sizeBytes / 1024)} KB` : "Size unavailable"}</span></li>)}</ul> : <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground"><Paperclip className="size-3.5 shrink-0" />No attachments (0)</p>}
    </div>
  </div>;
}

function TimingBadge({ submission }: { submission: ArtifactSubmission }) {
  return <Badge variant="outline" className={submission.submittedLate ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}>{submission.submittedLate ? "Submitted late" : "Submitted on time"}</Badge>;
}

function VersionEntry({ item, latest }: { item: HistoryItem; latest: boolean }) {
  const [open, setOpen] = useState(latest);
  const { submission, reviewFeedback, reviewedAt } = item;
  const changesRequested = submission.status === "CHANGES_REQUESTED";
  return <li className="relative min-w-0 pl-7 sm:pl-9">
    <span aria-hidden="true" className={`absolute -left-[7px] top-6 size-3.5 rounded-full border-2 border-background ${changesRequested ? "bg-amber-500" : submission.status === "ACCEPTED" ? "bg-emerald-500" : submission.status === "REJECTED" ? "bg-red-500" : "bg-blue-500"}`} />
    <Collapsible open={open} onOpenChange={setOpen} className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
      <CollapsibleTrigger asChild>
        <button type="button" aria-label={`Toggle version ${submission.version} details`} className="flex w-full min-w-0 items-start justify-between gap-3 bg-muted/20 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5">
          <span className="min-w-0 space-y-2">
            <span className="flex flex-wrap items-center gap-2"><span className="text-base font-semibold">Version {submission.version}</span>{latest && <Badge variant="secondary">Latest</Badge>}<ArtifactReviewStatusBadge status={submission.status} /><TimingBadge submission={submission} /></span>
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>Submitted: <time dateTime={submission.submittedAt || undefined}>{displayTime(submission.submittedAt)}</time></span>{reviewedAt && <span>Reviewed: <time dateTime={reviewedAt}>{displayTime(reviewedAt)}</time></span>}</span>
          </span>
          <ChevronDown aria-hidden="true" className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="min-w-0 space-y-4 border-t p-4 sm:p-5">
          <ArtifactDetails repositoryUrl={submission.repositoryUrl} deploymentUrl={submission.deploymentUrl} releaseNotes={submission.releaseNotes} attachments={submission.attachments ?? []} />
          {submission.submittedLate && submission.latePenaltyPercent != null && <p className="text-xs text-muted-foreground">Late submission penalty: {submission.latePenaltyPercent}%</p>}
          <section className={`min-w-0 rounded-lg border p-3 ${changesRequested ? "border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20" : "bg-muted/20"}`} aria-label={`Reviewer feedback for version ${submission.version}`}>
            <h3 className={`flex items-center gap-2 text-xs font-semibold ${changesRequested ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground"}`}><MessageSquare className="size-3.5 shrink-0" />{changesRequested ? "REVISION FEEDBACK" : "REVIEWER FEEDBACK"}</h3>
            <p className="mt-2 max-h-44 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{reviewFeedback?.trim() ? reviewFeedback : submission.status === "SUBMITTED" ? "Awaiting reviewer feedback." : "No overall feedback provided."}</p>
          </section>
        </div>
      </CollapsibleContent>
    </Collapsible>
  </li>;
}

export default function StudentTeamMilestoneSubmissionsPage() {
  const { teamId: teamIdParam, milestoneId } = useParams<{ teamId: string; milestoneId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const teamId = Number(teamIdParam);
  const validParams = Number.isSafeInteger(teamId) && teamId > 0 && Boolean(milestoneId);
  const workspaceId = params.get("workspaceId");
  const workspaceQuery = useQuery({
    queryKey: ["student-team-artifact-workspace", teamId, milestoneId],
    queryFn: () => milestoneApi.getTeamArtifactWorkspace(teamId, milestoneId!),
    enabled: validParams,
    retry: false,
  });
  const submissionsQuery = useQuery({
    queryKey: ["my-team-milestone-submissions", teamId, milestoneId],
    queryFn: () => milestoneApi.getMyTeamArtifactSubmissions(teamId, milestoneId!),
    enabled: validParams,
    retry: false,
  });
  const backToWorkspace = () => workspaceId
    ? navigate(`/management/workspaces/${encodeURIComponent(workspaceId)}?tab=artifacts`)
    : navigate(-1);
  const loading = workspaceQuery.isPending || submissionsQuery.isPending;
  const failed = !validParams || workspaceQuery.isError || submissionsQuery.isError;
  // The API returns official versions in descending version order; drafts are separate.
  const versions = submissionsQuery.data ?? [];
  const latestSubmission = versions[0];
  const workspace = workspaceQuery.data;
  const draft = workspace?.draft;
  const showDraft = draft && (!latestSubmission || new Date(draft.updatedAt).getTime() >= new Date(latestSubmission.submission.submittedAt).getTime());
  const openSubmissionForm = () => navigate(`/teams/${teamId}/milestones/${milestoneId}/submit?workspaceId=${encodeURIComponent(workspaceId ?? "")}`);

  return <MainLayout contentClassName="bg-slate-50/80 dark:bg-background" pathName={{ student: "Student", management: "Management", workspaces: "Workspace", milestones: "Milestone", submissions: "My submissions" }}>
    <main className="mx-auto w-full max-w-[1200px] space-y-5 pb-8">
      <Button variant="ghost" size="sm" className="-ml-3 w-fit text-muted-foreground" onClick={backToWorkspace}><ArrowLeft className="size-4" />Back to workspace</Button>
      {failed ? <Alert variant="destructive"><AlertCircle /><AlertTitle>Could not load submission history</AlertTitle><AlertDescription className="grid justify-items-start gap-3"><span>Check your connection and access, then try again.</span><Button variant="outline" size="sm" onClick={() => { void workspaceQuery.refetch(); void submissionsQuery.refetch(); }}><RotateCw className="size-4" />Try again</Button></AlertDescription></Alert>
        : loading ? <div className="grid gap-4" role="status" aria-label="Loading submission history"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-48 rounded-xl" /><Skeleton className="h-64 rounded-xl" /><span className="sr-only">Loading submission history...</span></div>
        : <>
          <header className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm sm:p-6 md:flex-row md:items-center">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{workspace?.milestone.title ?? "Milestone"}</h1><ArtifactReviewStatusBadge status={latestSubmission?.submission.status ?? workspace?.milestone.lifecycleStatus ?? "DRAFT"} /></div>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Track your saved draft, submitted versions and reviewer feedback for this milestone.</p>
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="size-3.5 shrink-0" />Submission deadline <span className="rounded bg-muted/60 px-2 py-1 font-medium text-foreground">{displayTime(workspace?.milestone.deadline)}</span></p>
            </div>
            <div className="w-full shrink-0 space-y-2 md:w-auto md:max-w-64">
              <Button className="w-full" size="sm" disabled={latestSubmission?.submission.status === "REJECTED" || !workspace?.canSubmit} onClick={openSubmissionForm}><Upload className="size-4" />{versions.length ? "Submit new version" : "Submit artifact"}</Button>
              {!workspace?.canSubmit && <p className="text-xs leading-relaxed text-muted-foreground">{workspace?.submissionBlockReason || (latestSubmission?.submission.status === "SUBMITTED" ? "Awaiting review before another version can be submitted." : "Submissions are currently closed.")}</p>}
            </div>
          </header>

          {latestSubmission?.submission.status === "REJECTED" && <Alert variant="destructive"><AlertCircle /><AlertTitle>Submission rejected (0 points)</AlertTitle><AlertDescription><p>The team cannot submit another version.</p>{latestSubmission.reviewFeedback && <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{latestSubmission.reviewFeedback}</p>}</AlertDescription></Alert>}
          {latestSubmission?.submission.status === "CHANGES_REQUESTED" && <section className="min-w-0 rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm dark:border-amber-900 dark:bg-amber-950/20" aria-label="Latest revision request">
            <div className="flex items-start gap-3"><Undo2 className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" /><div className="min-w-0 flex-1 space-y-2"><h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Reviewer requested changes to version {latestSubmission.submission.version}</h2><p className="max-h-40 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-lg border border-amber-200/70 bg-background/80 px-3 py-2 text-sm leading-relaxed [overflow-wrap:anywhere]">{latestSubmission.reviewFeedback || "Review the feedback below and update your artifact."}</p><Button variant="outline" size="sm" className="border-amber-300 bg-background text-amber-900 dark:text-amber-100" onClick={openSubmissionForm}><Undo2 className="size-3.5" />{workspace?.canSubmit ? "Update and resubmit" : "View revision details"}</Button></div></div>
          </section>}

          {showDraft && <section className="min-w-0 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40 shadow-sm dark:border-blue-900 dark:bg-blue-950/20" aria-label="Saved draft">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 p-4 dark:border-blue-900 sm:px-5"><div className="flex items-start gap-3"><span className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Pencil className="size-4" /></span><div><h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">Draft v{draft.version}<ArtifactReviewStatusBadge status="DRAFT" /></h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Updated {displayTime(draft.updatedAt)} · Not officially submitted</p></div></div><Button size="sm" variant="outline" className="border-blue-200 bg-background text-blue-700 dark:text-blue-300" onClick={openSubmissionForm}><Pencil className="size-3.5" />Open and edit draft</Button></div>
            <div className="min-w-0 p-4 sm:p-5"><ArtifactDetails repositoryUrl={draft.repositoryUrl} deploymentUrl={draft.deploymentUrl} releaseNotes={draft.releaseNotes} attachments={draft.attachments ?? []} /></div>
          </section>}

          <section aria-label="Submitted version history" className="min-w-0 space-y-4 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-blue-600" />Submission history<Badge variant="secondary">{versions.length} {versions.length === 1 ? "version" : "versions"}</Badge></h2><p className="text-xs text-muted-foreground">Newest first · Drafts are excluded</p></div>
            {versions.length === 0 ? <div className="grid justify-items-center gap-2 rounded-xl border border-dashed bg-card px-5 py-10 text-center"><FileCheck2 className="size-8 text-muted-foreground" /><h3 className="font-medium">No submitted versions yet</h3><p className="text-sm text-muted-foreground">Saved drafts are not official submissions.</p></div> : <ol className="ml-2 min-w-0 space-y-4 border-l-2 border-slate-200 dark:border-slate-800">{versions.map((item, index) => <VersionEntry key={item.submission.id} item={item} latest={index === 0} />)}</ol>}
          </section>
          <p className="border-t pt-4 text-center text-xs text-muted-foreground">Submitted versions are read-only.</p>
        </>}
    </main>
  </MainLayout>;
}
