import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Github,
  Globe2,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  const handleReview = (reviewSubmissionId?: string | null) => {
    if (!reviewSubmissionId) return;
    navigate(`/milestone-submissions/${reviewSubmissionId}/review`, {
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
      <MainLayout pathName={pathTitles}>
        <main className="mx-auto grid w-full max-w-6xl gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-9 w-24" />
          </div>
          <Skeleton className="h-40 rounded-xl" />
          <Card>
            <CardHeader className="border-b p-4">
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <div className="space-y-3 p-4">
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
      <MainLayout pathName={pathTitles}>
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
    <MainLayout pathName={pathTitles}>
      <main className="mx-auto grid w-full max-w-6xl gap-6">
        {/* Navigation Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleBackToMilestone}>
              <ArrowLeft className="mr-2 size-4" />
              Back to milestone
            </Button>
            <Button variant="ghost" onClick={handleBackToWorkspace}>
              <ArrowLeft className="mr-2 size-4" />
              {workspaceId ? "Back to workspace" : "Choose team"}
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RotateCw className={cn("mr-2 size-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Milestone Context Hero Card */}
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
          <CardHeader className="gap-4 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Team milestone</Badge>
              {milestone && (
                <Badge variant="outline">
                  <MilestoneStatusBadge status={milestone.lifecycleStatus} />
                </Badge>
              )}
              {milestone?.mandatory && <Badge variant="secondary">Mandatory</Badge>}
              <Badge variant="outline">
                {submissions.length} {submissions.length === 1 ? "submission" : "submissions"}
              </Badge>
            </div>
            <div className="grid gap-2">
              <CardTitle className="text-2xl md:text-3xl">
                {milestone?.title || "Milestone submissions"}
              </CardTitle>
              {milestone?.description && (
                <CardDescription className="max-w-3xl whitespace-pre-wrap text-sm leading-6">
                  {milestone.description}
                </CardDescription>
              )}
            </div>
            {milestone && (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <CalendarClock className="size-4" />
                  Due {formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Globe2 className="size-4" />
                  {milestone.tenantTimeZone}
                </span>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Submissions Table (Single row per record) or Empty State */}
        {submissions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <Inbox className="size-7 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No submissions received yet</h3>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                The team has not submitted any artifacts for this milestone. Once submitted, they will appear here for review.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                  <RotateCw className={cn("mr-2 size-4", isRefreshing && "animate-spin")} />
                  Refresh
                </Button>
                <Button variant="default" onClick={handleBackToMilestone}>
                  <ArrowLeft className="mr-2 size-4" />
                  Back to milestone
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 px-6 py-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Submissions ({submissions.length})
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  Sorted by newest version first
                </span>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Version</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-36">
                    <span
                      className="inline-flex cursor-help items-center gap-1 border-b border-dotted border-muted-foreground"
                      title="Thời gian nộp bài so với hạn chót (Deadline) của Milestone. Bài nộp sau deadline sẽ bị đánh dấu Late và áp dụng trừ điểm phạt theo Late Policy."
                    >
                      Timing
                    </span>
                  </TableHead>
                  <TableHead>Submitted by</TableHead>
                  <TableHead className="w-48">Submitted at</TableHead>
                  <TableHead className="w-32">Artifacts</TableHead>
                  <TableHead className="w-48 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((item) => {
                  const {
                    submission,
                    reviewSubmissionId,
                    submitterId,
                    submitterName,
                    submitterEmail,
                  } = item;
                  const isLatest = submission.version === maxVersion;
                  // The API resolves review state from the linked reviewer workflow.
                  // Keep the immutable artifact status when no review record exists.
                  const displayStatus = submission.status;
                  const latestReviewId = isLatest
                    ? reviewSubmissionId || sharedReviewSubmissionId
                    : null;
                  const canActivelyReview =
                    isLatest && displayStatus === "SUBMITTED" && Boolean(latestReviewId);
                  const canViewCompletedReview =
                    isLatest && displayStatus !== "SUBMITTED" && Boolean(latestReviewId);

                  return (
                    <TableRow
                      key={submission.id}
                      className="cursor-pointer transition hover:bg-muted/50"
                      onClick={() => {
                        if (canActivelyReview && latestReviewId) {
                          handleReview(latestReviewId);
                        } else {
                          setSelectedSubmission(item);
                        }
                      }}
                    >
                      {/* Version column */}
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          <FileCheck2 className="size-4 shrink-0 text-primary" />
                          <span>v{submission.version}</span>
                          {isLatest && (
                            <Badge
                              variant="secondary"
                              className="px-1.5 py-0 text-[11px] font-medium"
                            >
                              Latest
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Status column */}
                      <TableCell>
                        <SubmissionStatusBadge status={displayStatus} />
                      </TableCell>

                      {/* Timing column */}
                      <TableCell>
                        {submission.submittedLate ? (
                          <Badge
                            variant="destructive"
                            className="cursor-help text-xs font-normal"
                            title={`Nộp sau deadline (${milestone ? formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone) : "hạn chót"}). Điểm phạt trừ: ${submission.latePenaltyPercent ?? 0}%.`}
                          >
                            Late
                            {submission.latePenaltyPercent != null
                              ? ` · ${submission.latePenaltyPercent}%`
                              : ""}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="cursor-help border-emerald-300 bg-emerald-50 text-xs font-normal text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                            title="Nộp đúng hạn trước hoặc đúng thời điểm deadline của Milestone. Không bị trừ điểm phạt."
                          >
                            On time
                          </Badge>
                        )}
                      </TableCell>

                      {/* Submitter column */}
                      <TableCell>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-foreground">
                            {submitterName || "Student"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {submitterEmail || submitterId}
                          </span>
                        </div>
                      </TableCell>

                      {/* Submitted at column */}
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <CalendarClock className="size-3.5 shrink-0" />
                          <span>
                            {milestone?.tenantTimeZone
                              ? formatTenantDateTime(
                                  submission.submittedAt,
                                  milestone.tenantTimeZone
                                )
                              : formatSubmissionDate(submission.submittedAt)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Artifacts summary */}
                      <TableCell>
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {submission.repositoryUrl && (
                            <a
                              href={submission.repositoryUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={`Repository: ${submission.repositoryUrl}`}
                              className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary"
                            >
                              <Github className="size-3.5" />
                            </a>
                          )}
                          {submission.deploymentUrl && (
                            <a
                              href={submission.deploymentUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={`Deployment: ${submission.deploymentUrl}`}
                              className="inline-flex size-7 items-center justify-center rounded-md border text-muted-foreground transition hover:border-primary hover:text-primary"
                            >
                              <MonitorPlay className="size-3.5" />
                            </a>
                          )}
                          {submission.attachments?.length > 0 && (
                            <span
                              title={`${submission.attachments.length} attached file(s)`}
                              className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground"
                            >
                              <FileText className="size-3" />
                              {submission.attachments.length}
                            </span>
                          )}
                          {!submission.repositoryUrl &&
                            !submission.deploymentUrl &&
                            (!submission.attachments ||
                              submission.attachments.length === 0) && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                        </div>
                      </TableCell>

                      {/* Actions column */}
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSubmission(item)}
                            title="View full submission details"
                          >
                            <Eye className="mr-1 size-3.5" />
                            Details
                          </Button>
                          {canActivelyReview && latestReviewId ? (
                            <Button
                              size="sm"
                              onClick={() => handleReview(latestReviewId)}
                            >
                              <ClipboardCheck className="mr-1 size-3.5" />
                              Review
                              <ArrowRight className="ml-1 size-3" />
                            </Button>
                          ) : canViewCompletedReview && latestReviewId ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleReview(latestReviewId)}
                              title="View completed review assessment"
                            >
                              <ClipboardCheck className="mr-1 size-3.5" />
                              View review
                            </Button>
                          ) : (
                            <Badge
                              variant="outline"
                              className="py-1 text-xs font-normal text-muted-foreground"
                              title={
                                isLatest
                                  ? "No review queue available for this milestone"
                                  : "This version has already been reviewed or superseded by a newer version"
                              }
                            >
                              {isLatest ? "View only" : "Reviewed"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Redesigned View Detail Dialog: Spacious, beautiful, matching SubmissionReviewPage */}
        {selectedSubmission && (
          <Dialog
            open={Boolean(selectedSubmission)}
            onOpenChange={(open) => !open && setSelectedSubmission(null)}
          >
            <DialogContent className="sm:max-w-4xl w-[94vw] max-h-[90vh] overflow-y-auto p-6 md:p-8">
              <DialogHeader className="gap-3 border-b pb-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <span>Milestone submission</span>
                      <span>•</span>
                      <span>Version {selectedSubmission.submission.version}</span>
                    </div>
                    <DialogTitle className="mt-1 text-2xl font-bold tracking-tight">
                      Submission Details · Version {selectedSubmission.submission.version}
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-sm text-muted-foreground">
                      {milestone?.title
                        ? `Milestone: ${milestone.title}`
                        : "Milestone submission details"}
                    </DialogDescription>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedSubmission.submission.version === maxVersion && (
                      <Badge variant="secondary" className="font-semibold">
                        Latest version
                      </Badge>
                    )}
                    <SubmissionStatusBadge status={selectedSubmission.submission.status} />
                    {selectedSubmission.submission.submittedLate ? (
                      <Badge variant="destructive">
                        Late ·{" "}
                        {selectedSubmission.submission.latePenaltyPercent != null
                          ? `${selectedSubmission.submission.latePenaltyPercent}% penalty`
                          : "Penalty applies"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        On time
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                {/* Submitter & Metadata Information */}
                <div className="rounded-xl border bg-muted/30 p-5">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Submission Information
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserRound className="size-4 text-muted-foreground" />
                        Submitted by
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {selectedSubmission.submitterName || "Student"}
                      </p>
                      {selectedSubmission.submitterEmail && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {selectedSubmission.submitterEmail}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="size-4 text-muted-foreground" />
                        Submitted at
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {milestone?.tenantTimeZone
                          ? formatTenantDateTime(
                              selectedSubmission.submission.submittedAt,
                              milestone.tenantTimeZone
                            )
                          : formatSubmissionDate(selectedSubmission.submission.submittedAt)}
                      </p>
                      {milestone?.tenantTimeZone && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe2 className="size-3" />
                          {milestone.tenantTimeZone}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ListChecks className="size-4 text-muted-foreground" />
                        Acceptance criteria
                      </p>
                      <p className="mt-1 font-medium text-foreground">
                        {(() => {
                          const total =
                            milestone?.checklist?.length ??
                            Object.keys(selectedSubmission.submission.checklist || {}).length;
                          const completed = Object.values(
                            selectedSubmission.submission.checklist || {}
                          ).filter(Boolean).length;
                          return total > 0
                            ? `${completed} of ${total} criteria confirmed`
                            : "Reviewer assessment pending";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Product Links: Repo & Demo */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border bg-card p-5 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Repository
                    </p>
                    {selectedSubmission.submission.repositoryUrl ? (
                      <a
                        href={selectedSubmission.submission.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm font-medium text-primary transition hover:bg-muted/70 hover:underline"
                      >
                        <span className="flex min-w-0 items-center gap-2.5 truncate">
                          <Github className="size-4.5 shrink-0" />
                          <span className="truncate">
                            {selectedSubmission.submission.repositoryUrl}
                          </span>
                        </span>
                        <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground italic">
                        No repository link provided
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border bg-card p-5 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Deployment
                    </p>
                    {selectedSubmission.submission.deploymentUrl ? (
                      <a
                        href={selectedSubmission.submission.deploymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3 text-sm font-medium text-primary transition hover:bg-muted/70 hover:underline"
                      >
                        <span className="flex min-w-0 items-center gap-2.5 truncate">
                          <MonitorPlay className="size-4.5 shrink-0" />
                          <span className="truncate">
                            {selectedSubmission.submission.deploymentUrl}
                          </span>
                        </span>
                        <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                      </a>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground italic">
                        No deployment link provided
                      </p>
                    )}
                  </div>
                </div>

                {/* Release Notes */}
                <div className="rounded-xl border bg-card p-5 shadow-xs">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Release notes
                  </p>
                  {selectedSubmission.submission.releaseNotes ? (
                    <div className="mt-3 rounded-lg bg-muted/30 p-4 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {selectedSubmission.submission.releaseNotes}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground italic">
                      No release notes provided
                    </p>
                  )}
                </div>

                {/* Attachments */}
                <div className="rounded-xl border bg-card p-5 shadow-xs">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Attachments ({selectedSubmission.submission.attachments?.length || 0})
                  </p>
                  {selectedSubmission.submission.attachments?.length ? (
                    <ul className="mt-3 grid gap-2.5">
                      {selectedSubmission.submission.attachments.map((attachment) => (
                        <li
                          key={attachment.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-2.5 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <FileText className="size-4.5 shrink-0 text-primary" />
                            <span className="truncate font-medium">{attachment.fileName}</span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {attachment.contentType} · {formatFileSize(attachment.sizeBytes)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground italic">
                      No files attached to this submission
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2 border-t pt-4 sm:justify-between">
                <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                  Close
                </Button>
                {selectedSubmission.submission.version === maxVersion &&
                (selectedSubmission.reviewSubmissionId || sharedReviewSubmissionId) ? (
                  <Button
                    variant={
                      selectedSubmission.submission.status === "SUBMITTED"
                        ? "default"
                        : "secondary"
                    }
                    onClick={() => {
                      const reviewId =
                        selectedSubmission.reviewSubmissionId || sharedReviewSubmissionId;
                      setSelectedSubmission(null);
                      if (reviewId) handleReview(reviewId);
                    }}
                    className="gap-2"
                  >
                    <ClipboardCheck className="size-4" />
                    {selectedSubmission.submission.status === "SUBMITTED"
                      ? "Review submission"
                      : "View review result"}
                    <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground self-center">
                    {selectedSubmission.submission.version < maxVersion
                      ? `Historical version — superseded by v${maxVersion}`
                      : "Review unavailable"}
                  </span>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </MainLayout>
  );
}
