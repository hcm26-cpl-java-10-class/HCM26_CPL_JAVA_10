import { projectBoardApi } from "@/api/features/project-board.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectTaskListView } from "@/pages/project/ProjectTaskListView";
import type {
  BoardColumn,
  BoardTaskStatus,
  CreateTaskPayload,
  ProjectActivity,
  ProjectBoard,
  ProjectBoardProjectOption,
  ProjectBoardSprintOption,
  ProjectTaskAssignee,
  TaskCard,
  TaskPriority,
  UpdateTaskPayload,
} from "@/types/features/project-board";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  CircleDot,
  Clock3,
  LayoutGrid,
  List,
  LoaderCircle,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";

const COLUMN_ORDER = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"];

const COLUMN_STYLES: Record<
  string,
  { accent: string; icon: typeof Circle; badge: string; background: string }
> = {
  BACKLOG: {
    accent: "bg-slate-400",
    icon: Circle,
    badge: "bg-slate-100 text-slate-700",
    background: "bg-slate-50/80",
  },
  TODO: {
    accent: "bg-sky-500",
    icon: Circle,
    badge: "bg-sky-100 text-sky-800",
    background: "bg-sky-50/70",
  },
  IN_PROGRESS: {
    accent: "bg-violet-500",
    icon: CircleDot,
    badge: "bg-violet-100 text-violet-800",
    background: "bg-violet-50/60",
  },
  REVIEW: {
    accent: "bg-amber-500",
    icon: Clock3,
    badge: "bg-amber-100 text-amber-800",
    background: "bg-amber-50/70",
  },
  DONE: {
    accent: "bg-emerald-500",
    icon: Check,
    badge: "bg-emerald-100 text-emerald-800",
    background: "bg-emerald-50/70",
  },
  BLOCKED: {
    accent: "bg-rose-500",
    icon: AlertCircle,
    badge: "bg-rose-100 text-rose-800",
    background: "bg-rose-50/70",
  },
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: "border-slate-200 bg-slate-50 text-slate-600",
  MEDIUM: "border-blue-200 bg-blue-50 text-blue-700",
  HIGH: "border-orange-200 bg-orange-50 text-orange-700",
  CRITICAL: "border-rose-200 bg-rose-50 text-rose-700",
};

const EMPTY_TASK_FORM = {
  title: "",
  description: "",
  estimatedHours: "",
  priority: "",
  assigneeProjectMemberId: "",
};

function getBoardError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return {
      title: "Không thể tải Board",
      message: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.",
      status: undefined,
    };
  }

  const status = error.response?.status;
  const responseMessage =
    typeof error.response?.data?.message === "string"
      ? error.response.data.message
      : typeof error.response?.data?.detail === "string"
        ? error.response.data.detail
        : undefined;

  if (status === 401) {
    return {
      title: "Phiên đăng nhập không hợp lệ",
      message: "Vui lòng đăng nhập lại để tiếp tục xem bảng công việc.",
      status,
    };
  }
  if (status === 403) {
    return {
      title: "Bạn không có quyền truy cập",
      message: "Tài khoản không thuộc tenant hoặc không phải thành viên của Project này.",
      status,
    };
  }
  if (status === 404) {
    return {
      title: "Không tìm thấy Project hoặc Sprint",
      message: "Kiểm tra lại ID Project và Sprint. Không có dữ liệu từ Project khác được hiển thị.",
      status,
    };
  }
  if (!error.response) {
    return {
      title: "Không kết nối được máy chủ",
      message: "Kiểm tra backend có đang chạy tại URL API được cấu hình hay không.",
      status,
    };
  }

  return {
    title: "Tải Board thất bại",
    message: responseMessage ?? `Máy chủ trả về lỗi HTTP ${status ?? "không xác định"}.`,
    status,
  };
}

function formatDate(value: string | null) {
  if (!value) return "Chưa thiết lập";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ngày không hợp lệ";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatActivityState(value: string) {
  try {
    const state = JSON.parse(value) as Record<string, unknown>;
    if (typeof state.status === "string") {
      const version = typeof state.version === "number" ? ` · v${state.version}` : "";
      const task = typeof state.title === "string"
        ? `${typeof state.code === "string" ? `${state.code} · ` : ""}${state.title} · `
        : "";
      return `${task}${state.status.replaceAll("_", " ")}${version}`;
    }
  } catch {
    return value;
  }
  return value;
}

declare global {
  interface Window {
    dragTask: TaskCard | null;
  }
}

function TaskCardView({
  task,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  task: TaskCard;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const statusStyle = COLUMN_STYLES[task.status] ?? COLUMN_STYLES.TODO;
  const isDraggable = true; // All statuses can be dragged (workflow validated on drop)

  return (
    <article
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md cursor-pointer`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-wide text-slate-500">
          {task.code}
        </span>
        {task.priority && (
          <span
            className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLES[task.priority]}`}
          >
            {task.priority}
          </span>
        )}
      </div>
      <h4 className="mt-2.5 text-sm font-semibold leading-5 text-slate-800">{task.title}</h4>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
          <UserRound className="size-3.5 shrink-0" />
          <span className="truncate">{task.assignee?.displayName ?? "Chưa phân công"}</span>
        </div>
        <Badge className={`shrink-0 border-0 text-[10px] ${statusStyle.badge}`}>
          {task.status.replaceAll("_", " ")}
        </Badge>
      </div>
    </article>
  );
}

function BoardColumnView({
  column,
  onDragOver,
  onDragLeave,
  onDrop,
  onTaskClick,
}: {
  column: BoardColumn;
  onDragOver: (e: React.DragEvent, status: string) => void;
  onDragLeave: (e: React.DragEvent, status: string) => void;
  onDrop: (e: React.DragEvent, status: string) => void;
  onTaskClick: (task: TaskCard) => void;
}) {
  const style = COLUMN_STYLES[column.key] ?? COLUMN_STYLES.BACKLOG;
  const Icon = style.icon;
  const isDragOver = column.isDragOver;

  return (
    <section
      aria-label={`${column.name}, ${column.count} công việc`}
      className={`flex min-h-[25rem] min-w-[10.5rem] flex-col rounded-2xl border border-slate-200/80 ${style.background} p-2 transition-colors ${isDragOver ? "ring-2 ring-sky-400 bg-sky-50" : ""}`}
      onDragOver={(e) => onDragOver(e, column.key)}
      onDragLeave={(e) => onDragLeave(e, column.key)}
      onDrop={(e) => onDrop(e, column.key)}
    >
      <header className="mb-3 flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`size-2.5 shrink-0 rounded-full ${style.accent}`} />
          <h3 className="truncate text-sm font-bold text-slate-800">{column.name}</h3>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {column.count}
          </span>
        </div>
        <Icon className="size-4 shrink-0 text-slate-400" />
      </header>
      <div className="flex flex-1 flex-col gap-2.5">
        {column.tasks.length ? (
          column.tasks.map((task) => (
            <TaskCardView
              key={task.id}
              task={task}
              onDragStart={(_e) => {
                window.dragTask = task;
              }}
              onDragEnd={() => {
                window.dragTask = null;
              }}
              onClick={() => onTaskClick(task)}
            />
          ))
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/45 px-3 text-center text-xs text-slate-400">
            Chưa có công việc
          </div>
        )}
      </div>
    </section>
  );
}

function ActivityItem({ item }: { item: ProjectActivity }) {
  const details = [
    item.entityType,
    item.entityId ? `#${item.entityId}` : null,
  ].filter(Boolean).join(" ");

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-slate-200 last:hidden" />
      <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sky-700">
        <Activity className="size-4" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-slate-800">
            {item.actorDisplayName ?? "Thành viên"}{" "}
            <span className="font-normal text-slate-600">{formatAction(item.actionType)}</span>
          </p>
          <time className="text-xs text-slate-400">{formatDateTime(item.occurredAt)}</time>
        </div>
        {details && <p className="mt-1 text-xs text-slate-500">{details}</p>}
        {(item.beforeState || item.afterState) && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {item.beforeState && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                <ArrowLeft className="size-3" />
                {formatActivityState(item.beforeState)}
              </span>
            )}
            {item.afterState && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">
                <ArrowUp className="size-3" />
                {formatActivityState(item.afterState)}
              </span>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function LoadingBoard() {
  return (
    <div aria-label="Đang tải Board" aria-busy="true" className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {COLUMN_ORDER.map((column) => (
          <div key={column} className="min-h-72 animate-pulse rounded-2xl bg-slate-100 p-3">
            <div className="h-5 w-28 rounded bg-slate-200" />
            <div className="mt-5 h-24 rounded-xl bg-white" />
            <div className="mt-3 h-24 rounded-xl bg-white" />
          </div>
        ))}
      </div>
      <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="size-4 animate-spin" />
        Đang tải dữ liệu Board…
      </p>
    </div>
  );
}

export default function ProjectBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [projectId, setProjectId] = useState(searchParams.get("projectId") ?? "");
  const [sprintId, setSprintId] = useState(searchParams.get("sprintId") ?? "");
  const [projectOptions, setProjectOptions] = useState<ProjectBoardProjectOption[]>([]);
  const [sprintOptions, setSprintOptions] = useState<ProjectBoardSprintOption[]>([]);
  const [projectOptionsLoading, setProjectOptionsLoading] = useState(true);
  const [sprintOptionsLoading, setSprintOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [board, setBoard] = useState<ProjectBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<ReturnType<typeof getBoardError> | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const [formError, setFormError] = useState("");
  const [showCreateNotice, setShowCreateNotice] = useState(false);
  const [createTaskForm, setCreateTaskForm] = useState(EMPTY_TASK_FORM);
  const [createTaskErrors, setCreateTaskErrors] = useState<Record<string, string>>({});
  const [createTaskError, setCreateTaskError] = useState("");
  const [createTaskBusy, setCreateTaskBusy] = useState(false);
  const [assignees, setAssignees] = useState<ProjectTaskAssignee[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(false);
  const [assigneesError, setAssigneesError] = useState("");
  const [memberFilter, setMemberFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [editingTask, setEditingTask] = useState<TaskCard | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; description: string; estimatedHours: string; priority: string; assigneeProjectMemberId: string }>({
    title: "",
    description: "",
    estimatedHours: "",
    priority: "",
    assigneeProjectMemberId: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<TaskCard | null>(null);
  const columnDragOverRef = useRef<Set<string>>(new Set());

  const searchKey = searchParams.toString();
  const requestIds = useMemo(() => {
    const query = new URLSearchParams(searchKey);
    const parsedProjectId = Number(query.get("projectId"));
    const parsedSprintId = Number(query.get("sprintId"));
    return Number.isSafeInteger(parsedProjectId) && parsedProjectId > 0
      && Number.isSafeInteger(parsedSprintId) && parsedSprintId > 0
      ? { projectId: parsedProjectId, sprintId: parsedSprintId }
      : null;
  }, [searchKey]);

  useEffect(() => {
    let cancelled = false;
    setProjectOptionsLoading(true);
    projectBoardApi.getBoardProjects()
      .then((projects) => {
        if (!cancelled) setProjectOptions(projects);
      })
      .catch(() => {
        if (!cancelled) setOptionsError("Không tải được danh sách Project. Hãy thử tải lại trang.");
      })
      .finally(() => {
        if (!cancelled) setProjectOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const parsedProjectId = Number(projectId);
    if (!Number.isSafeInteger(parsedProjectId) || parsedProjectId <= 0) {
      setSprintOptions([]);
      setSprintId("");
      return;
    }

    let cancelled = false;
    setSprintOptionsLoading(true);
    setOptionsError("");
    projectBoardApi.getBoardSprints(parsedProjectId)
      .then((sprints) => {
        if (!cancelled) setSprintOptions(sprints);
      })
      .catch(() => {
        if (!cancelled) {
          setSprintOptions([]);
          setOptionsError("Không tải được Sprint của Project này. Hãy kiểm tra quyền truy cập rồi thử lại.");
        }
      })
      .finally(() => {
        if (!cancelled) setSprintOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    setProjectId(searchParams.get("projectId") ?? "");
    setSprintId(searchParams.get("sprintId") ?? "");
  }, [searchKey, searchParams]);

  useEffect(() => {
    if (!requestIds) return;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setBoard(null);
    projectBoardApi.getBoard(requestIds.projectId, requestIds.sprintId)
      .then((data) => {
        if (!cancelled) setBoard(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(getBoardError(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [requestIds, requestVersion]);

  useEffect(() => {
    if (!showCreateNotice || !board) return;
    let cancelled = false;
    setAssigneesLoading(true);
    setAssigneesError("");
    projectBoardApi.getTaskAssignees(board.projectId)
      .then((data) => {
        if (!cancelled) setAssignees(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAssigneesError(
          axios.isAxiosError(error) && error.response?.status === 403
            ? "Bạn không thuộc phạm vi Project này nên không thể tải danh sách thành viên."
            : "Không tải được danh sách thành viên. Bạn vẫn có thể tạo Task chưa phân công.",
        );
        setAssignees([]);
      })
      .finally(() => {
        if (!cancelled) setAssigneesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [board, showCreateNotice]);

  const orderedColumns = useMemo(() => {
    if (!board) return [];
    return [...board.columns].sort(
      (left, right) => COLUMN_ORDER.indexOf(left.key) - COLUMN_ORDER.indexOf(right.key),
    );
  }, [board]);

  const memberOptions = useMemo(() => {
    const members = new Map<number, string>();
    orderedColumns.flatMap((column) => column.tasks).forEach((task) => {
      if (task.assignee) members.set(task.assignee.id, task.assignee.displayName);
    });
    return [...members.entries()].sort((left, right) => left[1].localeCompare(right[1], "vi"));
  }, [orderedColumns]);

  const visibleColumns = useMemo(
    () => orderedColumns.map((column) => {
      const tasks = column.tasks.filter((task) => {
        if (memberFilter === "ALL") return true;
        if (memberFilter === "UNASSIGNED") return task.assignee === null;
        return task.assignee?.id === Number(memberFilter);
      });
      return { ...column, tasks, count: tasks.length, isDragOver: columnDragOverRef.current.has(column.key) };
    }),
    [orderedColumns, memberFilter],
  );

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    columnDragOverRef.current.add(status);
    setBoard((prev) => prev ? { ...prev, columns: prev.columns.map((c) => (c.key === status ? { ...c, isDragOver: true } : c)) } : null);
  };

  const handleDragLeave = (e: React.DragEvent, status: string) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      columnDragOverRef.current.delete(status);
      setBoard((prev) => prev ? { ...prev, columns: prev.columns.map((c) => (c.key === status ? { ...c, isDragOver: false } : c)) } : null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();
    columnDragOverRef.current.delete(targetColumnKey);
    const task = window.dragTask;
    if (!task) {
      console.warn("handleDrop: no dragTask");
      return;
    }

    console.log("handleDrop:", { targetColumnKey, taskId: task.id, taskStatus: task.status, taskSprintId: task.sprintId });

    const validStatuses: BoardTaskStatus[] = ["TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"];
    const isTargetBacklog = targetColumnKey === "BACKLOG";
    const isTargetStatus = validStatuses.includes(targetColumnKey as BoardTaskStatus);

    // If dragging to BACKLOG column -> move task out of sprint (set sprintId = null)
    if (isTargetBacklog) {
      if (task.sprintId === null) {
        console.log("Task already in backlog");
        window.dragTask = null;
        return;
      }
      try {
        await projectBoardApi.moveTaskToSprint(board!.projectId, task.id, { sprintId: null, expectedVersion: task.version }, crypto.randomUUID());
        toast.success(`${task.code}: đã chuyển về Backlog`);
        setRequestVersion((v) => v + 1);
      } catch (error) {
        console.error("moveTaskToSprint error:", error);
        if (axios.isAxiosError(error)) {
          console.error("Response data:", error.response?.data);
          console.error("Response status:", error.response?.status);
        }
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          toast.error("Task đã thay đổi. Đang tải lại...");
          setRequestVersion((v) => v + 1);
        } else {
          toast.error(error instanceof Error ? error.message : "Không thể chuyển về Backlog.");
        }
      } finally {
        window.dragTask = null;
      }
      return;
    }

    // If dragging to a status column
    if (isTargetStatus) {
      const targetStatus = targetColumnKey as BoardTaskStatus;
      
      // Check if status actually changes
      if (task.status === targetStatus) {
        window.dragTask = null;
        return;
      }

      // Check workflow validity before calling API
      if (!isValidTransition(task.status, targetStatus)) {
        toast.error(`Không thể chuyển từ ${task.status.replaceAll("_", " ")} sang ${targetStatus.replaceAll("_", " ")}`);
        window.dragTask = null;
        return;
      }

      try {
        await projectBoardApi.updateTaskStatus(board!.projectId, task.id, targetStatus, task.version, crypto.randomUUID());
        toast.success(`${task.code}: đã chuyển sang ${targetStatus.replaceAll("_", " ")}`);
        setRequestVersion((v) => v + 1);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          toast.error("Task đã thay đổi hoặc version không khớp. Đang tải lại...");
          setRequestVersion((v) => v + 1);
        } else {
          toast.error("Không thể cập nhật trạng thái.");
        }
      } finally {
        window.dragTask = null;
      }
    }
  };

  // Workflow validation matching backend TaskStatusWorkflow
  const isValidTransition = (from: BoardTaskStatus, to: BoardTaskStatus): boolean => {
    const transitions: Record<BoardTaskStatus, BoardTaskStatus[]> = {
      TODO: ["IN_PROGRESS", "BLOCKED"],
      IN_PROGRESS: ["REVIEW", "BLOCKED", "TODO"],
      REVIEW: ["DONE", "BLOCKED", "IN_PROGRESS"],
      BLOCKED: ["TODO", "IN_PROGRESS"],
      DONE: ["IN_PROGRESS"], // Reopen (exceptional case)
    };
    return transitions[from]?.includes(to) ?? false;
  };

  const openEditModal = (task: TaskCard) => {
    setEditingTask(task);
    setEditForm({
      title: task.title,
      description: "",
      estimatedHours: "",
      priority: task.priority ?? "",
      assigneeProjectMemberId: task.assignee?.id?.toString() ?? "",
    });
    setEditErrors({});
    setEditError("");
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || editBusy) return;
    setEditErrors({});
    setEditError("");
    const payload: UpdateTaskPayload = {
      title: editForm.title.trim(),
      description: editForm.description.trim() || undefined,
      estimatedHours: editForm.estimatedHours ? Number(editForm.estimatedHours) : undefined,
      priority: editForm.priority as TaskPriority | undefined,
      assigneeProjectMemberId: editForm.assigneeProjectMemberId ? Number(editForm.assigneeProjectMemberId) : null,
    };
    setEditBusy(true);
    try {
      await projectBoardApi.updateTask(board!.projectId, editingTask.id, payload);
      toast.success("Đã cập nhật công việc");
      setEditingTask(null);
      setRequestVersion((v) => v + 1);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        const errs = error.response.data?.errors;
        if (errs) setEditErrors(Object.fromEntries(Object.entries(errs).map(([k, v]) => [k, (v as string[])[0]])));
        setEditError("Kiểm tra các trường bị lỗi.");
      } else {
        setEditError("Không thể cập nhật task.");
      }
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteConfirmTask || !board) return;
    try {
      await projectBoardApi.deleteTask(board.projectId, deleteConfirmTask.id);
      toast.success("Đã xóa công việc");
      setDeleteConfirmTask(null);
      setRequestVersion((v) => v + 1);
    } catch {
      toast.error("Không thể xóa task (chỉ xóa được task ở trạng thái BACKLOG).");
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedProjectId = Number(projectId.trim());
    const parsedSprintId = Number(sprintId.trim());

    if (!Number.isSafeInteger(parsedProjectId) || parsedProjectId < 1
      || !Number.isSafeInteger(parsedSprintId) || parsedSprintId < 1) {
      setFormError("Project ID và Sprint ID phải là số nguyên dương.");
      return;
    }

    setFormError("");
    setSearchParams({ projectId: String(parsedProjectId), sprintId: String(parsedSprintId) });
    setBoard(null);
    setRequestVersion((version) => version + 1);
  };

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!board || createTaskBusy) return;

    setCreateTaskErrors({});
    setCreateTaskError("");

    const payload: CreateTaskPayload = {
      title: createTaskForm.title.trim(),
      description: createTaskForm.description.trim() || undefined,
      estimatedHours: createTaskForm.estimatedHours
        ? Number(createTaskForm.estimatedHours)
        : undefined,
      priority: createTaskForm.priority
        ? createTaskForm.priority as TaskPriority
        : undefined,
      assigneeProjectMemberId: createTaskForm.assigneeProjectMemberId
        ? Number(createTaskForm.assigneeProjectMemberId)
        : undefined,
    };

    setCreateTaskBusy(true);
    try {
      const task = await projectBoardApi.createTask(
        board.projectId,
        board.sprint.id,
        payload,
        crypto.randomUUID(),
      );
      toast.success(`Đã tạo công việc ${task.code}`);
      setShowCreateNotice(false);
      setCreateTaskForm(EMPTY_TASK_FORM);
      setRequestVersion((version) => version + 1);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        const responseErrors = error.response.data?.errors;
        if (responseErrors && typeof responseErrors === "object") {
          setCreateTaskErrors(
            Object.fromEntries(
              Object.entries(responseErrors as Record<string, string[]>)
                .map(([field, messages]) => [field, messages[0] ?? "Giá trị không hợp lệ"]),
            ),
          );
        }
        setCreateTaskError("Kiểm tra các trường được đánh dấu. Thông tin bạn đã nhập vẫn được giữ lại.");
      } else if (axios.isAxiosError(error) && error.response?.status === 403) {
        setCreateTaskError("Bạn không thuộc phạm vi Project này nên không thể tạo Task. Dữ liệu đã nhập vẫn được giữ lại.");
      } else if (axios.isAxiosError(error) && error.response?.status === 404) {
        setCreateTaskError("Không tìm thấy Project hoặc Sprint. Hãy quay lại Board và kiểm tra lại.");
      } else {
        setCreateTaskError("Không thể lưu Task. Thông tin đã nhập vẫn được giữ lại; hãy thử lại sau.");
      }
    } finally {
      setCreateTaskBusy(false);
    }
  };

  const allTasksCount = orderedColumns.reduce((count, column) => count + column.count, 0);
  const visibleTasksCount = visibleColumns.reduce((count, column) => count + column.count, 0);
  const sprintTaskCount = orderedColumns
    .filter((column) => column.key !== "BACKLOG")
    .reduce((count, column) => count + column.count, 0);
  const doneTaskCount = orderedColumns.find((column) => column.key === "DONE")?.count ?? 0;
  const blockedTaskCount = orderedColumns.find((column) => column.key === "BLOCKED")?.count ?? 0;
  const completionPercent = sprintTaskCount > 0
    ? Math.round((doneTaskCount / sprintTaskCount) * 100)
    : 0;
  const error = loadError;
  const hasRequest = requestIds !== null;

  return (
    <MainLayout pathName={{ "/project-board": "Bảng công việc" }}>
      <div className="mx-auto w-full max-w-[1800px] space-y-5 pb-8">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-sky-100/70 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1.5 border-0 bg-sky-100 text-sky-800 hover:bg-sky-100">
                  <Sparkles className="size-3" />
                  PROJECT WORKSPACE
                </Badge>
                <span className="text-xs font-medium text-slate-400">UFR-PRJ-005 · Sprint Board</span>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Bảng công việc
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Theo dõi tiến độ công việc trong Sprint. Mở Board không làm thay đổi dữ liệu; thành viên Project có thể cập nhật trạng thái qua List.
              </p>
              {board && (
                <div className="mt-4 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm" aria-label="Chế độ xem công việc">
                  <Button
                    aria-pressed={viewMode === "board"}
                    className={viewMode === "board" ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-600"}
                    onClick={() => setViewMode("board")}
                    size="sm"
                    variant="ghost"
                  >
                    <LayoutGrid className="size-4" />
                    Board View
                  </Button>
                  <Button
                    aria-pressed={viewMode === "list"}
                    className={viewMode === "list" ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-600"}
                    onClick={() => setViewMode("list")}
                    size="sm"
                    variant="ghost"
                  >
                    <List className="size-4" />
                    List View
                  </Button>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="grid w-full gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-[1fr_1fr_auto] xl:max-w-[760px]">
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Project
                </span>
                <select
                  aria-label="Chọn Project"
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900"
                  disabled={projectOptionsLoading}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setSprintId("");
                    setSprintOptions([]);
                    setOptionsError("");
                  }}
                  value={projectId}
                >
                  <option className="bg-white text-slate-900" value="">
                    {projectOptionsLoading ? "Đang tải Project…" : "Chọn Project"}
                  </option>
                  {projectOptions.map((project) => (
                    <option className="bg-white text-slate-900" key={project.id} value={project.id}>
                      {project.code} · {project.name} (#{project.id})
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Sprint
                </span>
                <select
                  aria-label="Chọn Sprint"
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-900"
                  disabled={!projectId || sprintOptionsLoading || sprintOptions.length === 0}
                  onChange={(event) => setSprintId(event.target.value)}
                  value={sprintId}
                >
                  <option className="bg-white text-slate-900" value="">
                    {!projectId
                      ? "Chọn Project trước"
                      : sprintOptionsLoading
                        ? "Đang tải Sprint…"
                        : sprintOptions.length
                          ? "Chọn Sprint"
                          : "Project chưa có Sprint"}
                  </option>
                  {sprintOptions.map((sprint) => (
                    <option className="bg-white text-slate-900" key={sprint.id} value={sprint.id}>
                      {sprint.name} · {sprint.status} (#{sprint.id})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <Button
                  className="w-full bg-slate-900 text-white hover:bg-slate-700 sm:w-auto"
                  disabled={!projectId || !sprintId || sprintOptionsLoading}
                  type="submit"
                >
                  <RefreshCw className="size-4" />
                  Mở Board
                </Button>
              </div>
            </form>
          </div>
          {formError && (
            <p role="alert" className="relative mt-2 text-sm font-medium text-rose-600">{formError}</p>
          )}
          {optionsError && (
            <p role="alert" className="relative mt-2 text-sm font-medium text-rose-600">{optionsError}</p>
          )}
          <div className="relative mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-emerald-600" />
              Phạm vi dữ liệu được xác thực ở backend
            </span>
            <span className="inline-flex items-center gap-1.5">
              <LockKeyhole className="size-3.5" />
            Cần đăng nhập và thuộc Project để truy cập
            </span>
          </div>
        </section>

        {!hasRequest ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <Activity className="size-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-800">Chọn Project và Sprint</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Chọn Project và Sprint trong danh sách để mở Board. Danh sách chỉ gồm Project thuộc phạm vi truy cập của tài khoản.
            </p>
          </section>
        ) : loading || (hasRequest && !board && !error) ? (
          <LoadingBoard />
        ) : error ? (
          <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 sm:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm">
                {error.status === 403 ? <LockKeyhole className="size-5" /> : <AlertCircle className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-rose-950">{error.title}</p>
                <p className="mt-1 text-sm leading-6 text-rose-800">{error.message}</p>
                {error.status === 403 && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link to="/student" className="inline-flex items-center gap-1 text-sm font-semibold text-rose-900 underline underline-offset-4">
                      <ArrowLeft className="size-4" />
                      Quay lại
                    </Link>
                    <span className="text-xs text-rose-700">
                      Hãy chọn Project bạn là thành viên hoặc được phân công hỗ trợ.
                    </span>
                  </div>
                )}
                {error.status === 404 && (
                  <Link to="/student" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-900 underline underline-offset-4">
                    <ArrowLeft className="size-4" />
                    Quay lại
                  </Link>
                )}
                {error.status === 401 && (
                  <Link to="/login" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-rose-900 underline underline-offset-4">
                    <ArrowLeft className="size-4" />
                    Đăng nhập lại
                  </Link>
                )}
              </div>
              <Button
                className="shrink-0 border-rose-200 bg-white text-rose-900 hover:bg-rose-100"
                onClick={() => setRequestVersion((version) => version + 1)}
                variant="outline"
              >
                <RefreshCw className="size-4" />
                Thử lại
              </Button>
            </div>
          </section>
        ) : board ? (
          <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
                    <LayoutGrid className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-blue-800">
                        FAMS · Project #{board.projectId}
                      </span>
                      <Badge className="border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Sprint Board
                      </Badge>
                    </div>
                    <h2 className="mt-1 truncate text-xl font-bold text-slate-900">{board.sprint.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                      {board.sprint.sprintGoal || "Sprint chưa có mục tiêu"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <span className="block font-semibold text-slate-800">Sprint #{board.sprint.id}</span>
                    <span className="mt-0.5 inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {formatDate(board.sprint.startDate)} – {formatDate(board.sprint.endDate)}
                    </span>
                  </div>
                  <Button onClick={() => setShowCreateNotice(true)} className="bg-blue-800 text-white hover:bg-blue-700">
                    <Plus className="size-4" />
                    New Task
                  </Button>
                  <Button
                    aria-label="Tải lại Board"
                    className="size-9"
                    onClick={() => setRequestVersion((version) => version + 1)}
                    size="icon"
                    variant="outline"
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50/70 sm:grid-cols-4">
                <div className="border-b border-r border-slate-100 px-4 py-3 sm:border-b-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sprint tasks</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{sprintTaskCount}</p>
                </div>
                <div className="border-b border-slate-100 px-4 py-3 sm:border-b-0 sm:border-r">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Done</p>
                  <p className="mt-1 flex items-center gap-2 text-lg font-bold text-emerald-700">
                    {doneTaskCount}
                    <span className="text-xs font-medium text-slate-500">/ {sprintTaskCount} tasks</span>
                  </p>
                </div>
                <div className="border-r border-slate-100 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Completion</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div
                      aria-label={`Hoàn thành ${completionPercent}%`}
                      className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
                      role="progressbar"
                      aria-valuenow={completionPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${completionPercent}%` }} />
                    </div>
                    <span className="text-xs font-bold text-emerald-700">{completionPercent}%</span>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Blocked</p>
                  <p className="mt-1 flex items-center gap-2 text-lg font-bold text-rose-700">
                    {blockedTaskCount}
                    <span className="text-xs font-medium text-slate-500">tasks</span>
                  </p>
                </div>
              </div>
            </section>

            {allTasksCount === 0 && (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                <p><strong>Chưa có công việc.</strong> Sprint và Project đã tải thành công; tất cả cột đang trống.</p>
              </div>
            )}
            {allTasksCount > 0 && visibleTasksCount === 0 && (
              <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span>Không có công việc phù hợp với thành viên đang chọn.</span>
                <Button onClick={() => setMemberFilter("ALL")} size="sm" variant="outline">
                  Xóa bộ lọc
                </Button>
              </div>
            )}

            <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_19rem]">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                  <label className="relative flex min-w-48 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
                    <UserRound className="size-4 shrink-0 text-slate-400" />
                    <select
                      aria-label="Lọc theo người phụ trách"
                      className="h-9 w-full appearance-none bg-transparent pr-5 text-sm text-slate-700 outline-none"
                      onChange={(event) => setMemberFilter(event.target.value)}
                      value={memberFilter}
                    >
                      <option value="ALL">Tất cả thành viên</option>
                      <option value="UNASSIGNED">Chưa phân công</option>
                      {memberOptions.map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 size-4 text-slate-400" />
                  </label>
                </div>

                {memberFilter !== "ALL" && (
                  <p role="status" className="mb-2 text-xs text-slate-500">
                    Đang hiển thị {visibleTasksCount} / {allTasksCount} công việc theo bộ lọc thành viên.
                  </p>
                )}

                {viewMode === "board" ? (
                  <div aria-label="Các cột công việc" className="overflow-x-auto pb-2">
                    <div className="grid min-w-[1120px] grid-cols-6 items-stretch gap-2">
                      {visibleColumns.map((column) => (
                        <BoardColumnView
                          key={column.key}
                          column={column}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onTaskClick={openEditModal}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <ProjectTaskListView
                    canUpdateTask
                    memberFilter={memberFilter}
                    onTaskChanged={() => setRequestVersion((version) => version + 1)}
                    projectId={board.projectId}
                    sprintId={board.sprint.id}
                  />
                )}
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm 2xl:max-h-[38rem] 2xl:overflow-y-auto">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                        <Activity className="size-4" />
                      </span>
                      <h2 className="font-bold text-slate-900">Activity Trail</h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Lịch sử gần đây · chỉ đọc</p>
                  </div>
                  <Badge variant="outline">{board.activityTrail.length}</Badge>
                </div>
                {board.activityTrail.length ? (
                  <ol className="mt-5">
                    {board.activityTrail.map((item) => <ActivityItem key={item.id} item={item} />)}
                  </ol>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-3 py-7 text-center text-sm text-slate-500">
                    Chưa có hoạt động nào được ghi nhận.
                  </div>
                )}
                <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
                  <TrendingUp className="size-3.5" />
                  Chỉ hiển thị activity thuộc Project này
                </div>
              </aside>
            </section>
          </>
        ) : (
          <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Không thể tải Board. Hãy kiểm tra lại ID hoặc thử tải lại.
          </section>
        )}

        {showCreateNotice && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
            onClick={() => setShowCreateNotice(false)}
            role="presentation"
          >
            <section
              aria-labelledby="create-task-notice-title"
              aria-modal="true"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <form onSubmit={handleCreateTask}>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                    <Plus className="size-5" />
                  </span>
                  <div>
                    <h2 id="create-task-notice-title" className="text-lg font-bold text-slate-900">
                      Tạo công việc
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Project #{board?.projectId} · {board?.sprint.name}
                    </p>
                  </div>
                </div>

                {createTaskError && (
                  <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {createTaskError}
                  </p>
                )}
                {assigneesError && (
                  <p role="status" className="mt-3 text-xs text-amber-700">{assigneesError}</p>
                )}

                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Tên công việc *</span>
                    <Input
                      autoFocus
                      maxLength={255}
                      onChange={(event) => setCreateTaskForm((form) => ({ ...form, title: event.target.value }))}
                      required
                      value={createTaskForm.title}
                    />
                    {createTaskErrors.title && <span className="mt-1 block text-xs text-rose-600">{createTaskErrors.title}</span>}
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Mô tả</span>
                    <textarea
                      className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                      maxLength={1000}
                      onChange={(event) => setCreateTaskForm((form) => ({ ...form, description: event.target.value }))}
                      value={createTaskForm.description}
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Estimate (giờ)</span>
                      <Input
                        min="0.01"
                        onChange={(event) => setCreateTaskForm((form) => ({ ...form, estimatedHours: event.target.value }))}
                        step="any"
                        type="number"
                        value={createTaskForm.estimatedHours}
                      />
                      {createTaskErrors.estimatedHours && <span className="mt-1 block text-xs text-rose-600">{createTaskErrors.estimatedHours}</span>}
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Độ ưu tiên</span>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        onChange={(event) => setCreateTaskForm((form) => ({ ...form, priority: event.target.value }))}
                        value={createTaskForm.priority}
                      >
                        <option value="">Chưa đặt</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Người phụ trách</span>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      disabled={assigneesLoading}
                      onChange={(event) => setCreateTaskForm((form) => ({ ...form, assigneeProjectMemberId: event.target.value }))}
                      value={createTaskForm.assigneeProjectMemberId}
                    >
                      <option value="">{assigneesLoading ? "Đang tải thành viên…" : "Chưa phân công"}</option>
                      {assignees.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>{assignee.displayName}</option>
                      ))}
                    </select>
                    {createTaskErrors.assigneeProjectMemberId && (
                      <span className="mt-1 block text-xs text-rose-600">{createTaskErrors.assigneeProjectMemberId}</span>
                    )}
                  </label>
                  <p className="text-xs leading-5 text-slate-500">
                    Task mới được tạo ở trạng thái TODO. Tag và dependency chưa có domain/API trong phiên bản này.
                  </p>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <Button
                    disabled={createTaskBusy}
                    onClick={() => setShowCreateNotice(false)}
                    type="button"
                    variant="outline"
                  >
                    Hủy
                  </Button>
                  <Button disabled={createTaskBusy} type="submit">
                    {createTaskBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    {createTaskBusy ? "Đang lưu…" : "Tạo Task"}
                  </Button>
                </div>
              </form>
            </section>
          </div>
        )}

        {editingTask && board && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setEditingTask(null)} role="presentation">
            <section aria-labelledby="edit-task-title" aria-modal="true" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog">
              <form onSubmit={handleEditTask}>
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Save className="size-5" /></span>
                  <div>
                    <h2 id="edit-task-title" className="text-lg font-bold text-slate-900">Chỉnh sửa công việc</h2>
                    <p className="mt-1 text-sm text-slate-500">Project #{board.projectId} · {board.sprint.name}</p>
                  </div>
                </div>

                {editError && <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{editError}</p>}

                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Tên công việc *</span>
                    <Input autoFocus maxLength={255} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required value={editForm.title} />
                    {editErrors.title && <span className="mt-1 block text-xs text-rose-600">{editErrors.title}</span>}
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Mô tả</span>
                    <textarea className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]" maxLength={1000} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} value={editForm.description ?? ""} />
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Estimate (giờ)</span>
                      <Input min="0.01" onChange={(e) => setEditForm((f) => ({ ...f, estimatedHours: e.target.value }))} step="any" type="number" value={editForm.estimatedHours} />
                      {editErrors.estimatedHours && <span className="mt-1 block text-xs text-rose-600">{editErrors.estimatedHours}</span>}
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Độ ưu tiên</span>
                      <select className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value }))} value={editForm.priority}>
                        <option value="">Chưa đặt</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Người phụ trách</span>
                    <select className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" onChange={(e) => setEditForm((f) => ({ ...f, assigneeProjectMemberId: e.target.value }))} value={editForm.assigneeProjectMemberId}>
                      <option value="">Chưa phân công</option>
                      {assignees.map((assignee) => (<option key={assignee.id} value={assignee.id}>{assignee.displayName}</option>))}
                    </select>
                    {editErrors.assigneeProjectMemberId && <span className="mt-1 block text-xs text-rose-600">{editErrors.assigneeProjectMemberId}</span>}
                  </label>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-500">Trạng thái: <strong>{editingTask.status.replaceAll("_", " ")}</strong> · Version: {editingTask.version}</span>
                    <Button type="button" variant="destructive" size="sm" onClick={() => { setEditingTask(null); setDeleteConfirmTask(editingTask); }}><Trash2 className="size-3.5" /> Xóa</Button>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <Button disabled={editBusy} onClick={() => setEditingTask(null)} type="button" variant="outline">Hủy</Button>
                  <Button disabled={editBusy} type="submit">{editBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{editBusy ? "Đang lưu…" : "Lưu thay đổi"}</Button>
                </div>
              </form>
            </section>
          </div>
        )}

        {deleteConfirmTask && board && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setDeleteConfirmTask(null)} role="presentation">
            <section aria-labelledby="delete-confirm-title" aria-modal="true" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700"><Trash2 className="size-5" /></span>
                <div>
                  <h2 id="delete-confirm-title" className="text-lg font-bold text-slate-900">Xóa công việc</h2>
                  <p className="mt-1 text-sm text-slate-500">{deleteConfirmTask.code} · {deleteConfirmTask.title}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600">Chỉ có thể xóa task ở trạng thái BACKLOG. Bạn có chắc chắn?</p>
              <div className="mt-6 flex justify-end gap-2">
                <Button onClick={() => setDeleteConfirmTask(null)} variant="outline">Hủy</Button>
                <Button onClick={handleDeleteTask} variant="destructive"><Trash2 className="size-3.5" /> Xóa</Button>
              </div>
            </section>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
