import { teamBacklogApi } from "@/api/features/team-backlog.api";
import { workspaceApi } from "@/api/features/workspace.api";
import { sprintBacklogApi } from "@/api/features/sprint_backlog.api";
import { sprintApi } from "@/api/features/sprint.api";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { SprintBacklogDTO, SprintBacklogStatus, SprintDTO } from "@/types";
import type { WorkspaceBoardColumn } from "@/types/features/workspace";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Check, ChevronLeft, ChevronRight, Circle, CircleDot, Clock3, LayoutGrid, List, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, UserRound } from "lucide-react";
import { BacklogItemDetailSheet } from "@/pages/management/backlog/components/BacklogItemDetailSheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BacklogPriority, SprintBacklogWorkType, SprintPlanningItem } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import axios from "axios";

type BoardColumnKey = "BACKLOG" | Exclude<SprintBacklogStatus, "BLOCKED">;
const allowedStatusTransitions: Record<SprintBacklogStatus, SprintBacklogStatus[]> = {
  // Keep the UI options identical to SprintBacklogServiceImpl's transition
  // matrix so the board never offers a change that the API will reject.
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["REVIEW", "BLOCKED", "TODO"],
  REVIEW: ["DONE", "IN_PROGRESS"],
  BLOCKED: ["IN_PROGRESS"],
  DONE: ["REVIEW"],
  CUSTOM_1: [], CUSTOM_2: [], CUSTOM_3: [], CUSTOM_4: [], CUSTOM_5: [],
};
const CUSTOM_STATUS_KEYS: BoardColumnKey[] = ["CUSTOM_1", "CUSTOM_2", "CUSTOM_3", "CUSTOM_4", "CUSTOM_5"];
const CUSTOM_COLORS = ["bg-fuchsia-500", "bg-cyan-500", "bg-lime-600", "bg-orange-500", "bg-indigo-500"];
export interface BoardColumnConfig {
  key: BoardColumnKey;
  label: string;
  icon: typeof Circle;
  color: string;
  visible: boolean;
}

const DEFAULT_COLUMNS: BoardColumnConfig[] = [
  { key: "BACKLOG", label: "Backlog", icon: Circle, color: "bg-slate-400", visible: true },
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
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "short" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", {
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

function boardSettingsErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data: unknown = error.response?.data;
    const message = data && typeof data === "object" && "message" in data
      ? (data as { message?: unknown }).message
      : undefined;
    if (status === 403) return "Bạn không có quyền cấu hình Board. Cần SPRINT_WRITE hoặc SPRINT_BACKLOG_UPDATE.";
    if (typeof message === "string" && message.trim()) return `Không lưu được cấu hình Board: ${message}`;
    if (status === 400 || status === 422) return "Cấu hình không hợp lệ. Kiểm tra tên cột, trạng thái trùng và cột đang bật.";
    if (status === 409) return "Không thể xóa trạng thái đang được work item sử dụng.";
  }
  return "Không lưu được cấu hình Board. Hãy kiểm tra kết nối rồi thử lại; cấu hình cũ vẫn được giữ.";
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
    case "BLOCKED": return "Blocked";
    case "BACKLOG": return "Backlog";
    default: return status ?? "—";
  }
}

function columnFor(key: BoardColumnKey, label: string, visible = true, index = 0): BoardColumnConfig {
  const known = DEFAULT_COLUMNS.find((column) => column.key === key);
  return known ? { ...known, label, visible }
    : { key, label, visible, icon: CircleDot, color: CUSTOM_COLORS[index % CUSTOM_COLORS.length] };
}

function auditValueLabel(key: string, value: unknown) {
  if (key === "status" && typeof value === "string") return statusLabel(value);
  if (key === "priority" && typeof value === "string") return priorityLabel(value);
  if (key === "assigneeProjectMemberId") return value == null ? "Chưa phân công" : `Thành viên #${String(value)}`;
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
  status: "Trạng thái",
  priority: "Ưu tiên",
  assigneeProjectMemberId: "Người phụ trách",
  sprintId: "Sprint",
  title: "Tiêu đề",
  estimatedHours: "Ước tính",
};

function auditSummary(action: string, beforeState?: string | null, afterState?: string | null) {
  const before = parseAuditState(beforeState);
  const after = parseAuditState(afterState);
  const actionLabel = action === "CREATE" ? "đã tạo work item"
    : action === "DELETE" ? "đã xóa work item" : "đã cập nhật work item";

  if (!before && after) return { actionLabel, changes: [`Tạo: ${String(after.title ?? "Work item")}`] };
  if (before && after) {
    const changes = Object.entries(auditFieldLabels).flatMap(([key, label]) => {
      const oldValue = before[key];
      const newValue = after[key];
      if (oldValue === newValue || (oldValue == null && newValue == null)) return [];
      return [`${label}: ${auditValueLabel(key, oldValue)} → ${auditValueLabel(key, newValue)}`];
    });
    return { actionLabel, changes: changes.length ? changes.slice(0, 3) : ["Đã lưu thay đổi"] };
  }
  return { actionLabel, changes: [] as string[] };
}

export function WorkspaceTeamBoardPanel({ workspaceId, teamId, canUpdate, canMove, canDelete, canConfigureColumns, onCreateWorkItem }: { workspaceId: number; teamId: number; canUpdate: boolean; canMove: boolean; canDelete: boolean; canConfigureColumns: boolean; onCreateWorkItem?: () => void }) {
  const queryClient = useQueryClient();
  const [sprintId, setSprintId] = useState<number>();
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
  const milestonesQuery = useQuery({
    queryKey: ["backlog-milestone-options", teamId],
    queryFn: () => milestoneApi.getBacklogOptions(teamId),
    enabled: detailItem !== null && teamId > 0,
    retry: false,
  });
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [boardColumns, setBoardColumns] = useState<BoardColumnConfig[]>(DEFAULT_COLUMNS);
  const columnsQuery = useQuery({
    queryKey: ["workspace-board-columns", workspaceId],
    queryFn: () => workspaceApi.boardColumns(workspaceId), retry: false,
  });
  const persistedColumns = useMemo(() => {
    if (columnsQuery.data) {
      const configured = columnsQuery.data;
      const keys = new Set(configured.map((column) => column.key));
      const defaults = DEFAULT_COLUMNS.filter((column) => !keys.has(column.key))
        .map((column) => ({ key: column.key, label: column.label, visible: column.visible }));
      return [
        ...configured.map((column, index) => columnFor(column.key as BoardColumnKey, column.label, column.visible, index)),
        ...defaults.map((column) => columnFor(column.key as BoardColumnKey, column.label, column.visible)),
      ];
    }
    return DEFAULT_COLUMNS;
  }, [columnsQuery.data]);
  useEffect(() => setBoardColumns(persistedColumns), [persistedColumns]);

  const saveColumns = useMutation({
    mutationFn: (columns: BoardColumnConfig[]) => workspaceApi.updateBoardColumns(workspaceId,
      columns.map(({ key, label, visible }) => ({ key, label, visible }) as WorkspaceBoardColumn)),
    onSuccess: columns => {
      queryClient.setQueryData(["workspace-board-columns", workspaceId], columns);
      void queryClient.invalidateQueries({ queryKey: ["workspace-board-columns", workspaceId] });
      toast.success("Board settings saved for this workspace.");
      setColumnsDialogOpen(false);
    },
    onError: error => toast.error(boardSettingsErrorMessage(error)),
  });

  const saveColumnsConfig = (newCols: BoardColumnConfig[]) => saveColumns.mutate(newCols);
  const visibleColumns = useMemo(() => persistedColumns.filter(c => c.visible), [persistedColumns]);
  const configuredStatusLabel = (status?: string | null) =>
    persistedColumns.find((column) => column.key === status)?.label ?? statusLabel(status);
  const transitionOptions = (status: SprintBacklogStatus): SprintBacklogStatus[] => {
    const standard = allowedStatusTransitions[status] ?? [];
    const workflow = persistedColumns.filter((column) => column.key !== "BACKLOG").map((column) => column.key as SprintBacklogStatus);
    const index = workflow.indexOf(status);
    const adjacent = workflow.filter((_, candidateIndex) => Math.abs(candidateIndex - index) === 1);
    if (index >= 0 && workflow.some((candidate) => candidate.startsWith("CUSTOM_"))) {
      return [...new Set([...adjacent, ...standard.filter((candidate) => candidate === "BLOCKED")])];
    }
    return standard;
  };
  const query = useQuery({
    queryKey: ["team-backlog-board", teamId],
    queryFn: () => teamBacklogApi.getBoard(teamId),
    retry: false,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const sprints = query.data?.sprints ?? [];

  useEffect(() => {
    if (!sprints.length) {
      setSprintId(undefined);
      return;
    }
    setSprintId((current) => sprints.some((sprint) => sprint.id === current)
      ? current
      : preferredSprint(sprints)?.id);
  }, [sprints]);

  const selectedSprint = sprints.find((sprint) => sprint.id === sprintId);
  const allItems = query.data?.items ?? [];
  const isColumnInUse = (key: BoardColumnKey) => key !== "BACKLOG"
    && allItems.some((item) => item.sprintId != null && item.status === key);
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
      .filter((item) => viewMode !== "list" || statusFilter === "ALL" || (statusFilter === "BACKLOG"
        ? item.sprintId == null
        : item.sprintId != null && item.status === statusFilter))
      .filter((item) => viewMode !== "list" || priorityFilter === "ALL" || item.priority === priorityFilter)
      .sort((left, right) => {
        if (sortBy === "priority") return (priorityOrder[left.priority ?? ""] ?? 4) - (priorityOrder[right.priority ?? ""] ?? 4);
        if (sortBy === "status") return (left.sprintId == null ? "BACKLOG" : left.status ?? "")
          .localeCompare(right.sprintId == null ? "BACKLOG" : right.status ?? "");
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
  const activity = useMemo(() => auditQueries.flatMap((result) =>
    (result.data ?? []).map((entry) => ({ ...entry, itemTitle: itemTitleById.get(entry.sprintBacklogId) ?? "Work item" })),
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10), [auditQueries, allSprintItems]);

  const moveItem = async (item: SprintBacklogDTO, target: BoardColumnKey) => {
    if (!canUpdate || savingItemId != null || item.id == null) return;

    // Validate status transition before calling API.
    // A product-backlog item is outside the sprint workflow. Its persisted
    // status may be stale from before it was removed from a sprint, so treat
    // the source as Backlog and start it at TODO when adding it to a sprint.
    const currentStatus = (item.sprintId == null ? "TODO" : item.status ?? "TODO") as SprintBacklogStatus;
    const isMovingToSprint = item.sprintId !== sprintId && sprintId != null && target !== "BACKLOG";
    if ((target === "BACKLOG" && item.sprintId != null && currentStatus !== "TODO")
        || (isMovingToSprint && (target !== "TODO" || currentStatus !== "TODO"))) {
      toast.error("Backlog chỉ chuyển qua lại với To do. Hãy chuyển từng cột liền kề.");
      setDraggedItem(null);
      return;
    }
    if ((target === "BACKLOG" || isMovingToSprint) && !canMove) {
      toast.error("Sprint update permission is required to move work items between the sprint and Backlog.");
      setDraggedItem(null);
      return;
    }
    if (!isMovingToSprint && target !== "BACKLOG" && target !== currentStatus) {
      const allowed = transitionOptions(currentStatus);
      if (!allowed.includes(target as SprintBacklogStatus)) {
        const nextStatuses = allowed.map(configuredStatusLabel).join(", ") || "không có";
        toast.error(
          `Không thể chuyển từ ${configuredStatusLabel(currentStatus)} sang ${configuredStatusLabel(target)}. ` +
          `Trạng thái tiếp theo hợp lệ: ${nextStatuses}.`,
        );
        setDraggedItem(null);
        return;
      }
    }

    try {
      setSavingItemId(item.id);
      if (target === "BACKLOG") {
        if (item.sprintId != null && item.sprintId === sprintId) {
          await sprintApi.updateBacklog(sprintId, allSprintItems
            .map((sprintItem) => sprintItem.id)
            .filter((id): id is number => id != null && id !== item.id));
        }
      } else {
        if (isMovingToSprint) {
          // Backlog has no in-sprint status. Starting a sprint item always
          // enters the first workflow column, regardless of any stale status.
          await sprintBacklogApi.update(String(item.id), { sprintId, status: "TODO" } as SprintBacklogDTO);
        } else if (item.status !== target) {
          await sprintBacklogApi.update(String(item.id), { status: target } as SprintBacklogDTO);
        }
      }
      await query.refetch();
      await queryClient.invalidateQueries({ queryKey: ["sprint-backlog-audit"] });
      toast.success("\u0110\u00e3 c\u1eadp nh\u1eadt work item tr\u00ean Board.");
    } catch (error) {
      const msg =
        axios.isAxiosError(error) &&
        typeof (error.response?.data as Record<string, unknown>)?.message === "string"
          ? (error.response!.data as Record<string, string>).message
          : "Kh\u00f4ng c\u1eadp nh\u1eadt \u0111\u01b0\u1ee3c work item. D\u1eef li\u1ec7u hi\u1ec7n t\u1ea1i v\u1eabn \u0111\u01b0\u1ee3c gi\u1eef nguy\u00ean.";
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
      const nextStatuses = allowed.map(configuredStatusLabel).join(", ") || "không có";
      toast.error(
        `Không thể chuyển từ ${configuredStatusLabel(current)} sang ${configuredStatusLabel(target)}. ` +
        `Trạng thái tiếp theo hợp lệ: ${nextStatuses}.`,
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
      await teamBacklogApi.assign(teamId, item.id, value ? Number(value) : null);
      await query.refetch();
      await queryClient.invalidateQueries({ queryKey: ["sprint-backlog-audit"] });
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
      status: item.sprintId == null ? "BACKLOG" : item.status === "DONE" ? "DONE"
        : item.status === "BLOCKED" ? "BLOCKED" : item.status === "REVIEW" ? "REVIEW"
        : !item.status || item.status === "TODO" ? "SPRINT_BACKLOG" : "IN_PROGRESS",
      priority: (item.priority as BacklogPriority) ?? "MEDIUM",
      workType: (item.workType as SprintBacklogWorkType) ?? "TASK",
      sprintId: item.sprintId ?? null,
      projectId: item.projectId ?? null,
      milestoneId: item.milestoneId ?? null,
      milestoneName: item.milestoneName ?? null,
      assigneeProjectMemberId: item.assigneeProjectMemberId ?? null,
      startDate: item.startDate ?? null,
      endDate: item.endDate ?? null,
      estimatedHours: item.estimatedHours ?? null,
    });
  };

  useEffect(() => setListPage(0), [sprintId, memberFilter, searchTerm, sortBy, statusFilter, priorityFilter]);

  return <div className="space-y-4">
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-gradient-to-r from-sky-50 to-white p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
            <span>Workspace · Team #{teamId}</span>
            <Badge className="border-0 bg-emerald-100 text-emerald-800">Sprint Board</Badge>
          </div>
          <h2 className="mt-1 truncate text-xl font-bold text-slate-900">{selectedSprint?.name ?? "Kanban Board"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Theo dõi các work item của sprint và backlog nhóm.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onCreateWorkItem ? <Button size="sm" onClick={onCreateWorkItem}><Plus className="size-4" />Tạo work item</Button> : null}
          <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
            <strong className="block text-slate-900">Sprint {selectedSprint ? `#${selectedSprint.id}` : "—"}</strong>
            {formatDate(selectedSprint?.startDate)} – {formatDate(selectedSprint?.endDate)}
          </div>
          <select aria-label="Chọn Sprint" className="h-10 max-w-64 rounded-md border bg-white px-3 text-sm" value={sprintId ?? ""}
            onChange={(event) => setSprintId(Number(event.target.value))} disabled={query.isPending || !sprints.length}>
            {!sprints.length ? <option value="">Team chưa có Sprint</option> : null}
            {sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name} · {sprint.status}</option>)}
          </select>
          {canConfigureColumns && <Button variant="outline" size="sm" onClick={() => { setBoardColumns(persistedColumns); setColumnsDialogOpen(true); }} title="Thêm trạng thái, đổi tên hoặc ẩn/hiện cột workflow">
            <SlidersHorizontal className="mr-1.5 size-4" /> Tùy chỉnh cột
          </Button>}
          <Button variant="outline" size="icon" aria-label="Làm mới Board" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y bg-slate-50/80 sm:grid-cols-3 sm:divide-y-0">
        <Metric label="Sprint tasks" value={allSprintItems.length} />
        <Metric label="Done" value={`${doneCount} / ${allSprintItems.length}`} />
        <div className="p-3 sm:p-4"><div className="text-[11px] font-semibold uppercase text-slate-500">Completion</div><div className="mt-2 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completion}%` }} /></div><span className="text-xs font-semibold">{completion}%</span></div></div>
      </div>
    </Card>

    {query.isPending ? <div className="grid grid-cols-1 gap-3 md:grid-cols-3 2xl:grid-cols-5">{visibleColumns.map((column) => <Skeleton key={column.key} className="h-72" />)}</div>
      : query.isError ? <div role="alert" className="flex items-center justify-between rounded-xl border border-destructive/30 p-4 text-sm text-destructive"><span>Không tải được sprint và work items của team.</span><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Thử lại</Button></div>
      : !sprints.length ? <Card><div className="p-12 text-center text-sm text-muted-foreground">Team chưa có Sprint. Tạo Sprint và thêm work items ở tab Backlog.</div></Card>
      : <div className="grid items-stretch gap-4 2xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center justify-between rounded-xl border bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border bg-slate-50 p-1" role="group" aria-label="Chế độ hiển thị">
                <Button type="button" size="sm" variant={viewMode === "board" ? "default" : "ghost"} onClick={() => setViewMode("board")}><LayoutGrid className="size-4" />Board</Button>
                <Button type="button" size="sm" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => setViewMode("list")}><List className="size-4" />List</Button>
              </div>
              <label className="flex h-10 min-w-52 items-center gap-2 rounded-lg border px-3 text-sm text-muted-foreground">
                <UserRound className="size-4" />
                <select aria-label="Lọc theo thành viên" className="w-full bg-transparent outline-none" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
                  <option value="ALL">Tất cả thành viên</option><option value="UNASSIGNED">Chưa phân công</option>
                  {memberIds.map((id) => {
                    const displayName = query.data?.members.find((member) => member.projectMemberId === id)?.displayName
                      ?? boardItems.find((item) => item.assigneeProjectMemberId === id)?.assigneeDisplayName;
                    return <option key={id} value={id}>{displayName || `Member #${id}`}</option>;
                  })}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Tìm work item" className="h-10 w-52 pl-9" placeholder="Tìm công việc..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></label>
              {viewMode === "list" ? <label className="sr-only" htmlFor="workspace-board-sort">Sắp xếp</label> : null}
              {viewMode === "list" ? <>
                <label className="sr-only" htmlFor="workspace-board-status">Lọc trạng thái</label>
                <select id="workspace-board-status" className="h-10 rounded-md border bg-white px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="ALL">Mọi trạng thái</option>
                  {persistedColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
                  <option value="BLOCKED">Blocked</option>
                </select>
                <label className="sr-only" htmlFor="workspace-board-priority">Lọc ưu tiên</label>
                <select id="workspace-board-priority" className="h-10 rounded-md border bg-white px-3 text-sm" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="ALL">All priorities</option><option value="URGENT">Urgent</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option></select>
                <label className="sr-only" htmlFor="workspace-board-sort">Sắp xếp</label>
                <select id="workspace-board-sort" className="h-10 rounded-md border bg-white px-3 text-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}><option value="title">Tên A–Z</option><option value="priority">Ưu tiên</option><option value="status">Trạng thái</option></select>
              </> : null}
            </div>
            {selectedSprint?.status !== "ACTIVE" ? <span className="text-xs text-muted-foreground">Sprint chưa bắt đầu. Start sprint ở tab Backlog để chuyển sang ACTIVE.</span> : null}
          </div>
          {viewMode === "board" ? <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1000px] items-stretch gap-2" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(0, 1fr))` }}>
              {visibleColumns.map(({ key, label, icon: Icon, color }) => {
                const items = key === "BACKLOG" ? filteredItems.filter((item) => item.sprintId == null)
                  : sprintItems.filter((item) => item.status === key);
                return <section key={key} aria-label={`${label}, ${items.length} work items`}
                  className={`flex h-[32rem] min-h-[24rem] max-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-2 ${draggedItem ? "transition-colors" : ""}`}
                  onDragOver={(event) => { if (draggedItem) event.preventDefault(); }}
                  onDrop={(event) => { event.preventDefault(); if (draggedItem) void moveItem(draggedItem, key); }}>
                  <header className="mb-3 flex items-center justify-between gap-2 px-1"><div className="flex min-w-0 items-center gap-2"><span className={`size-2.5 rounded-full ${color}`} /><h3 className="truncate text-sm font-bold">{label}</h3><Badge variant="secondary">{items.length}</Badge></div><Icon className="size-4 text-slate-400" /></header>
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
                      className={`cursor-pointer rounded-xl border bg-white p-3 shadow-sm transition-shadow hover:shadow-md hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${savingItemId === item.id ? "opacity-50" : ""}`}>
                      <p className="font-mono text-[10px] text-muted-foreground">#{item.id ?? "—"}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        {item.workType ? <Badge variant="outline" className={workTypeStyle(item.workType)}>{workTypeLabel(item.workType)}</Badge> : null}
                        {item.priority ? <Badge variant="outline" className={priorityStyle(item.priority)}>{priorityLabel(item.priority)}</Badge> : null}
                      </div>
                      <h4 className="mt-2 break-words text-sm font-semibold text-slate-800">{item.title || "Untitled work item"}</h4>
                      {item.description ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{item.description}</p> : null}
                      {item.milestoneName ? <p className="mt-2 truncate text-xs text-slate-500">{item.milestoneName}</p> : null}
                      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
                        {canUpdate ? <>
                        <label className="flex min-w-0 items-center gap-1.5" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onDragStart={(event) => event.preventDefault()}>
                          <UserRound className="size-3.5 shrink-0" />
                          <select aria-label={`Assign ${item.title ?? "work item"}`} className="max-w-36 truncate bg-transparent" value={item.assigneeProjectMemberId ?? ""} disabled={savingItemId === item.id || query.isFetching}
                            onChange={(event) => void assignItem(item, event.target.value)}>
                            <option value="">Unassigned</option>
                            {(query.data?.members ?? []).map((member) => <option key={member.projectMemberId} value={member.projectMemberId}>{member.displayName}</option>)}
                          </select>
                        </label>
                        </> : <span>{item.assigneeDisplayName || (item.assigneeProjectMemberId ? `Member #${item.assigneeProjectMemberId}` : "Unassigned")}</span>}
                        {item.estimatedHours != null ? <span>{item.estimatedHours}h</span> : null}
                      </div>
                    </article>)}
                    {items.length === 0 ? <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed bg-white/50 px-3 text-center text-xs text-muted-foreground">Chưa có công việc</div> : null}
                  </div>
                </section>;
              })}
            </div>
          </div> : <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Work item</th><th className="px-4 py-3">Loại</th><th className="px-4 py-3">Ưu tiên</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Người phụ trách</th><th className="px-4 py-3 text-right">Ước tính</th></tr></thead>
              <tbody className="divide-y">{listItems.map((item) => <tr key={item.id} className="hover:bg-slate-50/80">
                <td className="max-w-md px-4 py-3"><p className="text-[10px] font-mono text-muted-foreground">#{item.id ?? "—"}</p><p className="font-medium text-slate-800">{item.title || "Untitled work item"}</p>{item.milestoneName ? <p className="mt-1 truncate text-xs text-muted-foreground">{item.milestoneName}</p> : null}</td>
                <td className="px-4 py-3">{item.workType ? <Badge variant="outline" className={workTypeStyle(item.workType)}>{workTypeLabel(item.workType)}</Badge> : "—"}</td>
                <td className="px-4 py-3">{item.priority ? <Badge variant="outline" className={priorityStyle(item.priority)}>{priorityLabel(item.priority)}</Badge> : "—"}</td>
                <td className="px-4 py-3">{canUpdate && item.sprintId != null ? <select aria-label={`Status for ${item.title ?? "work item"}`} className={`rounded-full border px-2 py-1 text-xs font-medium ${item.status === "BLOCKED" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-700"}`} value={item.status ?? "TODO"} disabled={savingItemId === item.id || query.isFetching} onChange={(event) => void updateStatus(item, event.target.value as SprintBacklogStatus)}>{([...new Set([item.status ?? "TODO", ...transitionOptions(item.status ?? "TODO")])] as SprintBacklogStatus[]).map((status) => <option key={status} value={status}>{configuredStatusLabel(status)}</option>)}</select> : <Badge variant="outline" className={item.sprintId == null ? "border-slate-200 bg-slate-100 text-slate-700" : item.status === "BLOCKED" ? "border-rose-200 bg-rose-50 text-rose-700" : item.status === "DONE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : item.status === "REVIEW" ? "border-amber-200 bg-amber-50 text-amber-800" : item.status === "IN_PROGRESS" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-sky-200 bg-sky-50 text-sky-700"}>{item.sprintId == null ? statusLabel("BACKLOG") : configuredStatusLabel(item.status)}</Badge>}</td>
                <td className="px-4 py-3 text-slate-600">{canUpdate ? <select aria-label={`Assign ${item.title ?? "work item"}`} className="max-w-40 bg-transparent" value={item.assigneeProjectMemberId ?? ""} disabled={savingItemId === item.id || query.isFetching} onChange={(event) => void assignItem(item, event.target.value)}><option value="">Unassigned</option>{(query.data?.members ?? []).map((member) => <option key={member.projectMemberId} value={member.projectMemberId}>{member.displayName}</option>)}</select> : item.assigneeDisplayName || "Unassigned"}</td>
                <td className="px-4 py-3 text-right text-slate-600">{item.estimatedHours != null ? `${item.estimatedHours}h` : "—"}</td>
              </tr>)}</tbody>
            </table>
            {filteredItems.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Không tìm thấy work item phù hợp.</p> : null}
            {filteredItems.length > 0 ? <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground"><span>{filteredItems.length} work item · Trang {listPage + 1}/{pageCount}</span><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Trang trước" disabled={listPage === 0} onClick={() => setListPage((page) => Math.max(0, page - 1))}><ChevronLeft className="size-4" /></Button><Button variant="outline" size="icon" aria-label="Trang sau" disabled={listPage + 1 >= pageCount} onClick={() => setListPage((page) => Math.min(pageCount - 1, page + 1))}><ChevronRight className="size-4" /></Button></div></div> : null}
          </div>}
        </div>
        <aside className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><Activity className="size-4 text-violet-600" />Activity Trail</h3><Badge variant="outline">{activity.length}</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">Lịch sử gần đây của work items trong sprint</p>
          {activity.length ? <ol className="mt-4 max-h-[32rem] space-y-4 overflow-y-auto">{activity.map((entry) => {
            const summary = auditSummary(entry.action, entry.beforeState, entry.afterState);
            return <li key={entry.id} className="border-l-2 border-sky-100 pl-3 text-xs">
              <div className="flex items-start justify-between gap-2"><p className="font-medium text-slate-800">{entry.actorEmail || `Thành viên #${entry.actorId ?? "—"}`} {summary.actionLabel}</p><time className="shrink-0 text-muted-foreground">{formatDateTime(entry.createdAt)}</time></div>
              <p className="mt-1 truncate text-slate-600">{entry.itemTitle}</p>
              {summary.changes.map((change) => <p key={change} className="mt-1 text-muted-foreground">{change}</p>)}
              {entry.correlationId ? <details className="mt-1 text-[10px] text-muted-foreground"><summary className="cursor-pointer">Chi tiết giao dịch</summary><code className="mt-1 block break-all">{entry.correlationId}</code></details> : null}
            </li>;
          })}</ol> : <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">Chưa có hoạt động được ghi nhận.</p>}
        </aside>
      </div>}
  
    {/* Customize Columns Dialog (Fix Bug #35 & #36) */}
    <Dialog open={canConfigureColumns && columnsDialogOpen} onOpenChange={(open) => {
      setColumnsDialogOpen(open);
      if (!open) setBoardColumns(persistedColumns);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-primary" /> Tùy chỉnh cột Kanban Board
          </DialogTitle>
          <DialogDescription>
            Tạo cột trạng thái mới (tối đa 8 cột), đổi tên hoặc ẩn/hiện cột. Cấu hình được lưu cho workspace và dùng chung với thành viên khác.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button type="button" variant="outline" size="sm" disabled={saveColumns.isPending || boardColumns.length >= 8 || !CUSTOM_STATUS_KEYS.some((key) => !boardColumns.some((column) => column.key === key))}
            onClick={() => {
              const key = CUSTOM_STATUS_KEYS.find((candidate) => !boardColumns.some((column) => column.key === candidate));
              if (!key) return;
              const created = columnFor(key, `Trạng thái mới ${CUSTOM_STATUS_KEYS.indexOf(key) + 1}`, true, boardColumns.length);
              const doneIndex = boardColumns.findIndex((column) => column.key === "DONE");
              const next = [...boardColumns];
              next.splice(doneIndex < 0 ? next.length : doneIndex, 0, created);
              setBoardColumns(next);
            }}>
            <Plus className="mr-1 size-4" /> Thêm trạng thái
          </Button>
          {boardColumns.map((col, idx) => (
            <div key={col.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="flex items-center gap-2 flex-1">
                <span className={`size-2.5 rounded-full ${col.color}`} />
                <Input
                  value={col.label}
                  maxLength={32}
                  placeholder="Tên cột"
                  className="h-8 text-sm"
                  onChange={(e) => {
                    const next = [...boardColumns];
                    next[idx] = { ...next[idx], label: e.target.value };
                    setBoardColumns(next);
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                  {CUSTOM_STATUS_KEYS.includes(col.key) ? <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={`Remove ${col.label}`} title={isColumnInUse(col.key) ? "Move work items out of this status before removing it." : undefined} disabled={saveColumns.isPending || isColumnInUse(col.key)} onClick={() => setBoardColumns((columns) => columns.filter((column) => column.key !== col.key))}><Trash2 className="size-3.5" /></Button> : null}
                  <Label htmlFor={"switch-" + col.key} className="text-xs text-muted-foreground">
                  {col.visible ? "Hiện" : "Ẩn"}
                </Label>
                <Switch
                  id={"switch-" + col.key}
                  checked={col.visible}
                  disabled={saveColumns.isPending}
                  onCheckedChange={(checked) => {
                    const activeCount = boardColumns.filter(c => c.visible).length;
                    if (!checked && activeCount <= 1) {
                      toast.error("Phải giữ lại ít nhất 1 cột trên Board.");
                      return;
                    }
                    const next = [...boardColumns];
                    next[idx] = { ...next[idx], visible: checked };
                    setBoardColumns(next);
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saveColumns.isPending}
            onClick={() => {
              const custom = boardColumns.filter((column) => CUSTOM_STATUS_KEYS.includes(column.key));
              saveColumnsConfig([...DEFAULT_COLUMNS.filter((column) => column.key !== "DONE"), ...custom, DEFAULT_COLUMNS.find((column) => column.key === "DONE")!]);
            }}
          >
            Khôi phục mặc định
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={saveColumns.isPending} onClick={() => { setBoardColumns(persistedColumns); setColumnsDialogOpen(false); }}>
              Đóng
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saveColumns.isPending}
              onClick={() => saveColumnsConfig(boardColumns)}
            >
              Lưu thay đổi
            </Button>
          </div>
        </DialogFooter>
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
      workflowStatuses={persistedColumns.filter((column) => column.key !== "BACKLOG")
        .map((column) => ({ value: column.key as SprintBacklogStatus, label: column.label }))}
      allowedStatusTransitions={transitionOptions}
      teamId={teamId}
      canEdit={canUpdate}
      canMove={canMove}
      canDelete={canDelete}
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
  return <div className="p-3 sm:p-4"><div className="text-[11px] font-semibold uppercase text-slate-500">{label}</div><div className="mt-1 text-xl font-bold text-slate-900">{value}</div></div>;
}
