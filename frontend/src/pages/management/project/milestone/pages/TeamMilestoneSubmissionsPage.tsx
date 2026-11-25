import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  Copy,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Flag,
  Github,
  Inbox,
  ListChecks,
  MonitorPlay,
  RotateCw,
  UserRound,
} from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { ArtifactSubmission } from "@/types";
import { MilestoneStatusBadge } from "@/pages/management/project/milestone/components/MilestoneStatusBadge";
import { formatTenantDateTime } from "@/pages/management/project/milestone/milestone.utils";
import { SubmissionStatusBadge } from "@/pages/management/project/milestone-submission/components/SubmissionStatusBadge";
import { ReviewOutcomeBanner } from "@/pages/management/project/milestone-submission/components/ReviewOutcomeBanner";
import { resultPath, reviewPath, useReviewOutcome } from "@/pages/management/project/milestone-submission/review-outcome";

/** "/teams" and "/teams/:id/milestones" have no page; keep them out of the breadcrumb to avoid 404 links. */
const TEAM_ROUTE_GAPS = ["teams", "milestones"];

interface SubmissionItem {
  submission: ArtifactSubmission;
  reviewSubmissionId?: string | null;
  submitterId: string;
  submitterName?: string | null;
  submitterEmail?: string | null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatSubmissionDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function TeamMilestoneSubmissionsPage() {
  const { teamId: rawTeam, milestoneId = "" } = useParams();
  const teamId = Number(rawTeam);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const workspaceId = params.get("workspaceId");

  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionItem | null>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const milestoneQuery = useQuery({
    queryKey: ["team-milestone", teamId, milestoneId],
    queryFn: () => milestoneApi.getTeamDetail(teamId, milestoneId),
    enabled: teamId > 0 && !!milestoneId,
    retry: false,
  });

  const submissionsQuery = useQuery({
    queryKey: ["team-milestone-submissions", teamId, milestoneId],
    queryFn: () => milestoneApi.getTeamArtifactSubmissions(teamId, milestoneId),
    enabled: teamId > 0 && !!milestoneId,
    refetchInterval: 20_000,
    retry: false,
  });

  const milestone = milestoneQuery.data;

  const submissions = useMemo(() => {
    if (!submissionsQuery.data) return [];
    return [...submissionsQuery.data].sort(
      (a, b) => b.submission.version - a.submission.version
    );
  }, [submissionsQuery.data]);

  const maxVersion = submissions.length > 0 ? submissions[0].submission.version : 0;
  const isRefreshing = submissionsQuery.isFetching || milestoneQuery.isFetching;

  const sharedReviewSubmissionId = useMemo(() => {
    return (
      submissions.find((item) => Boolean(item.reviewSubmissionId))
        ?.reviewSubmissionId ?? null
    );
  }, [submissions]);

  const handleRefresh = () => {
    void submissionsQuery.refetch();
    void milestoneQuery.refetch();
  };

  const handleBackToMilestone = () => {
    navigate(
      workspaceId
        ? `/teams/${teamId}/milestones/${milestoneId}?workspaceId=${workspaceId}`
        : `/teams/${teamId}/milestones/${milestoneId}`
    );
  };

  const handleBackToWorkspace = () => {
    navigate(
      workspaceId
        ? `/management/workspaces/${workspaceId}?tab=milestones`
        : "/milestones/teams"
    );
  };

  const reviewOutcome = useReviewOutcome();

  /** Opens the grading page; it returns here with the outcome once the review is saved. */
  const handleReview = (reviewSubmissionId?: string | null) => {
    if (!reviewSubmissionId) return;
    navigate(reviewPath(reviewSubmissionId), {
      state: { returnTo: `${location.pathname}${location.search}` },
    });
  };

  /** Opens the read-only review result and history. */
  const handleViewResult = (reviewSubmissionId?: string | null) => {
    if (!reviewSubmissionId) return;
    navigate(resultPath(reviewSubmissionId), {
      state: { returnTo: `${location.pathname}${location.search}` },
    });
  };

  const pathTitles: Record<string, string> = {
    milestones: "Milestones",
    ...(milestoneId ? { [milestoneId]: milestone?.title || "Milestone" } : {}),
    submissions: "Submissions",
  };

  if (submissionsQuery.isPending && !submissionsQuery.data) {
    return (
      <MainLayout ignorePaths={TEAM_ROUTE_GAPS} pathName={pathTitles}>
        <main className="mx-auto grid w-full max-w-6xl gap-4">
          <div className="grid gap-2 border-b pb-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Card className="gap-0 py-0">
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        </main>
      </MainLayout>
    );
  }

  if (submissionsQuery.isError) {
    return (
      <MainLayout ignorePaths={TEAM_ROUTE_GAPS} pathName={pathTitles}>
        <main className="mx-auto grid w-full max-w-6xl gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleBackToMilestone}>
              <ArrowLeft className="mr-2 size-4" />
              Back to milestone
            </Button>
          </div>
          <Card className="mx-auto w-full max-w-2xl">
            <CardContent className="grid justify-items-start gap-4 p-6">
              <AlertCircle className="size-5 text-destructive" />
              <div>
                <h2 className="text-lg font-semibold">Could not load submissions</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(submissionsQuery.error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    "There was a problem retrieving the submissions for this milestone. Please check your connection, milestone UUID, or permissions and try again."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleBackToMilestone}>
                  <ArrowLeft className="mr-2 size-4" />
                  Back to milestone
                </Button>
                <Button variant="ghost" onClick={handleBackToWorkspace}>
                  Back to workspace
                </Button>
                <Button onClick={() => void submissionsQuery.refetch()}>
                  <RotateCw className="mr-2 size-4" />
                  Try again
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </MainLayout>
    );
  }

  return (
    <MainLayout ignorePaths={TEAM_ROUTE_GAPS} pathName={pathTitles}>
      <main className="mx-auto grid w-full max-w-6xl gap-4">
        {/* Compact header: navigation, milestone context and refresh in one block */}
        <header className="grid gap-2 border-b pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="-ml-2 flex flex-wrap items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleBackToMilestone}>
                <ArrowLeft className="size-4" />
                Back to milestone
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleBackToWorkspace}>
                {workspaceId ? "Workspace" : "Choose team"}
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh submissions"
              aria-label="Refresh submissions"
            >
              <RotateCw className={cn("size-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
              <Flag className="size-4" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight">
              {milestone?.title || "Milestone submissions"}
            </h1>
            {milestone && <MilestoneStatusBadge status={milestone.lifecycleStatus} />}
            {milestone?.mandatory && <Badge variant="secondary">Mandatory</Badge>}
          </div>
          {milestone && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5" title={milestone.tenantTimeZone}>
                <CalendarClock className="size-4 text-sky-500" />
                Due {formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)}
              </span>
              <DeadlineChip deadline={milestone.deadline} />
              <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs">
                <Inbox className="size-3.5" />
                {submissions.length} {submissions.length === 1 ? "submission" : "submissions"}
              </span>
            </div>
          )}
          {milestone?.description && (
            <div className="max-w-3xl text-sm text-muted-foreground">
              <p className={cn("whitespace-pre-wrap leading-relaxed", !descriptionExpanded && "line-clamp-2")}>
                {milestone.description}
              </p>
              {isLongDescription(milestone.description) && (
                <button
                  type="button"
                  className="mt-0.5 text-xs font-medium text-foreground hover:underline"
                  aria-expanded={descriptionExpanded}
                  onClick={() => setDescriptionExpanded((value) => !value)}
                >
                  {descriptionExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}
        </header>

        <ReviewOutcomeBanner />

        {submissions.length === 0 ? (
          <Card className="border-dashed py-0">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-950/40">
                <Inbox className="size-6 text-sky-600 dark:text-sky-300" />
              </div>
              <h3 className="mt-3 text-base font-semibold">No submissions received yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                The team has not submitted any artifacts for this milestone. Once submitted, they will appear here for review.
              </p>
              <Button className="mt-4" variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <RotateCw className={cn("size-4", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-4" title="Newest version first">Version</TableHead>
                  <TableHead>
                    <span
                      className="cursor-help border-b border-dotted border-muted-foreground"
                      title="Review status and timing. Timing is determined from the recorded submission time and the milestone's deadline policy; late submissions may receive a penalty."
                    >
                      Status
                    </span>
                  </TableHead>
                  <TableHead className="w-full">Submitted by</TableHead>
                  <TableHead>Artifacts</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((item) => {
                  const { submission, reviewSubmissionId, submitterId, submitterName, submitterEmail } = item;
                  const isLatest = submission.version === maxVersion;
                  // The API resolves review state from the linked reviewer workflow.
                  // Keep the immutable artifact status when no review record exists.
                  const displayStatus = submission.status;
                  const latestReviewId = isLatest ? reviewSubmissionId || sharedReviewSubmissionId : null;
                  const canActivelyReview = isLatest && displayStatus === "SUBMITTED" && Boolean(latestReviewId);
                  const canViewCompletedReview = isLatest && displayStatus !== "SUBMITTED" && Boolean(latestReviewId);
                  const fullSubmittedAt = submittedAtLabel(submission.submittedAt, milestone?.tenantTimeZone);

                  return (
                    <TableRow
                      key={submission.id}
                      className={cn(
                        "cursor-pointer transition",
                        reviewOutcome && latestReviewId === reviewOutcome.reviewSubmissionId
                          ? "bg-emerald-50/70 shadow-[inset_3px_0_0_var(--color-emerald-500)] hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30"
                          : isLatest
                          ? "bg-blue-50/50 shadow-[inset_3px_0_0_var(--color-blue-500)] hover:bg-blue-50 dark:bg-blue-950/15 dark:hover:bg-blue-950/30"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => {
                        if (canActivelyReview && latestReviewId) {
                          handleReview(latestReviewId);
                        } else {
                          setSelectedSubmission(item);
                        }
                      }}
                    >
                      <TableCell className="py-2.5 pl-4 font-medium">
                        <div className="flex items-center gap-1.5">
                          <FileCheck2 className={cn("size-4 shrink-0", isLatest ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")} />
                          <span className={isLatest ? "" : "text-muted-foreground"}>v{submission.version}</span>
                          {isLatest && <LatestPill />}
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <SubmissionStatusBadge status={displayStatus} />
                          <TimingLabel
                            submission={submission}
                            deadline={milestone ? formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone) : null}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5">
                        <div className="flex min-w-0 max-w-sm items-center gap-2.5">
                          <SubmitterAvatar name={submitterName || submitterEmail || submitterId} />
                          <div className="grid min-w-0 leading-tight">
                            <span className="truncate text-sm font-medium text-foreground">
                              {submitterName || "Student"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground" title={fullSubmittedAt}>
                              {submitterEmail || submitterId} · {compactDateTime(submission.submittedAt, milestone?.tenantTimeZone)}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <ArtifactLinks submission={submission} />
                        </div>
                      </TableCell>

                      <TableCell className="py-2.5 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setSelectedSubmission(item)}
                            title="View submission details"
                            aria-label={`View details of version ${submission.version}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="size-4" />
                          </Button>
                          {canActivelyReview && latestReviewId ? (
                            <Button size="sm" onClick={() => handleReview(latestReviewId)} title="Review latest submission">
                              <ClipboardCheck className="size-3.5" />
                              Review
                              <ArrowRight className="size-3" />
                            </Button>
                          ) : canViewCompletedReview && latestReviewId ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleViewResult(latestReviewId)}
                              title="View completed review assessment"
                            >
                              <ClipboardCheck className="size-3.5" />
                              View review
                            </Button>
                          ) : isLatest ? (
                            <span className="px-1 text-xs text-muted-foreground" title="No review queue available for this milestone">
                              View only
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {selectedSubmission && (
          <SubmissionDetailDialog
            item={selectedSubmission}
            milestoneTitle={milestone?.title}
            timeZone={milestone?.tenantTimeZone}
            deadline={milestone ? formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone) : null}
            checklistTotal={milestone?.checklist?.length}
            isLatest={selectedSubmission.submission.version === maxVersion}
            maxVersion={maxVersion}
            reviewId={selectedSubmission.reviewSubmissionId || sharedReviewSubmissionId}
            onClose={() => setSelectedSubmission(null)}
            onReview={(reviewId) => {
              const awaitingReview = selectedSubmission.submission.status === "SUBMITTED";
              setSelectedSubmission(null);
              if (awaitingReview) handleReview(reviewId);
              else handleViewResult(reviewId);
            }}
          />
        )}
      </main>
    </MainLayout>
  );
}

function isLongDescription(value: string) {
  return value.length > 180 || value.split("\n").length > 2;
}

function submittedAtLabel(value: string, timeZone?: string | null) {
  return timeZone ? formatTenantDateTime(value, timeZone) : formatSubmissionDate(value);
}

/** Day/month and time only; the full date with offset is shown on hover. */
function compactDateTime(value?: string | null, timeZone?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(timeZone ? { timeZone } : {}),
    }).format(date).replace(",", "");
  } catch {
    return formatSubmissionDate(value);
  }
}

function TimingLabel({ submission, deadline }: { submission: ArtifactSubmission; deadline: string | null }) {
  if (submission.submittedLate) {
    return (
      <span
        className="inline-flex cursor-help items-center gap-1 whitespace-nowrap text-xs font-medium text-rose-700 dark:text-rose-300"
        title={`Submitted after the deadline (${deadline ?? "deadline not available"}). Penalty: ${submission.latePenaltyPercent ?? 0}%.`}
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-rose-500" />
        Late{submission.latePenaltyPercent != null ? ` · ${submission.latePenaltyPercent}%` : ""}
      </span>
    );
  }
  return (
    <span
      className="inline-flex cursor-help items-center gap-1 whitespace-nowrap text-xs text-emerald-700 dark:text-emerald-400"
      title="Recorded as submitted on or before the milestone deadline. No late penalty applies."
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-emerald-500" />
      On time
    </span>
  );
}

const artifactLinkClass = "inline-flex size-7 items-center justify-center rounded-md border transition";
/** One soft hue per artifact kind, reused by the detail dialog. */
const artifactTones = {
  repository: "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  deployment: "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-400 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
  attachment: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
} as const;

function ArtifactLinks({ submission }: { submission: ArtifactSubmission }) {
  const attachments = submission.attachments?.length ?? 0;
  if (!submission.repositoryUrl && !submission.deploymentUrl && attachments === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <>
      {submission.repositoryUrl && (
        <a href={submission.repositoryUrl} target="_blank" rel="noreferrer"
          title={`Repository: ${submission.repositoryUrl}`} className={cn(artifactLinkClass, artifactTones.repository)}>
          <Github className="size-3.5" />
        </a>
      )}
      {submission.deploymentUrl && (
        <a href={submission.deploymentUrl} target="_blank" rel="noreferrer"
          title={`Deployment: ${submission.deploymentUrl}`} className={cn(artifactLinkClass, artifactTones.deployment)}>
          <MonitorPlay className="size-3.5" />
        </a>
      )}
      {attachments > 0 && (
        <span title={`${attachments} attached file(s)`}
          className={cn("inline-flex h-7 items-center gap-1 rounded-md border px-1.5 text-xs font-medium", artifactTones.attachment)}>
          <FileText className="size-3" />
          {attachments}
        </span>
      )}
    </>
  );
}

function SubmissionDetailDialog({
  item, milestoneTitle, timeZone, deadline, checklistTotal, isLatest, maxVersion, reviewId, onClose, onReview,
}: {
  item: SubmissionItem;
  milestoneTitle?: string | null;
  timeZone?: string | null;
  deadline: string | null;
  checklistTotal?: number;
  isLatest: boolean;
  maxVersion: number;
  reviewId?: string | null;
  onClose: () => void;
  onReview: (reviewId: string) => void;
}) {
  const { submission } = item;
  const total = checklistTotal ?? Object.keys(submission.checklist || {}).length;
  const completed = Object.values(submission.checklist || {}).filter(Boolean).length;
  const attachments = submission.attachments ?? [];
  const missing = [
    !submission.repositoryUrl && "repository link",
    !submission.deploymentUrl && "deployment link",
    attachments.length === 0 && "attachments",
  ].filter(Boolean) as string[];
  const hasLinks = Boolean(submission.repositoryUrl || submission.deploymentUrl || attachments.length);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[94vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="min-w-0 shrink-0 gap-1 border-b bg-gradient-to-b from-blue-50/70 to-transparent px-4 pt-4 pb-3 pr-12 text-left dark:from-blue-950/20">
          <p className="truncate text-xs text-muted-foreground">{milestoneTitle || "Milestone submission"}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <DialogTitle className="text-base font-semibold">Version {submission.version}</DialogTitle>
            {isLatest && <LatestPill />}
            <SubmissionStatusBadge status={submission.status} />
            <TimingLabel submission={submission} deadline={deadline} />
          </div>
          <DialogDescription className="sr-only">Details of submission version {submission.version}</DialogDescription>
        </DialogHeader>

        {/* min-w-0 + minmax(0,1fr) tracks: long URLs or names must shrink instead of widening the dialog. */}
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] content-start gap-3 overflow-x-hidden overflow-y-auto px-4 py-3">
          <dl className="grid grid-cols-[minmax(0,1fr)] divide-y rounded-lg border text-sm sm:grid-cols-[repeat(3,minmax(0,1fr))] sm:divide-x sm:divide-y-0">
            <InfoTile icon={<UserRound className="size-4" />} tone="bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300" label="Submitted by">
              <dd className="truncate font-medium">{item.submitterName || "Student"}</dd>
              {item.submitterEmail && <dd className="truncate text-xs text-muted-foreground">{item.submitterEmail}</dd>}
            </InfoTile>
            <InfoTile icon={<CalendarClock className="size-4" />} tone="bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300" label="Submitted at">
              <dd className="font-medium">{submittedAtLabel(submission.submittedAt, timeZone)}</dd>
              {timeZone && <dd className="truncate text-xs text-muted-foreground">{timeZone}</dd>}
            </InfoTile>
            <InfoTile icon={<ListChecks className="size-4" />} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" label="Acceptance criteria">
              <dd className="font-medium">
                {total > 0 ? `${completed} of ${total} confirmed` : "Reviewer assessment pending"}
              </dd>
              {total > 0 && (
                <dd aria-hidden="true" className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, (completed / total) * 100)}%` }} />
                </dd>
              )}
            </InfoTile>
          </dl>

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
              <h4 className="text-xs font-semibold text-muted-foreground">Artifacts</h4>
              {missing.length > 0 && (
                <p className="text-xs text-muted-foreground/80">No {missing.join(", ")}</p>
              )}
            </div>
            {hasLinks && (
              <ul className="min-w-0 divide-y rounded-lg border text-sm">
                {submission.repositoryUrl && (
                  <LinkRow href={submission.repositoryUrl} icon={<Github className="size-3.5" />} tone={artifactTones.repository} label="Repository" />
                )}
                {submission.deploymentUrl && (
                  <LinkRow href={submission.deploymentUrl} icon={<MonitorPlay className="size-3.5" />} tone={artifactTones.deployment} label="Deployment" />
                )}
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="flex min-w-0 items-center gap-2 px-2.5 py-1.5">
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-md border", artifactTones.attachment)}>
                      <FileText className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium" title={attachment.fileName}>
                      {truncateMiddle(attachment.fileName)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground" title={attachment.contentType}>
                      {fileKind(attachment.fileName, attachment.contentType)} · {formatFileSize(attachment.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h4 className="text-xs font-semibold text-muted-foreground">Release notes</h4>
              {!submission.releaseNotes && <p className="text-xs text-muted-foreground/80">None provided</p>}
            </div>
            {submission.releaseNotes && (
              <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-r-lg border-l-2 border-sky-300 bg-sky-50/40 px-3 py-2 text-sm leading-relaxed dark:border-sky-800 dark:bg-sky-950/20">
                {submission.releaseNotes}
              </p>
            )}
          </section>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 flex-row flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 sm:justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          {isLatest && reviewId ? (
            <Button
              size="sm"
              variant={submission.status === "SUBMITTED" ? "default" : "secondary"}
              onClick={() => onReview(reviewId)}
            >
              <ClipboardCheck className="size-4" />
              {submission.status === "SUBMITTED" ? "Review latest submission" : "View review result"}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {submission.version < maxVersion ? `Historical version — superseded by v${maxVersion}` : "Review unavailable"}
            </span>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkRow({ href, icon, tone, label }: { href: string; icon: ReactNode; tone: string; label: string }) {
  const parts = splitUrl(href);
  return (
    <li className="flex min-w-0 items-center gap-2 py-1 pr-1 pl-2.5">
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-md border", tone)} title={label}>{icon}</span>
      <span className="w-[4.5rem] shrink-0 text-xs text-muted-foreground max-sm:sr-only">{label}</span>
      {parts ? (
        <a href={href} target="_blank" rel="noreferrer" title={href}
          className="flex min-w-0 flex-1 items-baseline gap-0.5 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="shrink-0 font-medium text-foreground">{parts.host}</span>
          {parts.rest && <span className="min-w-0 truncate text-muted-foreground">{parts.rest}</span>}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate text-muted-foreground" title={href}>{href}</span>
      )}
      <CopyButton value={href} label={label} />
      {parts && (
        <Button asChild variant="ghost" size="icon-sm" className="size-7 shrink-0 text-muted-foreground hover:text-foreground">
          <a href={href} target="_blank" rel="noreferrer" title={`Open ${label.toLowerCase()} in a new tab`}
            aria-label={`Open ${label.toLowerCase()} in a new tab`}>
            <ExternalLink className="size-4" />
          </a>
        </Button>
      )}
    </li>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const pending = timer;
    return () => window.clearTimeout(pending.current);
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (insecure context, permissions); the link stays selectable via its tooltip.
    }
  }
  return (
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => void copy()}
      className={cn("size-7 shrink-0", copied ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground")}
      title={copied ? "Copied" : `Copy ${label.toLowerCase()} link`} aria-label={copied ? "Copied" : `Copy ${label.toLowerCase()} link`}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  );
}

/** Host and the rest of an http(s) URL, for a readable display; null when it is not a web link. */
function splitUrl(value: string): { host: string; rest: string } | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    let rest = `${url.pathname === "/" ? "" : url.pathname}${url.search}${url.hash}`;
    try { rest = decodeURI(rest); } catch { /* keep the encoded form */ }
    return { host: url.host.replace(/^www\./, ""), rest };
  } catch {
    return null;
  }
}

/** Shortens long file names in the middle so the extension stays visible. */
function truncateMiddle(value: string, max = 44) {
  if (value.length <= max) return value;
  const dot = value.lastIndexOf(".");
  const extension = dot > 0 && value.length - dot <= 10 ? value.slice(dot) : "";
  const body = extension ? value.slice(0, dot) : value;
  const keep = Math.max(8, max - extension.length - 1);
  const head = Math.ceil(keep * 0.6);
  return `${body.slice(0, head)}…${body.slice(body.length - (keep - head))}${extension}`;
}

/** Short file type label (PDF, DOCX…) instead of long MIME types such as application/vnd.openxml…. */
function fileKind(fileName: string, contentType?: string | null) {
  const dot = fileName.lastIndexOf(".");
  if (dot > 0 && fileName.length - dot <= 6) return fileName.slice(dot + 1).toUpperCase();
  const subtype = contentType?.split("/")[1]?.split(/[;+.]/)[0];
  return subtype ? subtype.toUpperCase().slice(0, 8) : "FILE";
}

function LatestPill() {
  return (
    <span className="rounded-full border border-blue-200 bg-blue-50 px-1.5 text-[11px] font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
      Latest
    </span>
  );
}

/** Time left before the deadline: sky when comfortable, amber in the last 3 days, neutral once passed. */
function DeadlineChip({ deadline }: { deadline: string }) {
  // Day granularity: the moment the page opened is precise enough and keeps rendering pure.
  const [now] = useState(() => Date.now());
  const due = new Date(deadline).getTime();
  if (Number.isNaN(due)) return null;
  const days = Math.ceil((due - now) / 86_400_000);
  const [label, tone] = days < 0
    ? ["Deadline passed", "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"]
    : days <= 3
      ? [days <= 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} left`,
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"]
      : [`${days} days left`, "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"];
  return <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", tone)}>{label}</span>;
}

const avatarTones = [
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

/** Initials on a soft tint that stays the same for the same person. */
function SubmitterAvatar({ name }: { name: string }) {
  const words = name.trim().split(/[\s@._-]+/).filter(Boolean);
  const initials = ((words[0]?.[0] ?? "?") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold", avatarTones[hash % avatarTones.length])}>
      {initials}
    </span>
  );
}

function InfoTile({ icon, tone, label, children }: { icon: ReactNode; tone: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2 px-3 py-2">
      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-md [&_svg]:size-3.5", tone)}>{icon}</span>
      <div className="min-w-0 flex-1 leading-snug">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        {children}
      </div>
    </div>
  );
}
