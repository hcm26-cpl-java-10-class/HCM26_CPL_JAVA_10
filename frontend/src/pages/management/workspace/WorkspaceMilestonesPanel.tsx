import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle, ChevronDown, ClipboardCheck, Eye, MoreHorizontal, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, Upload, X,
} from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { getMilestoneApiError } from "@/pages/management/project/milestone/milestone.utils";
import { milestoneStatusStyles } from "@/pages/management/project/milestone/milestone-status.styles";
import type { MilestoneLifecycleStatus, MilestoneListItem } from "@/types";
import type { WorkspaceSectionAccess } from "@/types/features/workspace";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import { WorkspaceStatusBadge } from "./workspace.shared";
import { describeDeadline, isActiveMilestone } from "./workspace-milestone-deadline";
import {
  countWorkspaceMilestoneFilters, hasWorkspaceMilestoneQuery, parseWorkspaceMilestoneList,
  writeWorkspaceMilestoneList, type WorkspaceMilestoneGroup, type WorkspaceMilestoneListState,
} from "./workspace-milestone-list-query";
import { WorkspaceMilestoneRow } from "./WorkspaceMilestoneRow";

/** The list API caps page size at 100; teams normally have far fewer milestones. */
const FETCH_LIMIT = 100;
const PAGE_STEP = 20;

const GROUPS: Array<{ value: WorkspaceMilestoneGroup; label: string }> = [
  { value: "attention", label: "Needs attention" },
  { value: "active", label: "Active" },
  { value: "review", label: "In review" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
];
const STATUS_OPTIONS: MilestoneLifecycleStatus[] = ["PLANNED", "IN_PROGRESS", "SUBMITTED", "CHANGES_REQUESTED", "ACCEPTED", "REJECTED"];
const SORT_OPTIONS = [
  { value: "smart", label: "Smart (needs attention first)" },
  { value: "deadline:asc", label: "Deadline: earliest" },
  { value: "deadline:desc", label: "Deadline: latest" },
  { value: "title:asc", label: "Name: A–Z" },
  { value: "title:desc", label: "Name: Z–A" },
  { value: "createdAt:desc", label: "Newest created" },
] as const;

type Section = "attention" | "upcoming" | "done";
const SECTION_LABEL: Record<Section, string> = { attention: "Needs attention", upcoming: "Upcoming", done: "Done" };

const time = (value: string) => new Date(value).getTime();
const localDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

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
    const timer = window.setTimeout(() => onSearch(normalized), 200);
    return () => window.clearTimeout(timer);
  }, [initial, onSearch, text]);
  return <div className="relative w-full sm:w-56">
    <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input value={text} onChange={(event) => setText(event.target.value)} maxLength={120}
      className="h-8 w-full pl-8 pr-8 text-sm" aria-label="Search milestones" placeholder="Search…" />
    {text && <button type="button" aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      onClick={() => { setText(""); onSearch(""); }}><X className="size-4" /></button>}
  </div>;
}

export function WorkspaceMilestonesPanel({ projectId, teamId, workspaceId, access, projectScoped = false, readOnly = false, title = "Milestones", projectStatus }: {
  projectId?: number | null; teamId: number; workspaceId: number; access: WorkspaceSectionAccess;
  projectScoped?: boolean; readOnly?: boolean; title?: string; projectStatus?: string;
}) {
  const [pendingDelete, setPendingDelete] = useState<MilestoneListItem | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const serializedParams = searchParams.toString();
  const list = useMemo(() => parseWorkspaceMilestoneList(new URLSearchParams(serializedParams)), [serializedParams]);
  const [visible, setVisible] = useState(PAGE_STEP);
  const [doneOpen, setDoneOpen] = useState(false);
  const [mountedAt] = useState(() => Date.now());
  const { activeRole } = usePermissions();
  const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;
  const canManage = !isStudent && !readOnly && !!access.actions.create;
  const canReview = !isStudent && !!access.actions.review;
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  const updateList = useCallback((patch: Partial<WorkspaceMilestoneListState>) => {
    setVisible(PAGE_STEP);
    setSearchParams((current) => writeWorkspaceMilestoneList(current, {
      ...parseWorkspaceMilestoneList(current), ...patch,
    }), { replace: true });
  }, [setSearchParams]);
  const updateSearch = useCallback((value: string) => updateList({ search: value }), [updateList]);

  // One request for everything: filtering, grouping, sorting and counts all happen client-side.
  const query = useQuery({
    queryKey: ["workspace-milestones", projectId, teamId, projectScoped, "all"],
    queryFn: () => {
      const options = { page: 0, size: FETCH_LIMIT, sort: "deadline:asc" };
      return projectScoped && projectId
        ? milestoneApi.getList(String(projectId), { ...options, teamId })
        : milestoneApi.getTeamList(teamId, options);
    },
    retry: false, refetchInterval: 30_000,
  });
  const reviewQuery = useQuery({
    queryKey: ["team-artifact-submissions", teamId],
    queryFn: () => milestoneApi.getTeamArtifactSubmissions(teamId),
    retry: false, refetchInterval: 20_000, enabled: canReview,
  });
  const submissionCounts = useMemo(() => {
    const counts = new Map<string, { total: number; pending: number }>();
    reviewQuery.data?.forEach(({ submission }) => {
      const current = counts.get(submission.milestoneId) ?? { total: 0, pending: 0 };
      counts.set(submission.milestoneId, { total: current.total + 1, pending: current.pending + (submission.status === "SUBMITTED" ? 1 : 0) });
    });
    return counts;
  }, [reviewQuery.data]);

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
  const openDetail = (id: string) => navigate("/teams/" + teamId + "/milestones/" + id + "?workspaceId=" + workspaceId, { state: { returnTo } });
  const edit = (milestone: MilestoneListItem) => navigate(
    milestone.lifecycleStatus === "PLANNED" && projectId
      ? "/projects/" + projectId + "/milestones/" + milestone.id + "/edit?teamId=" + teamId + "&scope=team&workspaceId=" + workspaceId
      : "/teams/" + teamId + "/milestones/" + milestone.id + "/edit?workspaceId=" + workspaceId,
    { state: { returnTo } },
  );
  const submitUrl = (id: string) => "/teams/" + teamId + "/milestones/" + id + "/submit?workspaceId=" + workspaceId;
  const submissionsUrl = (id: string) => (isStudent ? "/student" : "") + "/teams/" + teamId + "/milestones/" + id + "/submissions?workspaceId=" + workspaceId;
  const clearQuery = () => updateList({ search: "", status: "ALL", mandatory: "ALL", latePolicy: "ALL", from: "", to: "" });

  const all = useMemo(() => query.data?.content ?? [], [query.data]);
  const truncated = (query.data?.totalElements ?? 0) > all.length;
  const now = query.dataUpdatedAt || mountedAt;

  const derived = useMemo(() => {
    const needsAttention = (item: MilestoneListItem) => {
      const tone = describeDeadline(item.deadline, item.lifecycleStatus, now, item.lateUntil).tone;
      return tone === "overdue" || tone === "late-window" || item.lifecycleStatus === "CHANGES_REQUESTED"
        || (canReview && item.lifecycleStatus === "SUBMITTED" && (submissionCounts.get(item.id)?.pending ?? 0) > 0);
    };
    const inGroup = (item: MilestoneListItem, group: WorkspaceMilestoneGroup) => {
      switch (group) {
        case "attention": return needsAttention(item);
        case "active": return isActiveMilestone(item.lifecycleStatus);
        case "review": return item.lifecycleStatus === "SUBMITTED";
        case "done": return item.lifecycleStatus === "ACCEPTED" || item.lifecycleStatus === "REJECTED";
        default: return true;
      }
    };
    const term = list.search.toLowerCase();
    const filtered = all.filter((item) => {
      if (term && !item.title.toLowerCase().includes(term) && !(item.description ?? "").toLowerCase().includes(term)) return false;
      if (list.mandatory !== "ALL" && String(item.mandatory) !== list.mandatory) return false;
      if (list.latePolicy !== "ALL" && item.latePolicyType !== list.latePolicy) return false;
      const day = localDate(item.deadline);
      if (list.from && day < list.from) return false;
      if (list.to && day > list.to) return false;
      return true;
    });
    const counts = Object.fromEntries(GROUPS.map(({ value }) => [value, filtered.filter((item) => inGroup(item, value)).length])) as Record<WorkspaceMilestoneGroup, number>;
    const group: WorkspaceMilestoneGroup = list.group ?? (counts.attention ? "attention" : counts.active ? "active" : "all");
    const shown = filtered.filter((item) => list.status !== "ALL" ? item.lifecycleStatus === list.status : inGroup(item, group));

    const byDeadline = (a: MilestoneListItem, b: MilestoneListItem) => time(a.deadline) - time(b.deadline);
    let sections: Array<{ key: Section | "flat"; items: MilestoneListItem[] }>;
    if (list.sort === "smart") {
      const bucket = (item: MilestoneListItem): Section =>
        needsAttention(item) ? "attention" : item.lifecycleStatus === "ACCEPTED" || item.lifecycleStatus === "REJECTED" ? "done" : "upcoming";
      sections = (["attention", "upcoming", "done"] as Section[]).map((key) => ({
        key,
        items: shown.filter((item) => bucket(item) === key).sort(key === "done" ? (a, b) => byDeadline(b, a) : byDeadline),
      })).filter((section) => section.items.length > 0);
    } else {
      const [field, direction] = list.sort.split(":") as ["deadline" | "title" | "createdAt", "asc" | "desc"];
      const sign = direction === "desc" ? -1 : 1;
      const sorted = [...shown].sort((a, b) => sign * (field === "title" ? a.title.localeCompare(b.title)
        : field === "createdAt" ? time(a.createdAt) - time(b.createdAt) : byDeadline(a, b)));
      sections = [{ key: "flat", items: sorted }];
    }
    const overdue = all.filter((item) => describeDeadline(item.deadline, item.lifecycleStatus, now, item.lateUntil).tone === "overdue").length;
    const next = all.filter((item) => (isActiveMilestone(item.lifecycleStatus) || item.lifecycleStatus === "PLANNED") && time(item.deadline) >= now).sort(byDeadline)[0];
    return { counts, group, shown, sections, overdue, next };
  }, [all, canReview, list, now, submissionCounts]);

  const filterCount = countWorkspaceMilestoneFilters(list);
  const invalidDateRange = !!list.from && !!list.to && list.from > list.to;
  const activeChips = [
    list.status !== "ALL" ? { key: "status", label: milestoneStatusStyles[list.status].label, clear: { status: "ALL" as const } } : null,
    list.mandatory !== "ALL" ? { key: "mandatory", label: list.mandatory === "true" ? "Mandatory" : "Optional", clear: { mandatory: "ALL" as const } } : null,
    list.latePolicy !== "ALL" ? { key: "late", label: list.latePolicy === "ALLOW_LATE" ? "Late allowed" : "No late", clear: { latePolicy: "ALL" as const } } : null,
    list.from || list.to ? { key: "range", label: `Deadline ${list.from || "…"} → ${list.to || "…"}`, clear: { from: "", to: "" } } : null,
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null);

  const renderRow = (milestone: MilestoneListItem) => {
    const counts = submissionCounts.get(milestone.id);
    const active = isActiveMilestone(milestone.lifecycleStatus);
    const canEdit = canManage && ["PLANNED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(milestone.lifecycleStatus);
    const canDelete = canManage && milestone.lifecycleStatus === "PLANNED";
    const studentCanSubmit = isStudent && !readOnly && active;
    const primaryAction = studentCanSubmit
      ? <Button size="sm" onClick={() => navigate(submitUrl(milestone.id))}><Upload className="size-4" /> {milestone.lifecycleStatus === "CHANGES_REQUESTED" ? "Resubmit" : "Submit"}</Button>
      : isStudent
        ? <Button size="sm" variant="outline" asChild><Link to={submissionsUrl(milestone.id)}><ClipboardCheck className="size-4" /> My submissions</Link></Button>
        : canReview
          ? <Button size="sm" variant={counts?.pending ? "default" : "outline"} onClick={() => navigate(submissionsUrl(milestone.id))}
              title={counts ? `${counts.pending} awaiting review · ${counts.total} total` : "No submissions yet"}>
              <ClipboardCheck className="size-4" /> Review
              {counts?.pending ? <span className="rounded-full bg-background/20 px-1.5 text-[11px] leading-4">{counts.pending}</span> : null}
            </Button>
          : null;
    return <WorkspaceMilestoneRow key={milestone.id}
      title={milestone.title} description={milestone.description} status={milestone.lifecycleStatus}
      deadline={describeDeadline(milestone.deadline, milestone.lifecycleStatus, now, milestone.lateUntil)}
      onOpen={() => openDetail(milestone.id)}
      badges={milestone.mandatory ? <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">Mandatory</Badge> : null}
      primaryAction={primaryAction}
      menu={<DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={"More actions for " + milestone.title}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openDetail(milestone.id)}><Eye className="size-4" /> View details</DropdownMenuItem>
          {studentCanSubmit && <DropdownMenuItem onSelect={() => navigate(submissionsUrl(milestone.id))}><ClipboardCheck className="size-4" /> My submissions</DropdownMenuItem>}
          {canEdit && <DropdownMenuItem onSelect={() => edit(milestone)}><Pencil className="size-4" /> {milestone.lifecycleStatus === "CHANGES_REQUESTED" ? "Extend deadline" : "Edit"}</DropdownMenuItem>}
          {canDelete && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" disabled={remove.isPending}
            onSelect={() => { remove.reset(); setPendingDelete(milestone); }}><Trash2 className="size-4" /> Delete</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>} />;
  };

  // Progressive rendering across sections ("Show more"); a collapsed Done section does not use the budget.
  const renderedSections = derived.sections.reduce<{ budget: number; result: Array<{ key: Section | "flat"; total: number; collapsible: boolean; open: boolean; items: MilestoneListItem[] }> }>(
    (acc, section) => {
      const collapsible = section.key === "done" && derived.sections.length > 1;
      const open = !collapsible || doneOpen;
      const items = open ? section.items.slice(0, Math.max(0, acc.budget)) : [];
      return {
        budget: acc.budget - items.length,
        result: [...acc.result, { key: section.key, total: section.items.length, collapsible, open, items }],
      };
    },
    { budget: visible, result: [] },
  ).result;
  const remaining = renderedSections.reduce((sum, section) => sum + (section.open ? section.total - section.items.length : 0), 0);
  const showHeaders = list.sort === "smart" && renderedSections.length > 1;
  const groupLabel = GROUPS.find((item) => item.value === derived.group)?.label;

  return <section className="min-w-0 space-y-3" aria-label="Workspace milestones">
    {/* Header + one-line summary */}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-words text-xl font-semibold tracking-tight">{title}</h2>
          {projectStatus && <WorkspaceStatusBadge status={projectStatus} colored />}
        </div>
        {query.data ? <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          <span>{all.length}{truncated ? "+" : ""} milestone{all.length === 1 ? "" : "s"}</span>
          {derived.overdue > 0 && <><span aria-hidden>·</span><span className="font-medium text-red-700 dark:text-red-400">{derived.overdue} overdue</span></>}
          {derived.next && <><span aria-hidden>·</span><span>Next: <button type="button" className="font-medium text-foreground hover:underline" onClick={() => openDetail(derived.next!.id)}>{derived.next.title}</button> — {describeDeadline(derived.next.deadline, derived.next.lifecycleStatus, now).relative}</span></>}
        </p> : null}
      </div>
      {canManage && <Button size="sm" className="shrink-0" onClick={create}><Plus className="size-4" /> Create milestone</Button>}
    </div>

    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      {/* Single toolbar row: group tabs · search · view menu */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="-mx-1 flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-1" role="tablist" aria-label="Milestone groups">
          {GROUPS.map((item) => {
            const selected = list.status === "ALL" && derived.group === item.value;
            return <button key={item.value} type="button" role="tab" aria-selected={selected}
              onClick={() => updateList({ group: item.value, status: "ALL" })}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
                selected ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")}>
              {item.label}
              <span className={cn("rounded-full px-1.5 text-[11px] leading-4",
                item.value === "attention" && derived.counts.attention ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-muted-foreground/10")}>{derived.counts[item.value]}</span>
            </button>;
          })}
        </div>
        <MilestoneSearch initial={list.search} onSearch={updateSearch} />
        <Popover>
          <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-8"><SlidersHorizontal className="size-4" /> View
            {filterCount > 0 && <Badge variant="secondary" className="ml-0.5 px-1.5 py-0">{filterCount}</Badge>}
          </Button></PopoverTrigger>
          <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] space-y-3">
            <div className="space-y-1.5"><Label htmlFor="ms-sort">Sort by</Label>
              <Select value={list.sort} onValueChange={(value) => updateList({ sort: value as WorkspaceMilestoneListState["sort"] })}>
                <SelectTrigger id="ms-sort" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{SORT_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="ms-status">Exact status</Label>
              <Select value={list.status} onValueChange={(value) => updateList({ status: value as WorkspaceMilestoneListState["status"] })}>
                <SelectTrigger id="ms-status" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ALL">Use group tabs</SelectItem>{STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status}>{milestoneStatusStyles[status].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label htmlFor="ms-mandatory">Requirement</Label>
                <Select value={list.mandatory} onValueChange={(value) => updateList({ mandatory: value as WorkspaceMilestoneListState["mandatory"] })}>
                  <SelectTrigger id="ms-mandatory" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ALL">Any</SelectItem><SelectItem value="true">Mandatory</SelectItem><SelectItem value="false">Optional</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="ms-late-policy">Late submissions</Label>
                <Select value={list.latePolicy} onValueChange={(value) => updateList({ latePolicy: value as WorkspaceMilestoneListState["latePolicy"] })}>
                  <SelectTrigger id="ms-late-policy" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="ALL">Any</SelectItem><SelectItem value="NO_LATE">Not allowed</SelectItem><SelectItem value="ALLOW_LATE">Allowed</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label htmlFor="ms-from">Deadline from</Label><Input id="ms-from" type="date" value={list.from} onChange={(event) => updateList({ from: event.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="ms-to">Deadline to</Label><Input id="ms-to" type="date" value={list.to} onChange={(event) => updateList({ to: event.target.value })} /></div>
            </div>
            {invalidDateRange ? <p role="alert" className="text-xs text-destructive">Deadline from must be on or before deadline to.</p>
              : <p className="text-xs text-muted-foreground">Dates use your device time zone.</p>}
            <div className="flex justify-end border-t pt-2">
              <Button variant="ghost" size="sm" disabled={!filterCount && list.sort === "smart"}
                onClick={() => updateList({ sort: "smart", status: "ALL", mandatory: "ALL", latePolicy: "ALL", from: "", to: "" })}>Reset view</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {activeChips.length > 0 && <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-1.5">
        {activeChips.map((chip) => <Badge key={chip.key} variant="secondary" className="gap-1 pr-1 font-normal">{chip.label}
          <button type="button" aria-label={"Remove filter " + chip.label} className="rounded-full p-0.5 hover:bg-background" onClick={() => updateList(chip.clear)}><X className="size-3" /></button></Badge>)}
        <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={clearQuery}>Clear all</Button>
      </div>}

      {query.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
        <span className="inline-flex items-center gap-2"><AlertCircle className="size-4" />{getMilestoneApiError(query.error).message || "Unable to load milestones."}</span>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}><RefreshCw className="size-4" /> Retry</Button>
      </div>}
      {truncated && <p className="border-b bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        Showing the first {FETCH_LIMIT} milestones by deadline. Use search or filters to narrow the list.
      </p>}

      {query.isPending ? <div className="space-y-2 p-3" role="status" aria-label="Loading milestones">
        {[0, 1, 2].map((index) => <Skeleton key={index} className="h-14 w-full" />)}
      </div> : query.isError ? null : derived.shown.length === 0 ? <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <ClipboardCheck className="size-7 text-muted-foreground" />
        <p className="font-medium">{all.length === 0 ? "No milestones yet" : hasWorkspaceMilestoneQuery(list) ? "No matching milestones" : `Nothing in “${groupLabel}”`}</p>
        <p className="text-sm text-muted-foreground">{all.length === 0 ? "Milestones will appear here when they are created for this workspace."
          : hasWorkspaceMilestoneQuery(list) ? "Try another search term or clear the filters." : "Switch to another group to see more milestones."}</p>
        {all.length === 0 ? (canManage && <Button size="sm" onClick={create}><Plus className="size-4" /> Create the first milestone</Button>)
          : hasWorkspaceMilestoneQuery(list) ? <Button variant="outline" size="sm" onClick={clearQuery}>Clear search and filters</Button>
            : derived.group !== "all" ? <Button variant="outline" size="sm" onClick={() => updateList({ group: "all" })}>Show all milestones</Button> : null}
      </div> : <div>
        {renderedSections.map((section) => <div key={section.key}>
          {showHeaders && (section.collapsible
            ? <button type="button" aria-expanded={section.open} onClick={() => setDoneOpen((open) => !open)}
                className="flex w-full items-center gap-1.5 border-b bg-muted/30 px-4 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn("size-3.5 transition-transform", !section.open && "-rotate-90")} />
                {SECTION_LABEL[section.key as Section]} ({section.total})
              </button>
            : <div className={cn("border-b bg-muted/30 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide",
                section.key === "attention" ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
                {SECTION_LABEL[section.key as Section]} ({section.total})
              </div>)}
          {section.items.map(renderRow)}
        </div>)}
        {remaining > 0 && <div className="border-t px-4 py-2 text-center">
          <Button variant="ghost" size="sm" onClick={() => setVisible((count) => count + PAGE_STEP)}>Show more ({remaining})</Button>
        </div>}
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
