import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle, ArrowDownUp, CalendarClock, ChevronLeft, ChevronRight, ClipboardCheck,
  Eye, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, Upload, X,
} from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { getMilestoneApiError } from "@/pages/management/project/milestone/milestone.utils";
import type { MilestoneLifecycleStatus, MilestoneListItem } from "@/types";
import type { WorkspaceSectionAccess } from "@/types/features/workspace";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import { WorkspaceStatusBadge } from "./workspace.shared";
import {
  countWorkspaceMilestoneFilters, hasWorkspaceMilestoneQuery, parseWorkspaceMilestoneList,
  writeWorkspaceMilestoneList, type WorkspaceMilestoneListState,
} from "./workspace-milestone-list-query";

const statuses: Array<{ value: MilestoneLifecycleStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All statuses" }, { value: "PLANNED", label: "Planned" },
  { value: "IN_PROGRESS", label: "In progress" }, { value: "SUBMITTED", label: "Submitted" },
  { value: "CHANGES_REQUESTED", label: "Changes requested" },
  { value: "ACCEPTED", label: "Accepted" }, { value: "REJECTED", label: "Rejected" },
];
const sortOptions = [
  { value: "deadline:asc", label: "Deadline: earliest" },
  { value: "deadline:desc", label: "Deadline: latest" },
  { value: "title:asc", label: "Name: A–Z" },
  { value: "title:desc", label: "Name: Z–A" },
  { value: "createdAt:desc", label: "Newest created" },
] as const;
const statusColor: Record<MilestoneLifecycleStatus, string> = {
  PLANNED: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  IN_PROGRESS: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  SUBMITTED: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  CHANGES_REQUESTED: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  ACCEPTED: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};
const statusDot: Record<MilestoneLifecycleStatus, string> = {
  PLANNED: "bg-slate-400", IN_PROGRESS: "bg-amber-400", SUBMITTED: "bg-blue-500",
  CHANGES_REQUESTED: "bg-orange-500", ACCEPTED: "bg-emerald-500", REJECTED: "bg-red-500",
};
const rowColumns = "lg:grid-cols-[minmax(180px,1.15fr)_minmax(180px,1.35fr)_minmax(170px,0.95fr)_minmax(135px,0.75fr)_minmax(170px,0.85fr)]";
const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

function formatDeadline(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid deadline" : dateFormatter.format(date);
}

function StatusBadge({ status }: { status: MilestoneLifecycleStatus }) {
  return <Badge variant="outline" className={cn("w-fit rounded-full px-3 py-1 text-xs font-semibold", statusColor[status])}>
    {statuses.find((item) => item.value === status)?.label ?? status}
  </Badge>;
}

function MilestoneSearch({ initial, onSearch }: { initial: string; onSearch: (value: string) => void }) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setText((current) =>
      current.trim().replace(/\s+/g, " ").slice(0, 120) === initial ? current : initial));
    return () => window.cancelAnimationFrame(frame);
  }, [initial]);
  useEffect(() => {
    const normalized = text.trim().replace(/\s+/g, " ").slice(0, 120);
    if (normalized === initial) return;
    const timer = window.setTimeout(() => onSearch(normalized), 300);
    return () => window.clearTimeout(timer);
  }, [initial, onSearch, text]);
  return <div className="relative min-w-[220px] flex-1 lg:max-w-xl">
    <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input value={text} onChange={(event) => setText(event.target.value)} maxLength={120}
      className="h-10 w-full pl-10 pr-9" aria-label="Search milestones" placeholder="Search milestones by title or description..." />
    {text && <button type="button" aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      onClick={() => { setText(""); onSearch(""); }}><X className="size-4" /></button>}
  </div>;
}

type FilterDraft = Pick<WorkspaceMilestoneListState, "mandatory" | "latePolicy" | "from" | "to">;

export function WorkspaceMilestonesPanel({ projectId, teamId, workspaceId, access, projectScoped = false, readOnly = false, title = "Milestones", projectStatus }: {
  projectId?: number | null; teamId: number; workspaceId: number; access: WorkspaceSectionAccess;
  projectScoped?: boolean; readOnly?: boolean; title?: string; projectStatus?: string;
}) {
  const [pendingDelete, setPendingDelete] = useState<MilestoneListItem | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const serializedParams = searchParams.toString();
  const list = useMemo(() => parseWorkspaceMilestoneList(new URLSearchParams(serializedParams)), [serializedParams]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<FilterDraft>({
    mandatory: list.mandatory, latePolicy: list.latePolicy, from: list.from, to: list.to,
  });
  const { activeRole } = usePermissions();
  const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;
  const canManage = !isStudent && !readOnly && !!access.actions.create;
  const canReview = !isStudent && !!access.actions.review;
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  const updateList = useCallback((patch: Partial<WorkspaceMilestoneListState>) => {
    setSearchParams((current) => writeWorkspaceMilestoneList(current, {
      ...parseWorkspaceMilestoneList(current), ...patch,
    }), { replace: true });
  }, [setSearchParams]);
  const updateSearch = useCallback((value: string) => updateList({ search: value, page: 0 }), [updateList]);

  const query = useQuery({
    queryKey: ["workspace-milestones", projectId, teamId, projectScoped, list.page, list.size, list.sort,
      list.search, list.status, list.mandatory, list.latePolicy, list.from, list.to],
    queryFn: () => {
      const options = {
        page: list.page, size: list.size, sort: list.sort,
        search: list.search || undefined,
        status: list.status === "ALL" ? undefined : [list.status],
        mandatory: list.mandatory === "ALL" ? undefined : list.mandatory === "true",
        latePolicyType: list.latePolicy === "ALL" ? undefined : [list.latePolicy],
        deadlineFrom: list.from || undefined, deadlineTo: list.to || undefined,
      };
      return projectScoped && projectId
        ? milestoneApi.getList(String(projectId), { ...options, teamId })
        : milestoneApi.getTeamList(teamId, options);
    },
    placeholderData: keepPreviousData, retry: false, refetchInterval: 30_000,
  });
  const reviewQuery = useQuery({
    queryKey: ["team-artifact-submissions", teamId],
    queryFn: () => milestoneApi.getTeamArtifactSubmissions(teamId),
    retry: false, refetchInterval: 20_000, enabled: canReview,
  });
  const submissionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    reviewQuery.data?.forEach(({ submission }) => counts.set(submission.milestoneId, (counts.get(submission.milestoneId) ?? 0) + 1));
    return counts;
  }, [reviewQuery.data]);

  useEffect(() => {
    if (!query.data || query.isPlaceholderData) return;
    if (query.data.totalPages === 0 && list.page > 0) updateList({ page: 0 });
    else if (query.data.totalPages > 0 && list.page >= query.data.totalPages) updateList({ page: query.data.totalPages - 1 });
  }, [list.page, query.data, query.isPlaceholderData, updateList]);

  const remove = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      milestoneApi.deleteDraft(projectId ? String(projectId) : undefined, teamId, id, version),
    onSuccess: () => {
      setPendingDelete(null);
      void client.invalidateQueries({ queryKey: ["workspace-milestones", projectId, teamId] });
    },
  });
  const create = () => navigate(projectId
    ? "/projects/" + projectId + "/milestones/new?teamId=" + teamId + "&scope=team&workspaceId=" + workspaceId
    : "/teams/" + teamId + "/milestones/new?workspaceId=" + workspaceId, { state: { returnTo } });
  const detailUrl = (id: string) => "/teams/" + teamId + "/milestones/" + id + "?workspaceId=" + workspaceId;
  const openDetail = (id: string) => navigate(detailUrl(id), { state: { returnTo } });
  const edit = (milestone: MilestoneListItem) => navigate(
    milestone.lifecycleStatus === "PLANNED" && projectId
      ? "/projects/" + projectId + "/milestones/" + milestone.id + "/edit?teamId=" + teamId + "&scope=team&workspaceId=" + workspaceId
      : "/teams/" + teamId + "/milestones/" + milestone.id + "/edit?workspaceId=" + workspaceId,
    { state: { returnTo } },
  );
  const clearQuery = () => updateList({ search: "", status: "ALL", mandatory: "ALL", latePolicy: "ALL", from: "", to: "", page: 0 });
  const openFilters = (open: boolean) => {
    setFiltersOpen(open);
    if (open) setFilterDraft({ mandatory: list.mandatory, latePolicy: list.latePolicy, from: list.from, to: list.to });
  };
  const invalidDateRange = !!filterDraft.from && !!filterDraft.to && filterDraft.from > filterDraft.to;
  const response = query.data;
  const total = response?.totalElements ?? 0;
  const pageIndex = query.isPlaceholderData ? (response?.page ?? list.page) : list.page;
  const shownSize = query.isPlaceholderData ? (response?.size ?? list.size) : list.size;
  const first = total ? pageIndex * shownSize + 1 : 0;
  const last = Math.min((pageIndex + 1) * shownSize, total);
  const totalPages = response?.totalPages ?? 0;
  const pageStart = Math.max(0, Math.min(pageIndex - 2, totalPages - 5));
  const visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => pageStart + index);
  const filterCount = countWorkspaceMilestoneFilters(list);
  const busy = query.isFetching && !!response;
  const navigationDisabled = busy || query.isError;

  return <section className="min-w-0 space-y-4" aria-label="Workspace milestones">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="break-words text-2xl font-bold tracking-tight">{title}</h2>
          {projectStatus && <WorkspaceStatusBadge status={projectStatus} colored />}
        </div>
        <p className="text-sm text-muted-foreground">Track deadlines, deliverables, and assessment progress for this workspace.</p>
      </div>
      {canManage && <Button className="shrink-0" onClick={create}><Plus className="size-4" /> Create milestone</Button>}
    </div>
    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <MilestoneSearch initial={list.search} onSearch={updateSearch} />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={list.status} onValueChange={(value) => updateList({ status: value as WorkspaceMilestoneListState["status"], page: 0 })}>
            <SelectTrigger className="h-10 w-[165px]" aria-label="Filter milestones by status"><SelectValue /></SelectTrigger>
            <SelectContent>{statuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={list.sort} onValueChange={(value) => updateList({ sort: value as WorkspaceMilestoneListState["sort"], page: 0 })}>
            <SelectTrigger className="h-10 w-[190px]" aria-label="Sort milestones"><ArrowDownUp className="size-4" /><SelectValue /></SelectTrigger>
            <SelectContent>{sortOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
          </Select>
          <Popover open={filtersOpen} onOpenChange={openFilters}>
            <PopoverTrigger asChild><Button variant="outline" className="h-10"><SlidersHorizontal className="size-4" /> More filters
              {filterCount > 0 && <Badge variant="secondary" className="ml-1 px-1.5 py-0">{filterCount}</Badge>}
            </Button></PopoverTrigger>
            <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] space-y-4">
              <div><p className="font-semibold">More filters</p><p className="text-xs text-muted-foreground">Deadline dates use the workspace time zone; table times use your device time zone.</p></div>
              <div className="space-y-2"><Label htmlFor="ms-mandatory">Requirement</Label>
                <Select value={filterDraft.mandatory} onValueChange={(value) => setFilterDraft((draft) => ({ ...draft, mandatory: value as FilterDraft["mandatory"] }))}>
                  <SelectTrigger id="ms-mandatory" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ALL">All milestones</SelectItem><SelectItem value="true">Mandatory</SelectItem><SelectItem value="false">Optional</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label htmlFor="ms-late-policy">Late submissions</Label>
                <Select value={filterDraft.latePolicy} onValueChange={(value) => setFilterDraft((draft) => ({ ...draft, latePolicy: value as FilterDraft["latePolicy"] }))}>
                  <SelectTrigger id="ms-late-policy" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ALL">Any policy</SelectItem><SelectItem value="NO_LATE">Not allowed</SelectItem><SelectItem value="ALLOW_LATE">Allowed</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="ms-from">Deadline from</Label><Input id="ms-from" type="date" value={filterDraft.from} onChange={(event) => setFilterDraft((draft) => ({ ...draft, from: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="ms-to">Deadline to</Label><Input id="ms-to" type="date" value={filterDraft.to} onChange={(event) => setFilterDraft((draft) => ({ ...draft, to: event.target.value }))} /></div>
              </div>
              {invalidDateRange && <p role="alert" className="text-xs text-destructive">Deadline from must be on or before deadline to.</p>}
              <div className="flex justify-between gap-2 border-t pt-3">
                <Button variant="ghost" size="sm" onClick={() => { updateList({ mandatory: "ALL", latePolicy: "ALL", from: "", to: "", page: 0 }); setFiltersOpen(false); }}>Clear filters</Button>
                <Button size="sm" disabled={invalidDateRange} onClick={() => { updateList({ ...filterDraft, page: 0 }); setFiltersOpen(false); }}>Apply filters</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {query.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <span className="inline-flex items-center gap-2"><AlertCircle className="size-4" />{getMilestoneApiError(query.error).message || "Unable to load milestones."}</span>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}><RefreshCw className="size-4" /> Retry</Button>
      </div>}
      {query.isPending ? <div className="space-y-3 p-4" role="status" aria-label="Loading milestones">
        {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-16 w-full" />)}
      </div> : response?.content.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-4 py-9 text-center">
        <ClipboardCheck className="size-8 text-muted-foreground" />
        <div><p className="font-semibold">{hasWorkspaceMilestoneQuery(list) ? "No matching milestones" : "No milestones yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{hasWorkspaceMilestoneQuery(list) ? "Try another search term or clear the active filters." : "Milestones will appear here when they are created for this workspace."}</p></div>
        {hasWorkspaceMilestoneQuery(list) ? <Button variant="outline" size="sm" onClick={clearQuery}>Clear search and filters</Button>
          : canManage ? <Button size="sm" onClick={create}><Plus className="size-4" /> Create the first milestone</Button> : null}
      </div> : response ? <div aria-busy={busy} className={cn("transition-opacity", busy && "opacity-60")}>
        <div className={cn("hidden gap-5 border-b bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid", rowColumns)}>
          <span>Milestone</span><span>Description</span><span>Deadline</span><span>Status</span><span className="text-right">Actions</span>
        </div>
        {response.content.map((milestone) => {
          const overdue = ["IN_PROGRESS", "CHANGES_REQUESTED"].includes(milestone.lifecycleStatus)
            && new Date(milestone.deadline).getTime() < query.dataUpdatedAt;
          return <div key={milestone.id} className={cn("grid gap-3 border-b px-4 py-4 last:border-b-0 hover:bg-muted/20 lg:items-center lg:gap-5", rowColumns)}>
            <div className="flex min-w-0 items-start gap-3">
              <span aria-hidden="true" className={cn("mt-2 size-2.5 shrink-0 rounded-full", statusDot[milestone.lifecycleStatus])} />
              <div className="min-w-0"><button type="button" className="break-words text-left font-semibold leading-5 hover:underline" onClick={() => openDetail(milestone.id)}>{milestone.title}</button>
                <p className="mt-1 text-xs text-muted-foreground">{milestone.mandatory ? "Mandatory milestone" : "Optional milestone"}</p></div>
            </div>
            <div className="min-w-0"><span className="text-xs font-medium uppercase text-muted-foreground lg:hidden">Description</span>
              <p className="line-clamp-2 text-sm text-muted-foreground" title={milestone.description || "No description"}>{milestone.description || "No description"}</p></div>
            <div className="min-w-0"><span className="text-xs font-medium uppercase text-muted-foreground lg:hidden">Deadline</span>
              <p className={cn("flex items-center gap-2 text-sm", overdue ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                <CalendarClock className="size-4 shrink-0" /><span>{formatDeadline(milestone.deadline)}</span></p></div>
            <div><span className="mb-1 block text-xs font-medium uppercase text-muted-foreground lg:hidden">Status</span><StatusBadge status={milestone.lifecycleStatus} /></div>
            <div className="flex flex-wrap items-center gap-1 lg:justify-end" aria-label={"Actions for " + milestone.title}>
              {canManage && ["PLANNED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(milestone.lifecycleStatus) && <Button size="icon-sm" variant="ghost" title="Edit milestone" aria-label={"Edit " + milestone.title} onClick={() => edit(milestone)}><Pencil className="size-4" /></Button>}
              {canManage && milestone.lifecycleStatus === "PLANNED" && <Button size="icon-sm" variant="ghost" className="text-destructive" title="Delete milestone" aria-label={"Delete " + milestone.title} disabled={remove.isPending}
                onClick={() => { remove.reset(); setPendingDelete(milestone); }}><Trash2 className="size-4" /></Button>}
              <Button size="icon-sm" variant="ghost" title="View milestone" aria-label={"View " + milestone.title} onClick={() => openDetail(milestone.id)}><Eye className="size-4" /></Button>
              {isStudent && !readOnly && ["IN_PROGRESS", "CHANGES_REQUESTED"].includes(milestone.lifecycleStatus) && <Button size="icon-sm" variant="ghost" title="Prepare and submit artifact" aria-label={"Submit artifact for " + milestone.title}
                onClick={() => navigate("/teams/" + teamId + "/milestones/" + milestone.id + "/submit?workspaceId=" + workspaceId)}><Upload className="size-4" /></Button>}
              {isStudent ? <Button asChild size="icon-sm" variant="secondary" title="View my submissions"><Link aria-label={"View my submissions for " + milestone.title}
                to={"/student/teams/" + teamId + "/milestones/" + milestone.id + "/submissions?workspaceId=" + workspaceId}><ClipboardCheck className="size-4" /></Link></Button>
                : canReview ? <Button size="icon-sm" variant="secondary" className="relative" title="Review submissions" aria-label={"Review submissions for " + milestone.title + " (" + (submissionCounts.get(milestone.id) ?? 0) + ")"}
                  onClick={() => navigate("/teams/" + teamId + "/milestones/" + milestone.id + "/submissions?workspaceId=" + workspaceId)}><ClipboardCheck className="size-4" />
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-background px-1 text-[10px] leading-4 text-foreground ring-1 ring-border">{submissionCounts.get(milestone.id) ?? 0}</span></Button> : null}
            </div>
          </div>;
        })}
      </div> : null}
      {response && total > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
        <p>Showing <span className="font-medium text-foreground">{first}–{last}</span> of <span className="font-medium text-foreground">{total}</span> milestones</p>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="ms-page-size" className="sr-only">Milestones per page</Label>
          <Select value={String(list.size)} onValueChange={(value) => updateList({ size: Number(value) as WorkspaceMilestoneListState["size"], page: 0 })}>
            <SelectTrigger id="ms-page-size" className="h-8 w-[95px]" aria-label="Milestones per page"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="10">10 / page</SelectItem><SelectItem value="20">20 / page</SelectItem><SelectItem value="50">50 / page</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" size="sm" disabled={pageIndex <= 0 || navigationDisabled} onClick={() => updateList({ page: pageIndex - 1 })}><ChevronLeft className="size-4" /> Previous</Button>
          {visiblePages.map((page) => <Button key={page} size="sm" variant={page === pageIndex ? "default" : "outline"} className="min-w-8 px-2" aria-label={"Page " + (page + 1)}
            aria-current={page === pageIndex ? "page" : undefined} disabled={navigationDisabled} onClick={() => updateList({ page })}>{page + 1}</Button>)}
          <Button variant="outline" size="sm" disabled={pageIndex >= totalPages - 1 || navigationDisabled} onClick={() => updateList({ page: pageIndex + 1 })}>Next <ChevronRight className="size-4" /></Button>
        </div>
      </div>}
    </Card>
    <ConfirmDialog open={pendingDelete !== null} title="Delete milestone?"
      description={<div className="space-y-2"><p><strong>{pendingDelete?.title}</strong> will be removed from this workspace.</p>
        {remove.isError && <p className="text-destructive">{getMilestoneApiError(remove.error).message}</p>}</div>}
      confirmLabel="Delete milestone" loading={remove.isPending}
      onCancel={() => { if (!remove.isPending) setPendingDelete(null); }}
      onConfirm={() => { if (pendingDelete) remove.mutate({ id: pendingDelete.id, version: pendingDelete.version }); }} />
  </section>;
}
