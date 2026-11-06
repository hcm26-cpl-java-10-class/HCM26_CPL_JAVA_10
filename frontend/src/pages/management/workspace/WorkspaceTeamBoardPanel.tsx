import { refreshBacklogItem } from "@/lib/refresh-backlog-item";
import { workItemAssigneeLabel, workItemAssigneeOptions } from "@/lib/work-item-assignee";
import { teamBacklogApi } from "@/api/features/team-backlog.api";
import { sprintBacklogApi } from "@/api/features/sprint_backlog.api";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { SprintBacklogDTO, SprintBacklogStatus, SprintDTO } from "@/types";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Check, ChevronLeft, ChevronRight, Circle, CircleDot, Clock3, History, LayoutGrid, List, Plus, RefreshCw, Search, UserRound } from "lucide-react";
import { BacklogItemDetailSheet } from "@/pages/management/backlog/components/BacklogItemDetailSheet";
import type { BacklogPriority, SprintBacklogWorkType, SprintPlanningItem } from "@/types";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import axios from "axios";

type BoardColumnKey = SprintBacklogStatus;
const allowedStatusTransitions: Record<SprintBacklogStatus, SprintBacklogStatus[]> = {
  // Keep the UI options identical to SprintBacklogServiceImpl's transition
  // matrix so the board never offers a change that the API will reject.
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["TODO", "REVIEW"],
  REVIEW: ["IN_PROGRESS", "DONE"],
  DONE: ["REVIEW"],
};
export interface BoardColumnConfig {
  key: BoardColumnKey;
  label: string;
  icon: typeof Circle;
  color: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: BoardColumnConfig[] = [
  { key: "TODO", label: "To do", icon: Circle, color: "bg-sky-500", visible: true },
  { key: "IN_PROGRESS", label: "In progress", icon: CircleDot, color: "bg-violet-500", visible: true },
  { key: "REVIEW", label: "Review", icon: Clock3, color: "bg-amber-500", visible: true },
  { key: "DONE", label: "Done", icon: Check, color: "bg-emerald-500", visible: true },
];

function preferredSprint(sprints: SprintDTO[]): SprintDTO | undefined {
  return sprints.find((sprint) => sprint.status === "ACTIVE")
    ?? sprints.find((sprint) => sprint.status === "PLANNED")
    ?? sprints[0];
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function priorityStyle(priority?: string | null) {
  switch (priority) {
    case "LOW": return "border-slate-200 bg-slate-100 text-slate-700";
    case "MEDIUM": return "border-sky-200 bg-sky-50 text-sky-700";
    case "HIGH": return "border-amber-200 bg-amber-50 text-amber-800";
    case "URGENT": return "border-rose-200 bg-rose-50 text-rose-700";
    default: return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function workTypeStyle(workType?: string | null) {
  switch (workType) {
    case "BUG": return "border-rose-200 bg-rose-50 text-rose-700";
    case "STORY": return "border-indigo-200 bg-indigo-50 text-indigo-700";
    default: return "border-slate-200 bg-white text-slate-600";
  }
}

function workTypeLabel(workType?: string | null) {
  return workType === "STORY" ? "Story" : workType === "BUG" ? "Bug" : workType === "TASK" ? "Task" : workType;
}

function priorityLabel(priority?: string | null) {
  switch (priority) {
    case "LOW": return "Low";
    case "MEDIUM": return "Medium";
    case "HIGH": return "High";
    case "URGENT": return "Urgent";
    default: return priority;
  }
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "TODO": return "To do";
    case "IN_PROGRESS": return "In progress";
    case "REVIEW": return "Review";
    case "DONE": return "Done";
    default: return status ?? "—";
  }
}

function auditValueLabel(key: string, value: unknown) {
  if (key === "status" && typeof value === "string") return statusLabel(value);
  if (key === "priority" && typeof value === "string") return priorityLabel(value);
  if (key === "assigneeProjectMemberId") return value == null ? "Unassigned" : `Member #${String(value)}`;
  if (key === "sprintId") return value == null ? "Backlog" : `Sprint #${String(value)}`;
  if (key === "estimatedHours") return value == null ? "—" : `${String(value)}h`;
  return value == null ? "—" : String(value);
}

function parseAuditState(state?: string | null): Record<string, unknown> | undefined {
  if (!state) return undefined;
  try {
    const parsed: unknown = JSON.parse(state);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

const auditFieldLabels: Record<string, string> = {
  status: "Status",
  priority: "Priority",
  assigneeProjectMemberId: "Assignee",
  sprintId: "Sprint",
  title: "Title",
  estimatedHours: "Estimate",
};

function auditSummary(action: string, beforeState?: string | null, afterState?: string | null, maxChanges = 3) {
  const before = parseAuditState(beforeState);
  const after = parseAuditState(afterState);
  const actionLabel = action === "CREATE" ? "created the work item"
    : action === "DELETE" ? "deleted the work item" : "updated the work item";

  if (!before && after) return { actionLabel, changes: [`Created: ${String(after.title ?? "Work item")}`] };
  if (before && after) {
    const changes = Object.entries(auditFieldLabels).flatMap(([key, label]) => {
      const oldValue = before[key];
      const newValue = after[key];
      if (oldValue === newValue || (oldValue == null && newValue == null)) return [];
      return [`${label}: ${auditValueLabel(key, oldValue)} → ${auditValueLabel(key, newValue)}`];
    });
    return { actionLabel, changes: changes.length ? changes.slice(0, maxChanges) : ["Changes saved"] };
  }
  return { actionLabel, changes: [] as string[] };
}

export function WorkspaceTeamBoardPanel({ workspaceId, teamId, projectId, readOnly = false, canUpdate, canMove, canDelete, onCreateWorkItem }: { workspaceId: number; teamId: number; projectId?: number | null; readOnly?: boolean; canUpdate: boolean; canMove: boolean; canDelete: boolean; onCreateWorkItem?: () => void }) {
  const queryClient = useQueryClient();
  const [requestedSprintId, setSprintId] = useState<number>();
  const [memberFilter, setMemberFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "priority" | "status">("title");
  const [listPage, setListPage] = useState(0);
  const [draggedItem, setDraggedItem] = useState<SprintBacklogDTO | null>(null);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<SprintPlanningItem | null>(null);
  const [historyItem, setHistoryItem] = useState<{ id: number; title: string } | null>(null);
  const [historyTeamId, setHistoryTeamId] = useState(teamId);
  if (historyTeamId !== teamId) {
    setHistoryTeamId(teamId);
    setHistoryItem(null);
  }
  const historyQuery = useQuery({
    queryKey: ["sprint-backlog-audit", historyItem?.id],
    queryFn: () => sprintBacklogApi.getAuditLogs(historyItem!.id),
    enabled: historyItem !== null,
    staleTime: 0,
    retry: false,
  });
  const milestonesQuery = useQuery({
    queryKey: ["backlog-milestone-options", teamId],
    queryFn: () => milestoneApi.getBacklogOptions(teamId),
    enabled: detailItem !== null && teamId > 0,
    retry: false,
  });
  const visibleColumns = DEFAULT_COLUMNS;
  const transitionOptions = (status: SprintBacklogStatus) => allowedStatusTransitions[status] ?? [];
  const query = useQuery({
    queryKey: ["team-backlog-board", teamId, projectId, workspaceId],
    queryFn: () => teamBacklogApi.getBoard(teamId, projectId, workspaceId),
    retry: false,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const sprints = useMemo(() => query.data?.sprints ?? [], [query.data?.sprints]);
  const sprintId = sprints.some((sprint) => sprint.id === requestedSprintId)
    ? requestedSprintId : preferredSprint(sprints)?.id;

  const selectedSprint = sprints.find((sprint) => sprint.id === sprintId);
  const allItems = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const boardItems = useMemo(() => allItems.filter((item) =>
    item.sprintId === sprintId || item.sprintId == null,
  ), [allItems, sprintId]);
  const allSprintItems = allItems.filter((item) => item.sprintId === sprintId);
  const memberIds = useMemo(() => [...new Set([
    ...(query.data?.members ?? []).map((member) => member.projectMemberId),
    ...boardItems.map((item) => item.assigneeProjectMemberId).filter((id): id is number => id != null),
  ])].sort((a, b) => a - b), [boardItems, query.data?.members]);
  const visibleItems = useMemo(() => boardItems.filter((item) =>
    memberFilter === "ALL" || (memberFilter === "UNASSIGNED"
      ? item.assigneeProjectMemberId == null
      : item.assigneeProjectMemberId === Number(memberFilter)),
  ), [boardItems, memberFilter]);
  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase();
    const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return visibleItems
      .filter((item) => !normalizedSearch || [item.title, item.description, item.milestoneName]
        .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch)))
      .filter((item) => viewMode !== "list" || statusFilter === "ALL" || item.status === statusFilter)
      .filter((item) => viewMode !== "list" || priorityFilter === "ALL" || item.priority === priorityFilter)
      .sort((left, right) => {
        if (sortBy === "priority") return (priorityOrder[left.priority ?? ""] ?? 4) - (priorityOrder[right.priority ?? ""] ?? 4);
        if (sortBy === "status") return (left.status ?? "").localeCompare(right.status ?? "");
        return (left.title ?? "").localeCompare(right.title ?? "", "vi");
      });
  }, [visibleItems, searchTerm, sortBy, statusFilter, priorityFilter, viewMode]);
  const sprintItems = filteredItems.filter((item) => item.sprintId === sprintId);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const listItems = filteredItems.slice(listPage * pageSize, (listPage + 1) * pageSize);
  const doneCount = allSprintItems.filter((item) => item.status === "DONE").length;
  const completion = allSprintItems.length ? Math.round((doneCount / allSprintItems.length) * 100) : 0;
  const auditQueries = useQueries({ queries: allSprintItems.filter((item): item is SprintBacklogDTO & { id: number } => item.id != null).slice(0, 25).map((item) => ({
    queryKey: ["sprint-backlog-audit", item.id],
    queryFn: () => sprintBacklogApi.getAuditLogs(item.id),
    staleTime: 30_000,
    retry: false,
  })) });
  const itemTitleById = new Map(allSprintItems.filter((item) => item.id != null).map((item) => [item.id!, item.title ?? "Work item"]));
  const activity = auditQueries.flatMap((result) =>
    (result.data ?? []).map((entry) => ({ ...entry, itemTitle: itemTitleById.get(entry.sprintBacklogId) ?? "Work item" })),
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  const moveItem = async (item: SprintBacklogDTO, target: BoardColumnKey) => {
    if (!canUpdate || savingItemId != null || item.id == null) return;

    const currentStatus = (item.status ?? "TODO") as SprintBacklogStatus;
    if (target === currentStatus) return;

    const allowed = transitionOptions(currentStatus);
    if (!allowed.includes(target)) {
      const nextStatuses = allowed.map(statusLabel).join(", ") || "none";
      toast.error(
        `Cannot move from ${statusLabel(currentStatus)} to ${statusLabel(target)}. ` +
        `Allowed next statuses: ${nextStatuses}.`,
      );
      setDraggedItem(null);
      return;
    }

    try {
      setSavingItemId(item.id);
      await sprintBacklogApi.update(String(item.id), { status: target } as SprintBacklogDTO);
      await query.refetch();
      await queryClient.invalidateQueries({ queryKey: ["sprint-backlog-audit"] });
      toast.success("Work item updated on the board.");
    } catch (error) {
      const msg =
        axios.isAxiosError(error) &&
        typeof (error.response?.data as Record<string, unknown>)?.message === "string"
          ? (error.response!.data as Record<string, string>).message
          : "Could not update the work item. Your existing data has been preserved.";
      toast.error(msg);
    } finally {
      setSavingItemId(null);
      setDraggedItem(null);
    }
  };

  const updateStatus = async (item: SprintBacklogDTO, target: SprintBacklogStatus) => {
    if (!canUpdate || item.id == null || item.sprintId == null || savingItemId != null) return;
    const current = (item.status ?? "TODO") as SprintBacklogStatus;
    if (current === target) return;

    // Validate transition before calling API.
    const allowed = transitionOptions(current);
    if (!allowed.includes(target)) {
      const nextStatuses = allowed.map(statusLabel).join(", ") || "none";
      toast.error(
        `Cannot move from ${statusLabel(current)} to ${statusLabel(target)}. ` +
        `Allowed next statuses: ${nextStatuses}.`,
      );
      return;
    }

    try {
      setSavingItemId(item.id);
      await sprintBacklogApi.update(String(item.id), { status: target } as SprintBacklogDTO);
      await query.refetch();
      await queryClient.invalidateQueries({ queryKey: ["sprint-backlog-audit"] });
      toast.success("\u0110\u00e3 c\u1eadp nh\u1eadt tr\u1ea1ng th\u00e1i work item.");
    } catch (error) {
      const msg =
        axios.isAxiosError(error) &&
        typeof (error.response?.data as Record<string, unknown>)?.message === "string"
          ? (error.response!.data as Record<string, string>).message
          : "Kh\u00f4ng c\u1eadp nh\u1eadt \u0111\u01b0\u1ee3c tr\u1ea1ng th\u00e1i. D\u1eef li\u1ec7u hi\u1ec7n t\u1ea1i v\u1eabn \u0111\u01b0\u1ee3c gi\u1eef nguy\u00ean.";
      toast.error(msg);
    } finally {
      setSavingItemId(null);
    }
  };
  const assignItem = async (item: SprintBacklogDTO, value: string) => {
    if (!canUpdate || item.id == null || savingItemId != null) return;
    try {
      setSavingItemId(item.id);
      const saved = await teamBacklogApi.assign(teamId, item.id, value ? Number(value) : null);
      await refreshBacklogItem(queryClient, saved);
      toast.success("Assignee updated.");
    } catch {
      toast.error("Could not update assignee. Existing assignment is unchanged.");
    } finally {
      setSavingItemId(null);
    }
  };

  const openItemDetails = (item: SprintBacklogDTO) => {
    if (item.id == null) return;
    setDetailItem({
      id: item.id,
      title: item.title ?? "",
      description: item.description ?? null,
      status: item.status ?? "TODO",
      priority: (item.priority as BacklogPriority) ?? "MEDIUM",
      workType: (item.workType as SprintBacklogWorkType) ?? "TASK",
      sprintId: item.sprintId ?? null,
      projectId: item.projectId ?? null,
      milestoneId: item.milestoneId ?? null,
      milestoneName: item.milestoneName ?? null,
      assigneeProjectMemberId: item.assigneeProjectMemberId ?? null,
      assigneeDisplayName: workItemAssigneeLabel(item, query.data?.members ?? []),
      startDate: item.startDate ?? null,
      endDate: item.endDate ?? null,
      estimatedHours: item.estimatedHours ?? null,
    });
  };

  const filterKey = JSON.stringify([teamId, sprintId, memberFilter, searchTerm, sortBy, statusFilter, priorityFilter]);
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey);
    setListPage(0);
  }

  return <div className="space-y-3">
    <Card className="gap-0 overflow-hidden border-border py-0 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-gradient-to-r from-primary/5 to-background px-4 py-3">
        <div className="min-w-0 flex-1 basis-48">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Workspace · Team #{teamId}</span>
            <Badge className="border-0 bg-emerald-100 px-1.5 py-0 text-[9px] text-emerald-800">Sprint Board</Badge>
          </div>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
            <h2 className="truncate text-base font-semibold text-foreground">{selectedSprint?.name ?? "Kanban Board"}</h2>
            <p className="hidden truncate text-xs text-muted-foreground xl:block">Track sprint work and your team's backlog.</p>
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 xl:w-auto">
          <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-xs text-muted-foreground">
            <strong className="whitespace-nowrap font-semibold text-foreground">Sprint {selectedSprint ? `#${selectedSprint.id}` : "—"}</strong>
            <span className="hidden whitespace-nowrap border-l pl-2 sm:inline">{formatDate(selectedSprint?.startDate)} – {formatDate(selectedSprint?.endDate)}</span>
          </div>
          <select aria-label="Select sprint" className="h-8 min-w-0 max-w-52 rounded-md border bg-background px-2 text-xs" value={sprintId ?? ""}
            onChange={(event) => setSprintId(Number(event.target.value))} disabled={query.isPending || !sprints.length}>
            {!sprints.length ? <option value="">No sprints available</option> : null}
            {sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} · {sprint.status}</option>)}
          </select>
          <Button variant="outline" size="icon-sm" aria-label="Refresh board" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
          {!readOnly && onCreateWorkItem ? <Button size="sm" className="h-8" onClick={onCreateWorkItem}><Plus className="size-3.5" />Create work item</Button> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/25 px-4 py-2">
        <Metric label="Sprint tasks" value={allSprintItems.length} />
        <Metric label="Done" value={`${doneCount} / ${allSprintItems.length}`} />
        <div className="flex items-center gap-2 text-xs"><span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Completion</span><div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:w-32" role="progressbar" aria-label="Sprint completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completion}%` }} /></div><span className="font-semibold tabular-nums text-emerald-700">{completion}%</span></div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-violet-700"><Activity className="size-3.5" /><span>Activity Trail</span><Badge variant="secondary" className="bg-violet-100 px-1.5 py-0 text-[10px] text-violet-700">{activity.length}</Badge></div>
      </div>
    </Card>

    {query.isPending ? <div className="grid grid-cols-1 gap-3 md:grid-cols-3 2xl:grid-cols-5">{visibleColumns.map((column) => <Skeleton key={column.key} className="h-72" />)}</div>
      : query.isError ? <div role="alert" className="flex items-center justify-between rounded-xl border border-destructive/30 p-4 text-sm text-destructive"><span>Could not load the team's sprints and work items.</span><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Try again</Button></div>
      : !sprints.length ? <Card><div className="p-12 text-center text-sm text-muted-foreground">This team has no sprints yet. Create a sprint and add work items in the Backlog tab.</div></Card>
      : <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border bg-muted/30 p-0.5" role="group" aria-label="Display mode">
                <Button type="button" size="sm" className="h-7 px-2.5 text-xs" variant={viewMode === "board" ? "default" : "ghost"} onClick={() => setViewMode("board")}><LayoutGrid className="size-3.5" />Board</Button>
                <Button type="button" size="sm" className="h-7 px-2.5 text-xs" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => setViewMode("list")}><List className="size-3.5" />List</Button>
              </div>
              <label className="flex h-8 w-44 items-center gap-2 rounded-md border bg-background px-2.5 text-xs text-muted-foreground">
                <UserRound className="size-3.5 shrink-0" />
                <select aria-label="Filter by team member" className="w-full bg-transparent outline-none" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
                  <option value="ALL">All members</option><option value="UNASSIGNED">Unassigned</option>
                  {memberIds.map((id) => {
                    const displayName = query.data?.members.find((member) => member.projectMemberId === id)?.displayName
                      ?? boardItems.find((item) => item.assigneeProjectMemberId === id)?.assigneeDisplayName;
                    return <option key={id} value={id}>{displayName || `Member #${id}`}</option>;
                  })}
                </select>
              </label>
            </div>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
              <label className="relative min-w-0 flex-1 sm:flex-none"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search work items" className="h-8 w-full bg-background pl-8 text-xs sm:w-52" placeholder="Search work items..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label>
              {viewMode === "list" ? <label className="sr-only" htmlFor="workspace-board-sort">Sort order</label> : null}
              {viewMode === "list" ? <>
                <label className="sr-only" htmlFor="workspace-board-status">Filter by status</label>
                <select id="workspace-board-status" className="h-8 rounded-md border bg-background px-2 text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="ALL">All statuses</option>
                  {DEFAULT_COLUMNS.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                </select>
                <label className="sr-only" htmlFor="workspace-board-priority">Filter by priority</label>
                <select id="workspace-board-priority" className="h-8 rounded-md border bg-background px-2 text-xs" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="ALL">All priorities</option><option value="URGENT">Urgent</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
                <label className="sr-only" htmlFor="workspace-board-sort">Sort order</label>
                <select id="workspace-board-sort" className="h-8 rounded-md border bg-background px-2 text-xs" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="title">Name A–Z</option><option value="priority">Priority</option><option value="status">Status</option></select>
              </> : null}
            </div>
          </div>
          {selectedSprint?.status !== "ACTIVE" ? <p className="px-1 text-xs text-muted-foreground">This sprint has not started. Start it in the Backlog tab to make it active.</p> : null}
        <div className="grid items-stretch gap-4 2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0">
          {viewMode === "board" ? <div className="overflow-x-auto overscroll-x-contain pb-2" role="region" aria-label="Kanban columns" tabIndex={0}>
            <div className="grid min-w-[1000px] items-stretch gap-2" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))` }}>
              {visibleColumns.map(({ key, label, icon: Icon, color }) => {
                const items = sprintItems.filter((item) => item.status === key);
                return <section key={key} aria-label={`${label}, ${items.length} work items`}
                  className={`flex h-[32rem] min-h-[24rem] max-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-2 ${draggedItem ? "transition-colors" : ""}`}
                  onDragOver={(event) => { if (draggedItem) event.preventDefault(); }}
                  onDrop={(event) => { event.preventDefault(); if (draggedItem) void moveItem(draggedItem, key); }}>
                  <header className="mb-3 flex items-center justify-between gap-1 px-1"><div className="flex min-w-0 items-center gap-2"><span className={`size-2.5 shrink-0 rounded-full ${color}`} /><h3 className="truncate text-sm font-bold" title={label}>{label}</h3><Badge variant="secondary">{items.length}</Badge></div><div className="flex shrink-0 items-center gap-1"><Icon className="size-4 text-slate-400" /></div></header>
                  <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain pr-1">
                    {items.map((item) => <article key={item.id} draggable={canUpdate && savingItemId !== item.id}
                      onDragStart={() => setDraggedItem(item)} onDragEnd={() => setDraggedItem(null)}
                      onClick={() => openItemDetails(item)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openItemDetails(item);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Open details for ${item.title ?? "work item"}`}
                      className={`flex shrink-0 cursor-pointer flex-col rounded-xl border bg-white p-3 shadow-sm transition-shadow hover:shadow-md hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${savingItemId === item.id ? "opacity-50" : ""}`}>
                      <p className="font-mono text-[10px] text-muted-foreground">#{item.id ?? "—"}</p>
                      <div className="flex min-h-5 items-center gap-1.5 text-[10px]">
                        {item.workType ? <Badge variant="outline" className={workTypeStyle(item.workType)}>{workTypeLabel(item.workType)}</Badge> : null}
                        {item.priority ? <Badge variant="outline" className={priorityStyle(item.priority)}>{priorityLabel(item.priority)}</Badge> : null}
                      </div>
                      <h4 className="mt-2 line-clamp-2 h-10 break-words text-sm font-semibold leading-5 text-slate-800" title={item.title || "Untitled work item"}>{item.title || "Untitled work item"}</h4>
                      <p className="mt-1 line-clamp-3 h-12 whitespace-pre-wrap break-words text-xs leading-4 text-muted-foreground">{item.description || ""}</p>
                      <p className="mt-2 h-4 truncate text-xs leading-4 text-slate-500" title={item.milestoneName || undefined}>{item.milestoneName || ""}</p>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
                        {canUpdate ? <>
                        <label className="flex min-w-0 items-center gap-1.5" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onDragStart={(event) => event.preventDefault()}>
                          <UserRound className="size-3.5 shrink-0" />
                          <select aria-label={`Assign ${item.title ?? "work item"}`} className="max-w-36 truncate bg-transparent" value={item.assigneeProjectMemberId ?? ""} disabled={savingItemId === item.id || query.isFetching}
                            onChange={(event) => void assignItem(item, event.target.value)}>
                            <option value="">Unassigned</option>
                            {workItemAssigneeOptions(item, query.data?.members ?? []).map((member) => <option key={member.projectMemberId} value={member.projectMemberId} disabled={member.disabled} title={member.disabled ? "Not available for new assignments" : undefined}>{member.displayName}</option>)}
                          </select>
                        </label>
                        </> : <span>{workItemAssigneeLabel(item, query.data?.members ?? [])}</span>}
                        {item.estimatedHours != null ? <span>{item.estimatedHours}h</span> : null}
                      </div>
                    </article>)}
                    {items.length === 0 ? <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed bg-white/50 px-3 text-center text-xs text-muted-foreground">No work items</div> : null}
                  </div>
                </section>;
              })}
            </div>
          </div> : <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Work item</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3 text-right">Estimate</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y">{listItems.map((item) => <tr key={item.id} className="hover:bg-slate-50/80">
                <td className="max-w-md px-4 py-3"><p className="text-[10px] font-mono text-muted-foreground">#{item.id ?? "—"}</p><p className="font-medium text-slate-800">{item.title || "Untitled work item"}</p>{item.milestoneName ? <p className="mt-1 truncate text-xs text-muted-foreground">{item.milestoneName}</p> : null}</td>
                <td className="px-4 py-3">{item.workType ? <Badge variant="outline" className={workTypeStyle(item.workType)}>{workTypeLabel(item.workType)}</Badge> : "—"}</td>
                <td className="px-4 py-3">{item.priority ? <Badge variant="outline" className={priorityStyle(item.priority)}>{priorityLabel(item.priority)}</Badge> : "—"}</td>
                <td className="px-4 py-3">{canUpdate ? <select aria-label={`Status for ${item.title ?? "work item"}`} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700" value={item.status ?? "TODO"} disabled={savingItemId === item.id || query.isFetching} onChange={(event) => void updateStatus(item, event.target.value as SprintBacklogStatus)}>{([...new Set([item.status ?? "TODO", ...transitionOptions(item.status ?? "TODO")])] as SprintBacklogStatus[]).map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select> : <Badge variant="outline" className={item.status === "DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.status === "REVIEW" ? "border-amber-200 bg-amber-50 text-amber-800" : item.status === "IN_PROGRESS" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-sky-200 bg-sky-50 text-sky-700"}>{statusLabel(item.status)}</Badge>}</td>
                <td className="px-4 py-3 text-slate-600">{canUpdate ? <select aria-label={`Assign ${item.title ?? "work item"}`} className="max-w-40 bg-transparent" value={item.assigneeProjectMemberId ?? ""} disabled={savingItemId === item.id || query.isFetching} onChange={(event) => void assignItem(item, event.target.value)}><option value="">Unassigned</option>{workItemAssigneeOptions(item, query.data?.members ?? []).map((member) => <option key={member.projectMemberId} value={member.projectMemberId} disabled={member.disabled} title={member.disabled ? "Not available for new assignments" : undefined}>{member.displayName}</option>)}</select> : workItemAssigneeLabel(item, query.data?.members ?? [])}</td>
                <td className="px-4 py-3 text-right text-slate-600">{item.estimatedHours != null ? `${item.estimatedHours}h` : "—"}</td>
                <td className="px-4 py-3"><Button type="button" variant="outline" size="sm" disabled={item.id == null}
                  aria-label={`History: ${item.title || "Untitled work item"}`}
                  onClick={() => { if (item.id != null) setHistoryItem({ id: item.id, title: item.title || "Untitled work item" }); }}>
                  <History className="size-3.5" />History
                </Button></td>
              </tr>)}</tbody>
            </table>
            {filteredItems.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No matching work items found.</p> : null}
            {filteredItems.length > 0 ? <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>{filteredItems.length} work items · Page {listPage + 1}/{pageCount}</span><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Previous page" disabled={listPage === 0} onClick={() => setListPage((page) => Math.max(0, page - 1))}><ChevronLeft className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Next page" disabled={listPage + 1 >= pageCount} onClick={() => setListPage((page) => Math.min(pageCount - 1, page + 1))}><ChevronRight className="size-4" /></Button></div></div> : null}
          </div>}
        </div>
        <aside aria-label="Activity Trail" className="flex h-[32rem] min-h-[24rem] max-h-[70vh] flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="shrink-0 border-b bg-violet-50/40 px-4 py-3"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-semibold"><Activity className="size-4 text-violet-600" />Activity Trail</h3><Badge variant="secondary" className="bg-violet-100 text-violet-700">{activity.length}</Badge></div>
          <p className="mt-1 text-[11px] text-muted-foreground">Recent work item activity in this sprint</p></div>
          {activity.length ? <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">{activity.map((entry) => {
            const summary = auditSummary(entry.action, entry.beforeState, entry.afterState);
            const activityColor = DEFAULT_COLUMNS.find(column => column.key === parseAuditState(entry.afterState)?.status)?.color ?? "bg-primary";
            return <li key={entry.id} className="relative border-l border-border pl-4 text-xs">
              <span className={`absolute -left-1 top-1 size-2 rounded-full ring-2 ring-background ${activityColor}`} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1"><p className="min-w-0 break-words font-medium text-foreground">{entry.actorEmail || `Member #${entry.actorId ?? "—"}`}</p><time className="text-[10px] text-muted-foreground">{formatDateTime(entry.createdAt)}</time></div>
              <p className="mt-1 text-[11px] text-muted-foreground">{summary.actionLabel}</p>
              <p className="mt-1 line-clamp-2 font-medium italic text-muted-foreground">{entry.itemTitle}</p>
              {summary.changes.map((change) => <p key={change} className="mt-1 rounded bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">{change}</p>)}
              {entry.correlationId ? <details className="mt-1 text-[10px] text-muted-foreground"><summary className="cursor-pointer">Transaction details</summary><code className="mt-1 block break-all">{entry.correlationId}</code></details> : null}
            </li>;
          })}</ol> : <p className="m-4 rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">No activity has been recorded yet.</p>}
        </aside>
      </div></div>}
    <Dialog open={historyItem !== null} onOpenChange={(open) => { if (!open) setHistoryItem(null); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle>Change history</DialogTitle>
          <DialogDescription className="break-words">#{historyItem?.id} · {historyItem?.title}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto overscroll-contain" aria-live="polite" aria-busy={historyQuery.isFetching}>
          {historyQuery.isPending ? <p className="py-8 text-center text-sm text-muted-foreground">Loading history…</p>
            : historyQuery.isError ? <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 p-4 text-sm">
              <p>Could not load history. Check your connection or access permissions, then try again.</p>
              <Button type="button" variant="outline" size="sm" disabled={historyQuery.isFetching} onClick={() => void historyQuery.refetch()}>Try again</Button>
            </div>
            : !historyQuery.data?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No changes have been recorded for this work item yet.</p>
              : <ol className="space-y-3">{[...historyQuery.data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id - a.id).map((entry) => {
                const summary = auditSummary(entry.action, entry.beforeState, entry.afterState, Infinity);
                return <li key={entry.id} className="space-y-2 rounded-lg border p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 break-words font-medium">{entry.actorEmail || `Member #${entry.actorId ?? "—"}`} {summary.actionLabel}</p>
                    <time dateTime={entry.createdAt} className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</time>
                  </div>
                  {summary.changes.map((change) => <p key={change} className="break-words text-muted-foreground">{change}</p>)}
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Transaction details</summary>
                    <p className="mt-2 break-all">Action: {entry.action} · Actor ID: {entry.actorId ?? "—"}</p>
                    <p className="mt-1 break-all">Correlation ID: {entry.correlationId || "—"}</p>
                    <p className="mt-2 font-medium">Before change</p>
                    <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-muted p-2">{entry.beforeState || "—"}</pre>
                    <p className="mt-2 font-medium">After change</p>
                    <pre className="mt-1 whitespace-pre-wrap break-all rounded bg-muted p-2">{entry.afterState || "—"}</pre>
                  </details>
                </li>;
              })}</ol>}
        </div>
      </DialogContent>
    </Dialog>

    {/* Backlog Item Detail Sheet for editing on click (Fix Bug #39) */}
    <BacklogItemDetailSheet
      open={detailItem !== null}
      onClose={(open) => { if (!open) setDetailItem(null); }}
      item={detailItem}
      itemKey={detailItem ? ("TASK-" + detailItem.id) : undefined}
      sprintName={sprints.find((sprint) => sprint.id === detailItem?.sprintId)?.name ?? null}
      sprints={sprints}
      milestones={milestonesQuery.data ?? []}
      assignees={(query.data?.members ?? []).map(m => ({
        id: m.projectMemberId,
        userId: m.projectMemberId,
        fullName: m.displayName,
        role: "Member",
      }))}
      workflowStatuses={DEFAULT_COLUMNS
        .map((column) => ({ value: column.key as SprintBacklogStatus, label: column.label }))}
      allowedStatusTransitions={transitionOptions}
      teamId={teamId}
      canEdit={canUpdate}
      canMove={canMove}
      canDelete={canDelete}
      readOnly={readOnly}
      onChanged={async () => {
        await query.refetch();
        await queryClient.invalidateQueries({ queryKey: ["sprint-backlog-audit"] });
      }}
      onDeleted={async () => {
        await query.refetch();
        setDetailItem(null);
      }}
    />
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="flex items-center gap-2 text-xs"><span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span><span className="font-semibold tabular-nums text-foreground">{value}</span></div>;
}
