import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  History,
  RotateCw,
  Send,
  Upload,
  CheckCircle2,
  CircleX,
  Clock3,
  Layers3,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ARTIFACT_REVIEW_STATES, artifactDeadline, artifactReviewState, loadAllArtifactMilestones } from "./workspace-artifacts.utils";
import type { ArtifactReviewState } from "./workspace-artifacts.utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import type { WorkspaceSectionAccess } from "@/types/features/workspace";
import type { ArtifactSubmission, MilestoneDetailResponse, MilestoneListItem } from "@/types";

type ArtifactMilestone = Pick<MilestoneListItem, "id" | "title" | "description" | "deadline" | "lifecycleStatus" | "mandatory">;

interface MilestoneSubmissionHistoryItem {
  submission: ArtifactSubmission;
  reviewSubmissionId?: string | null;
  submitterId?: string;
  submitterName?: string | null;
  submitterEmail?: string | null;
  reviewFeedback?: string | null;
  reviewedAt?: string | null;
}

export function WorkspaceArtifactsPanel({
  workspaceId,
  teamId,
  projectId,
  projectScoped = false,
  readOnly = false,
  milestone,
  onRefreshMilestone,
}: {
  workspaceId?: number;
  projectId?: number | null;
  teamId: number;
  access?: WorkspaceSectionAccess;
  milestone?: MilestoneDetailResponse;
  onRefreshMilestone?: () => void;
  projectScoped?: boolean;
  readOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { activeRole, hasPermission } = usePermissions();
  const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;

  const [historyMilestone, setHistoryMilestone] = useState<ArtifactMilestone | null>(null);
  const [search, setSearch] = useState("");
  const [milestoneFilter, setMilestoneFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<ArtifactReviewState | "ALL">("ALL");
  const [page, setPage] = useState(0);

  // Load team milestones
  const milestonesQuery = useQuery({
    queryKey: ["workspace-artifacts-milestones", teamId, projectId],
    queryFn: () => loadAllArtifactMilestones(page => projectScoped && projectId
      ? milestoneApi.getList(String(projectId), { teamId, page, size: 100 })
      : milestoneApi.getTeamList(teamId, { page, size: 100 })),
    enabled: !milestone && teamId > 0,
    retry: false,
  });

  // The detail page supplies its current milestone, so it does not depend on
  // the workspace list's pagination or load submissions for other milestones.
  const milestones: ArtifactMilestone[] = milestone ? [milestone] : milestonesQuery.data ?? [];
  const refreshMilestones = () => {
    if (milestone) onRefreshMilestone?.();
    else void milestonesQuery.refetch();
  };

  // Students only load their own history; reviewers/admins load the team queue.
  const submissionsQuery = useQuery({
    queryKey: ["team-artifact-submissions-workspace", teamId, isStudent, milestones.map((m) => m.id)],
    queryFn: async (): Promise<MilestoneSubmissionHistoryItem[]> => {
      if (!isStudent) return milestoneApi.getTeamArtifactSubmissions(teamId, milestone?.id);
      const ownHistory = await Promise.all(
        milestones.map((milestone) => milestoneApi.getMyTeamArtifactSubmissions(teamId, milestone.id)),
      );
      return ownHistory.flatMap((items) => items.map(({ submission, reviewFeedback, reviewedAt }) => ({
        submission,
        reviewFeedback,
        reviewedAt,
      })));
    },
    retry: false,
    enabled: teamId > 0 && (Boolean(milestone) || (!milestonesQuery.isPending && !milestonesQuery.isError)),
  });

  // Map submissions per milestoneId
  const submissionsByMilestone = new Map<string, MilestoneSubmissionHistoryItem[]>();
  submissionsQuery.data?.forEach((item) => {
    const list = submissionsByMilestone.get(item.submission.milestoneId) ?? [];
    list.push(item);
    submissionsByMilestone.set(item.submission.milestoneId, list);
  });

  // Submissions for dialog when milestone selected
  const activeMilestoneSubmissions = historyMilestone
    ? (submissionsByMilestone.get(historyMilestone.id) ?? []).sort(
        (a, b) => b.submission.version - a.submission.version
      )
    : [];

  const handleOpenSubmit = (milestoneId: string) => {
    navigate(`/teams/${teamId}/milestones/${milestoneId}/submit${workspaceId ? `?workspaceId=${workspaceId}` : ""}`);
  };

  const handleOpenSubmissionsPage = (milestoneId: string) => {
    if (isStudent) {
      navigate(`/student/teams/${teamId}/milestones/${milestoneId}/submissions${workspaceId ? `?workspaceId=${workspaceId}` : ""}`);
    } else {
      navigate(`/teams/${teamId}/milestones/${milestoneId}/submissions${workspaceId ? `?workspaceId=${workspaceId}` : ""}`);
    }
  };

  const loadingMilestones = !milestone && milestonesQuery.isPending;
  const milestoneError = !milestone && milestonesQuery.isError;
  const historyReady = submissionsQuery.isSuccess;
  const refreshing = milestonesQuery.isFetching || submissionsQuery.isFetching;
  const rows = milestones.map(item => {
    const history = submissionsByMilestone.get(item.id) ?? [];
    const latest = [...history].sort((a, b) => b.submission.version - a.submission.version)[0]?.submission;
    const state: ArtifactReviewState = !historyReady ? "UNKNOWN"
      : latest ? artifactReviewState(latest.status ?? "") : "NONE";
    return { milestone: item, history, latest, state };
  });
  const counts = rows.reduce((result, row) => {
    result[row.state] = (result[row.state] ?? 0) + 1;
    return result;
  }, {} as Partial<Record<ArtifactReviewState, number>>);
  const normalizedSearch = search.trim().toLocaleLowerCase("vi-VN");
  const filteredRows = rows.filter(row =>
    (milestoneFilter === "ALL" || row.milestone.id === milestoneFilter)
    && (statusFilter === "ALL" || row.state === statusFilter)
    && (!normalizedSearch || [row.milestone.title, row.milestone.description, row.milestone.id]
      .some(value => value?.toLocaleLowerCase("vi-VN").includes(normalizedSearch))));
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filteredRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const clearFilters = () => { setSearch(""); setMilestoneFilter("ALL"); setStatusFilter("ALL"); setPage(0); };
  const singleRow = milestone ? rows[0] : null;

  return (
    <div className="min-w-0 space-y-3">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2 shadow-sm" aria-labelledby="workspace-artifacts-title">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Layers3 className="size-4" /></span>
          <div className="min-w-0">
            <h2 id="workspace-artifacts-title" className="text-sm font-semibold leading-5">{milestone ? "Submit and track artifacts" : "Artifact management"}</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Track deliverables, submitted versions, and review outcomes for your team's milestones.</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={refreshing} onClick={() => { refreshMilestones(); void submissionsQuery.refetch(); }}>
          <RotateCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />Refresh
        </Button>
      </section>

      {submissionsQuery.isError && !milestoneError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs">
        <span>Could not load artifact history. Versions and review outcomes have not been verified.</span>
        <Button type="button" variant="outline" size="sm" onClick={() => void submissionsQuery.refetch()}>Try again</Button>
      </div>}

      {milestone ? <section aria-label="Milestone deliverable" className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><FileCheck2 className="size-5" /></span><div><h3 className="font-semibold">{milestone.title}</h3><p className="mt-1 text-sm text-muted-foreground">{historyReady ? singleRow?.history.length ?? 0 : "—"} submitted version(s)</p></div></div>
          {submissionsQuery.isPending ? <Skeleton className="h-7 w-28" /> : <Badge variant="outline" className={ARTIFACT_REVIEW_STATES[singleRow?.state ?? "UNKNOWN"].tone}>{historyReady ? ARTIFACT_REVIEW_STATES[singleRow?.state ?? "UNKNOWN"].label : "Not verified"}</Badge>}
        </div>
        {submissionsQuery.isPending ? <div className="mt-5 grid gap-3"><Skeleton className="h-5 w-56" /><Skeleton className="h-5 w-40" /></div> : singleRow?.latest ? <div className="mt-5 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2">
          <div><p className="text-muted-foreground">Latest version</p><p className="mt-1 font-medium">v{singleRow.latest.version} · {new Date(singleRow.latest.submittedAt).toLocaleString()}</p></div>
          <div><p className="text-muted-foreground">Submission timing</p><p className="mt-1 font-medium">{singleRow.latest.submittedLate ? `Late${singleRow.latest.latePenaltyPercent != null ? ` · ${singleRow.latest.latePenaltyPercent}% penalty` : ""}` : "On time"}</p></div>
          {singleRow.latest.repositoryUrl ? <div className="min-w-0"><p className="text-muted-foreground">Repository</p><a className="mt-1 block truncate font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300" href={singleRow.latest.repositoryUrl} target="_blank" rel="noreferrer">{singleRow.latest.repositoryUrl}</a></div> : null}
          {singleRow.latest.deploymentUrl ? <div className="min-w-0"><p className="text-muted-foreground">Deployment</p><a className="mt-1 block truncate font-medium text-blue-700 underline underline-offset-2 dark:text-blue-300" href={singleRow.latest.deploymentUrl} target="_blank" rel="noreferrer">{singleRow.latest.deploymentUrl}</a></div> : null}
          {singleRow.latest.releaseNotes ? <div className="sm:col-span-2"><p className="text-muted-foreground">Release notes</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words">{singleRow.latest.releaseNotes}</p></div> : null}
        </div> : !historyReady ? <p className="mt-5 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Submission status could not be verified. Try Refresh.</p> : <p className="mt-5 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No submitted versions yet. The team can submit when this milestone is open.</p>}
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          <Button type="button" variant="outline" size="sm" onClick={() => setHistoryMilestone(milestone)} disabled={!historyReady}><History className="size-4" /> Submission history</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleOpenSubmissionsPage(milestone.id)}><ExternalLink className="size-4" /> Full submission page</Button>
          {historyReady && !readOnly && isStudent && hasPermission("ARTIFACT_SUBMIT") && singleRow?.state === "CHANGES_REQUESTED" ? <Button type="button" size="sm" onClick={() => handleOpenSubmit(milestone.id)}><Send className="size-4" /> Resubmit v{(singleRow.latest?.version ?? 0) + 1}</Button> : null}
          {historyReady && !readOnly && isStudent && hasPermission("ARTIFACT_SUBMIT") && !singleRow?.latest && (milestone.lifecycleStatus === "IN_PROGRESS" || milestone.lifecycleStatus === "CHANGES_REQUESTED") ? <Button type="button" size="sm" onClick={() => handleOpenSubmit(milestone.id)}><Upload className="size-4" /> Submit artifact</Button> : null}
        </div>
      </section> : <>
      {!milestoneError && <section aria-label="Search and filter deliverables" className="min-w-0 space-y-2 rounded-xl border bg-card px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-48 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" aria-label="Search artifacts or milestones" placeholder="Search by name, description, or milestone ID..." value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} className="h-8 bg-background pl-9 text-xs" disabled={loadingMilestones} />
          </label>
          <select aria-label="Filter by milestone" value={milestoneFilter} onChange={event => { setMilestoneFilter(event.target.value); setPage(0); }} disabled={loadingMilestones} className="h-8 min-w-0 max-w-full flex-1 rounded-md border bg-background px-2 text-xs sm:max-w-48 sm:flex-none">
            <option value="ALL">All milestones</option>
            {milestones.map(item => <option key={item.id} value={item.id}>{item.title || "Untitled milestone"}</option>)}
          </select>
          <select aria-label="Filter by review status" value={statusFilter} onChange={event => { setStatusFilter(event.target.value as ArtifactReviewState | "ALL"); setPage(0); }} disabled={!historyReady} className="h-8 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs sm:max-w-44 sm:flex-none">
            <option value="ALL">All statuses</option>
            {Object.entries(ARTIFACT_REVIEW_STATES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-2.5 text-[10px]" aria-live="polite">
          <span className="font-medium uppercase tracking-wide text-muted-foreground">Overview</span>
          <Badge variant="secondary" className="rounded px-2 py-0.5 text-[10px]">Total: {loadingMilestones ? "—" : rows.length}</Badge>
          {(["ACCEPTED", "SUBMITTED", "CHANGES_REQUESTED", "REJECTED"] as const).map(key => <Badge key={key} variant="outline" className={`rounded px-2 py-0.5 text-[10px] ${ARTIFACT_REVIEW_STATES[key].tone}`}>
            <span className="size-1.5 rounded-full bg-current" />{ARTIFACT_REVIEW_STATES[key].label}: {historyReady ? counts[key] ?? 0 : "—"}
          </Badge>)}
        </div>
      </section>}

      <section className="min-w-0 overflow-hidden rounded-xl border bg-card" aria-label="Deliverables list" aria-busy={loadingMilestones || (!milestoneError && submissionsQuery.isPending)}>
        {milestoneError ? <div role="alert" className="grid justify-items-center gap-3 px-5 py-12 text-center text-sm">
          <CircleX className="size-8 text-destructive" /><h3 className="font-semibold">Could not load deliverables</h3>
          <p className="text-muted-foreground">Check your connection or workspace access, then try again.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void milestonesQuery.refetch()}><RotateCw className="size-3.5" />Try again</Button>
        </div> : loadingMilestones ? <div role="status" className="space-y-4 p-4"><span className="sr-only">Loading deliverables</span><Skeleton className="h-8 w-full" />{[1, 2, 3, 4].map(item => <Skeleton key={item} className="h-20 w-full" />)}</div>
          : milestones.length === 0 ? <div className="grid justify-items-center gap-2 px-5 py-12 text-center"><FolderOpen className="size-9 text-muted-foreground/60" /><h3 className="text-sm font-semibold">No milestones in this workspace yet</h3><p className="max-w-md text-xs text-muted-foreground">You can submit and track deliverables here once an instructor or administrator creates milestones for your team.</p></div>
          : <>
            <div className="min-w-0 overflow-x-auto overscroll-x-contain" role="region" aria-label="Artifacts table; scroll horizontally when needed" tabIndex={0}>
              <Table className="min-w-[970px] table-fixed text-xs">
                <TableHeader className="bg-muted/40"><TableRow className="hover:bg-transparent">
                  <TableHead className="w-[25%] px-4 py-3 text-[10px] font-semibold uppercase tracking-wide">Deliverable</TableHead>
                  <TableHead className="w-[16%] px-3 text-[10px] font-semibold uppercase tracking-wide">Milestone</TableHead>
                  <TableHead className="w-[15%] px-3 text-[10px] font-semibold uppercase tracking-wide">Deadline</TableHead>
                  <TableHead className="w-[14%] px-3 text-[10px] font-semibold uppercase tracking-wide">Versions & submissions</TableHead>
                  <TableHead className="w-[15%] px-3 text-[10px] font-semibold uppercase tracking-wide">Review status</TableHead>
                  <TableHead className="w-[15%] px-3 text-right text-[10px] font-semibold uppercase tracking-wide">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pageRows.map(({ milestone: item, latest, history, state }) => {
                    const deadline = artifactDeadline(item.deadline);
                    const status = ARTIFACT_REVIEW_STATES[state];
                    const canResubmit = historyReady && !readOnly && state === "CHANGES_REQUESTED" && isStudent && hasPermission("ARTIFACT_SUBMIT");
                    const hasSubmission = Boolean(latest);
                    return <TableRow key={item.id} className="align-top hover:bg-muted/20">
                      <TableCell className="whitespace-normal px-4 py-3"><div className="flex min-w-0 items-start gap-2.5">
                        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border ${status.tone}`}><FileCheck2 className="size-4" /></span>
                        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-1.5 gap-y-1"><span className="line-clamp-2 break-words font-semibold [overflow-wrap:anywhere]" title={item.title || undefined}>{item.title || "Untitled milestone"}</span>{item.mandatory && <Badge variant="secondary" className="rounded px-1 py-0 text-[9px]">Required</Badge>}</div>
                          <p className="mt-1 line-clamp-2 break-words text-[11px] leading-4 text-muted-foreground [overflow-wrap:anywhere]" title={item.description || undefined}>{item.description?.trim() || "No description provided."}</p>
                        </div>
                      </div></TableCell>
                      <TableCell className="whitespace-normal px-3 py-3"><button type="button" className="max-w-full rounded-md border border-blue-100 bg-blue-50/60 px-2 py-1.5 text-left text-[11px] leading-4 text-blue-700 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300" onClick={() => navigate(`/teams/${teamId}/milestones/${item.id}${workspaceId ? `?workspaceId=${workspaceId}` : ""}`)} title="View milestone"><span className="line-clamp-2 break-words [overflow-wrap:anywhere]">{item.title || "Untitled milestone"}</span></button></TableCell>
                      <TableCell className="whitespace-normal px-3 py-3">{deadline ? <div className="space-y-1.5"><span className="flex items-start gap-1.5 leading-4"><CalendarClock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" /><time dateTime={deadline.date.toISOString()}>{deadline.label}</time></span>{deadline.past && <span className="inline-block rounded border border-rose-100 bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300" title="The deadline has passed. See submission timing in the version column.">Deadline passed</span>}</div> : <span className="text-muted-foreground">No deadline set</span>}</TableCell>
                      <TableCell className="whitespace-normal px-3 py-3">{submissionsQuery.isPending ? <Skeleton className="h-5 w-20" /> : !historyReady ? <span className="text-muted-foreground">Not verified</span> : latest ? <div className="space-y-1.5"><span className="inline-block rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-semibold text-white">{state === "DRAFT" ? "Draft" : "Submitted"} v{latest.version ?? "—"}</span><p className="text-[10px] leading-4 text-muted-foreground">{history.length} {history.length === 1 ? "version" : "versions"} in history</p>{latest.submittedLate === true ? <span className="text-[10px] text-amber-700 dark:text-amber-300">Submitted late{latest.latePenaltyPercent != null ? ` (−${latest.latePenaltyPercent}%)` : ""}</span> : latest.submittedLate === false ? <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><CheckCircle2 className="size-3 text-emerald-600" />Submitted on time</span> : null}</div> : <span className="text-muted-foreground">No versions yet</span>}</TableCell>
                      <TableCell className="whitespace-normal px-3 py-3">{submissionsQuery.isPending ? <Skeleton className="h-5 w-24" /> : <Badge variant="outline" className={`max-w-full gap-1 rounded-full px-2 py-1 text-[10px] leading-4 whitespace-normal ${status.tone}`}>
                        {state === "ACCEPTED" ? <CheckCircle2 className="size-3 shrink-0" /> : state === "REJECTED" ? <CircleX className="size-3 shrink-0" /> : <Clock3 className="size-3 shrink-0" />}{historyReady ? status.label : "Not verified"}
                      </Badge>}</TableCell>
                      <TableCell className="whitespace-normal px-3 py-3"><div className="flex flex-col items-end gap-2">
                        <Button type="button" variant="outline" size="sm" className="h-auto min-h-8 max-w-full gap-1.5 whitespace-normal px-2 py-1 text-[11px]" onClick={() => setHistoryMilestone(item)} title="View the history of all submitted versions"><History className="size-3.5 shrink-0" />Submission history {historyReady ? `(${history.length})` : ""}</Button>
                        {canResubmit ? <Button type="button" size="sm" variant="secondary" className="h-auto min-h-7 max-w-full gap-1 whitespace-normal border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900 hover:bg-amber-100" onClick={() => handleOpenSubmit(item.id)}><Send className="size-3 shrink-0" />Resubmit v{(latest?.version ?? 0) + 1}</Button> : !hasSubmission ? <Button type="button" size="sm" className="h-auto min-h-7 max-w-full gap-1 whitespace-normal px-2 py-1 text-[10px]" disabled={readOnly || !hasPermission("ARTIFACT_SUBMIT") || !historyReady || (item.lifecycleStatus !== "IN_PROGRESS" && item.lifecycleStatus !== "CHANGES_REQUESTED")} onClick={() => handleOpenSubmit(item.id)} title={item.lifecycleStatus === "PLANNED" ? "This milestone is not open for submissions." : "Prepare and submit an artifact for this milestone"}><Upload className="size-3 shrink-0" />Submit artifact</Button> : null}
                        {item.lifecycleStatus === "PLANNED" && !hasSubmission && <span className="text-right text-[10px] leading-4 text-muted-foreground">This milestone is not open for submissions.</span>}
                      </div></TableCell>
                    </TableRow>;
                  })}
                  {filteredRows.length === 0 && <TableRow><TableCell colSpan={6} className="px-4 py-12 text-center"><p className="font-medium">No matching deliverables</p><p className="mt-1 text-xs text-muted-foreground">Try another search term or clear the current filters.</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={clearFilters}>Clear filters</Button></TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground" aria-live="polite">
              <span>Showing {pageRows.length ? currentPage * pageSize + 1 : 0}–{Math.min((currentPage + 1) * pageSize, filteredRows.length)} of {filteredRows.length} deliverables{filteredRows.length !== rows.length ? ` (total ${rows.length})` : ""}</span>
              <div className="flex items-center gap-1"><Button type="button" variant="outline" size="icon-sm" className="size-7" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-3.5" /></Button><span className="min-w-12 text-center tabular-nums">{currentPage + 1} / {pageCount}</span><Button type="button" variant="outline" size="icon-sm" className="size-7" aria-label="Next page" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-3.5" /></Button></div>
            </div>
          </>}
      </section>
      </>}

      {/* History Dialog (Fix Bug #28) */}
      <Dialog open={Boolean(historyMilestone)} onOpenChange={(open) => !open && setHistoryMilestone(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-xl sm:max-w-5xl">
          <div className="border-b bg-gradient-to-r from-primary/10 via-background to-sky-500/10 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex min-w-0 items-start gap-2 pr-6 text-lg leading-snug">
              <History className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">Submission history: {historyMilestone?.title}</span>
            </DialogTitle>
            <DialogDescription>
              Review status, submission time, delivery links, and release notes for every submitted version.
            </DialogDescription>
          </DialogHeader>
          {activeMilestoneSubmissions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{activeMilestoneSubmissions.length} {activeMilestoneSubmissions.length === 1 ? "version" : "versions"}</Badge>
              <Badge variant="outline">Latest: v{activeMilestoneSubmissions[0].submission.version}</Badge>
            </div>
          )}
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-4 py-4 sm:px-6">
            {submissionsQuery.isPending ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <RotateCw className="size-4 animate-spin" /> Loading submission history…
              </div>
            ) : submissionsQuery.isError ? (
              <div className="grid justify-items-center gap-3 py-8 text-center text-sm text-destructive">
                <p>Could not load submission history. Try again to refresh the latest data.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void submissionsQuery.refetch()}>
                  <RotateCw className="mr-1.5 size-4" /> Try again
                </Button>
              </div>
            ) : activeMilestoneSubmissions.length === 0 ? (
              <div className="grid justify-items-center gap-2 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                <FileCheck2 className="size-7" />
                <p className="font-medium text-foreground">No submissions yet</p>
                <p>No submitted versions are available for this milestone.</p>
              </div>
            ) : (
              <div className="min-w-0 max-w-full overflow-x-auto rounded-xl border">
                <Table className="w-full min-w-[850px] table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Version</TableHead>
                      <TableHead className="w-36">Review status</TableHead>
                      <TableHead className="w-44">Submitted</TableHead>
                      <TableHead className="w-28">Timing</TableHead>
                      <TableHead>Delivery links</TableHead>
                      <TableHead className="w-48">Release notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeMilestoneSubmissions.map(({ submission }) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-semibold">v{submission.version}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`whitespace-normal ${ARTIFACT_REVIEW_STATES[artifactReviewState(submission.status)].tone}`}>
                            {ARTIFACT_REVIEW_STATES[artifactReviewState(submission.status)].label}
                          </Badge>
                          {activeRole && normalizeRole(activeRole) === STUDENT_ROLE && activeMilestoneSubmissions.find((item) => item.submission.id === submission.id)?.reviewFeedback ? (
                            <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground [overflow-wrap:anywhere]">
                              {activeMilestoneSubmissions.find((item) => item.submission.id === submission.id)?.reviewFeedback}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(submission.submittedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {submission.submittedLate ? (
                            <Badge variant="destructive" className="text-[11px]">
                              Late{submission.latePenaltyPercent != null ? ` (-${submission.latePenaltyPercent}%)` : ""}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 text-[11px]">
                              On time
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="space-y-1 text-xs">
                          {submission.repositoryUrl && (
                            <div>
                              <a
                                href={submission.repositoryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline inline-flex items-center gap-1 break-all"
                              >
                                Repo <ExternalLink className="size-3" />
                              </a>
                            </div>
                          )}
                          {submission.deploymentUrl && (
                            <div>
                              <a
                                href={submission.deploymentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline inline-flex items-center gap-1 break-all"
                              >
                                Deploy <ExternalLink className="size-3" />
                              </a>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground"><div className="max-h-32 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]" tabIndex={0} aria-label={`Release notes for version ${submission.version}`}>
                          {submission.releaseNotes || "—"}
                        </div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="m-0 flex min-w-0 shrink-0 flex-col items-stretch gap-3 rounded-none border-t bg-muted/20 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const targetMilestoneId = historyMilestone?.id;
                setHistoryMilestone(null);
                if (targetMilestoneId) handleOpenSubmissionsPage(targetMilestoneId);
              }}
            >
              <ExternalLink className="mr-1.5 size-4" /> Open full submission page
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setHistoryMilestone(null)}>
                Close
              </Button>
              {historyReady && !readOnly && isStudent && hasPermission("ARTIFACT_SUBMIT") && historyMilestone && activeMilestoneSubmissions[0]?.submission.status === "CHANGES_REQUESTED" && (
                <Button type="button" onClick={() => handleOpenSubmit(historyMilestone.id)}>
                  <Send className="mr-1.5 size-4" /> Submit a new version
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
