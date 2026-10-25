import { projectBoardApi } from "@/api/features/project-board.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Clock3,
  History,
  LoaderCircle,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { Link } from "react-router-dom";
import type {
  BoardTaskStatus,
  ProjectTaskList,
  TaskStatusHistoryItem,
} from "@/types/features/project-board";

const TASK_STATUSES: BoardTaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
  "BLOCKED",
];

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

const STATUS_STYLES: Record<BoardTaskStatus, string> = {
  TODO: "bg-sky-100 text-sky-800",
  IN_PROGRESS: "bg-violet-100 text-violet-800",
  REVIEW: "bg-amber-100 text-amber-800",
  DONE: "bg-emerald-100 text-emerald-800",
  BLOCKED: "bg-rose-100 text-rose-800",
};

type SortField = "code" | "title" | "status" | "priority" | "createdAt" | "updatedAt";

interface ProjectTaskListViewProps {
  projectId: number;
  sprintId: number;
  memberFilter: string;
  canUpdateTask: boolean;
  onTaskChanged: () => void;
}

function statusLabel(status: BoardTaskStatus) {
  return status.replaceAll("_", " ");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function errorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return "Không thể tải dữ liệu. Vui lòng thử lại.";
  if (error.response?.status === 401) return "Phiên không còn hợp lệ. Vui lòng đăng nhập lại.";
  if (error.response?.status === 403) return "Bạn không có quyền truy cập danh sách công việc này.";
  if (error.response?.status === 404) return "Không tìm thấy Project hoặc Sprint đang yêu cầu.";
  return "Không thể tải danh sách công việc. Vui lòng thử lại.";
}

function ErrorGuidance({ error }: { error: unknown }) {
  if (!axios.isAxiosError(error)) return null;
  if (error.response?.status === 401) {
    return <Link className="font-semibold underline underline-offset-2" to="/login">Đăng nhập lại</Link>;
  }
  if (error.response?.status === 403 || error.response?.status === 404) {
    return <Link className="font-semibold underline underline-offset-2" to="/student">Quay lại</Link>;
  }
  return null;
}

interface RowError {
  message: string;
  cause: unknown;
}

export function ProjectTaskListView({
  projectId,
  sprintId,
  memberFilter,
  canUpdateTask,
  onTaskChanged,
}: ProjectTaskListViewProps) {
  const [data, setData] = useState<ProjectTaskList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [page, setPage] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("code");
  const [sortDirection, setSortDirection] = useState<"ASC" | "DESC">("ASC");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selectedStatuses, setSelectedStatuses] = useState<Record<number, BoardTaskStatus>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, RowError>>({});
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null);
  const [historyTask, setHistoryTask] = useState<{ id: number; code: string; title: string } | null>(null);
  const [history, setHistory] = useState<TaskStatusHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<unknown>(null);

  const query = useMemo(() => ({
    sprintId,
    page,
    size: 10,
    sortBy,
    direction: sortDirection,
    ...(statusFilter ? { status: statusFilter as BoardTaskStatus } : {}),
    ...(search ? { search } : {}),
    ...(memberFilter === "UNASSIGNED"
      ? { unassigned: true }
      : memberFilter !== "ALL"
        ? { assigneeProjectMemberId: Number(memberFilter) }
        : {}),
  }), [memberFilter, page, search, sortBy, sortDirection, sprintId, statusFilter]);
  const queryKey = JSON.stringify(query);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    projectBoardApi.getTasks(projectId, query)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setData(null);
        setLoadError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, queryKey, reloadVersion]);

  useEffect(() => {
    if (!historyTask) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    projectBoardApi.getTaskStatusHistory(projectId, historyTask.id)
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setHistoryError(error);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [historyTask, projectId]);

  const updateStatus = async (task: ProjectTaskList["content"][number]) => {
    const status = selectedStatuses[task.id] ?? task.status;
    if (status === task.status || savingTaskId !== null) return;

    // Client-side workflow validation
    if (!isValidTransition(task.status, status)) {
      const message = `Không thể chuyển từ ${statusLabel(task.status)} sang ${statusLabel(status)}.`;
      setRowErrors((errors) => ({ ...errors, [task.id]: { message, cause: null } }));
      return;
    }

    setSavingTaskId(task.id);
    setRowErrors((errors) => {
      const next = { ...errors };
      delete next[task.id];
      return next;
    });
    try {
      await projectBoardApi.updateTaskStatus(
        projectId,
        task.id,
        status,
        task.version,
        crypto.randomUUID(),
      );
      setSelectedStatuses((statuses) => {
        const next = { ...statuses };
        delete next[task.id];
        return next;
      });
      toast.success(`${task.code}: trạng thái đã được cập nhật.`);
      setReloadVersion((version) => version + 1);
      onTaskChanged();
    } catch (error) {
      const message = axios.isAxiosError(error) && error.response?.status === 409
        ? "Task đã thay đổi hoặc workflow không cho phép trạng thái này. Lựa chọn của bạn được giữ lại; tải dữ liệu mới để đối chiếu."
        : errorMessage(error);
      setRowErrors((errors) => ({ ...errors, [task.id]: { message, cause: error } }));
    } finally {
      setSavingTaskId(null);
    }
  };

  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(0);
  };

  return (
    <section aria-label="Danh sách công việc" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between">
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchDraft.trim());
            setPage(0);
          }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Tìm mã hoặc tên công việc</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-9 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              maxLength={100}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Tìm mã hoặc tên công việc"
              value={searchDraft}
            />
          </label>
          <Button type="submit" variant="outline">Tìm</Button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="task-list-status-filter">Lọc trạng thái</label>
          <select
            className="h-9 rounded-md border border-input bg-white px-2 text-sm"
            id="task-list-status-filter"
            onChange={(event) => changeFilter(setStatusFilter, event.target.value)}
            value={statusFilter}
          >
            <option value="">Tất cả trạng thái</option>
            {TASK_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
          <label className="sr-only" htmlFor="task-list-sort">Sắp xếp theo</label>
          <select
            className="h-9 rounded-md border border-input bg-white px-2 text-sm"
            id="task-list-sort"
            onChange={(event) => {
              setSortBy(event.target.value as SortField);
              setPage(0);
            }}
            value={sortBy}
          >
            <option value="code">Mã công việc</option>
            <option value="title">Tên công việc</option>
            <option value="status">Trạng thái</option>
            <option value="priority">Độ ưu tiên</option>
            <option value="createdAt">Ngày tạo</option>
            <option value="updatedAt">Ngày cập nhật</option>
          </select>
          <Button
            aria-label={sortDirection === "ASC" ? "Sắp xếp tăng dần" : "Sắp xếp giảm dần"}
            onClick={() => setSortDirection((direction) => direction === "ASC" ? "DESC" : "ASC")}
            size="icon"
            variant="outline"
          >
            {sortDirection === "ASC" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
          </Button>
          <Button
            aria-label="Tải lại danh sách"
            onClick={() => setReloadVersion((version) => version + 1)}
            size="icon"
            variant="outline"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div aria-busy="true" aria-label="Đang tải danh sách công việc" className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" />
          Đang tải danh sách công việc…
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-3 p-5 text-sm text-rose-800" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <div className="flex-1">
          <p>{errorMessage(loadError)}</p>
          <ErrorGuidance error={loadError} />
        </div>
          <Button onClick={() => setReloadVersion((version) => version + 1)} size="sm" variant="outline">
            Thử lại
          </Button>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mã / ID công việc</th>
                  <th className="px-4 py-3 font-semibold">Tên công việc</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Người phụ trách</th>
                  <th className="px-4 py-3 font-semibold">Độ ưu tiên</th>
                  <th className="px-4 py-3 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.content.map((task) => {
                  const selectedStatus = selectedStatuses[task.id] ?? task.status;
                  const changed = selectedStatus !== task.status;
                  return (
                    <tr key={task.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <span className="block font-mono text-xs font-semibold text-blue-700">{task.code}</span>
                        <span className="mt-1 block text-[11px] text-slate-400">#{task.id}</span>
                      </td>
                      <td className="max-w-sm px-4 py-3 font-medium text-slate-800">{task.title}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-2">
                          <Badge className={`border-0 ${STATUS_STYLES[task.status]}`}>
                            {statusLabel(task.status)}
                          </Badge>
                          {canUpdateTask && (
                            <select
                              aria-label={`Trạng thái mới cho ${task.code}`}
                              className="h-8 rounded-md border border-input bg-white px-2 text-xs"
                              disabled={savingTaskId !== null}
                              onChange={(event) => setSelectedStatuses((statuses) => ({
                                ...statuses,
                                [task.id]: event.target.value as BoardTaskStatus,
                              }))}
                              value={selectedStatus}
                            >
                              {TASK_STATUSES.map((status) => (
                                <option key={status} value={status}>{statusLabel(status)}</option>
                              ))}
                            </select>
                          )}
                        </div>
                        {rowErrors[task.id] && (
                          <div className="mt-2 max-w-xs text-xs text-rose-700" role="alert">
                            <p>{rowErrors[task.id].message}</p>
                            <ErrorGuidance error={rowErrors[task.id].cause} />
                            <button
                              className="mt-1 font-semibold underline underline-offset-2"
                              onClick={() => setReloadVersion((version) => version + 1)}
                              type="button"
                            >
                              Tải dữ liệu mới
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{task.assignee?.displayName ?? "Chưa phân công"}</td>
                      <td className="px-4 py-3 text-slate-600">{task.priority ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canUpdateTask && (
                            <Button
                              disabled={!changed || savingTaskId !== null}
                              onClick={() => void updateStatus(task)}
                              size="sm"
                            >
                              {savingTaskId === task.id
                                ? <LoaderCircle className="size-3.5 animate-spin" />
                                : <Save className="size-3.5" />}
                              Lưu
                            </Button>
                          )}
                          <Button
                            onClick={() => {
                              setHistory([]);
                              setHistoryTask({ id: task.id, code: task.code, title: task.title });
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <History className="size-3.5" />
                            Lịch sử
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data?.content.length === 0 && (
                  <tr>
                    <td className="px-4 py-12 text-center text-slate-500" colSpan={6}>
                      {data.totalElements === 0
                        ? "Chưa có công việc trong Project/Sprint này."
                        : "Không có công việc phù hợp với bộ lọc."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {data?.totalElements ?? 0} công việc · Trang {(data?.page ?? 0) + 1} / {Math.max(1, data?.totalPages ?? 0)}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={!data || data.page <= 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                size="sm"
                variant="outline"
              >
                Trước
              </Button>
              <Button
                disabled={!data || data.page + 1 >= data.totalPages}
                onClick={() => setPage((current) => current + 1)}
                size="sm"
                variant="outline"
              >
                Sau
              </Button>
            </div>
          </div>
        </>
      )}

      {historyTask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onClick={() => setHistoryTask(null)}
          role="presentation"
        >
          <section
            aria-labelledby="task-history-title"
            aria-modal="true"
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900" id="task-history-title">Lịch sử trạng thái</h2>
                <p className="mt-1 text-sm text-slate-500">{historyTask.code} · {historyTask.title}</p>
              </div>
              <Button aria-label="Đóng lịch sử" onClick={() => setHistoryTask(null)} size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </div>
            {historyLoading ? (
              <div aria-busy="true" className="flex justify-center gap-2 py-10 text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" />
                Đang tải lịch sử…
              </div>
            ) : historyError ? (
              <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">
                {errorMessage(historyError)} <ErrorGuidance error={historyError} />
              </p>
            ) : history.length ? (
              <ol className="mt-5 space-y-4">
                {history.map((item) => (
                  <li className="flex gap-3 border-l-2 border-sky-200 pl-4" key={item.id}>
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-sky-700" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {item.actorDisplayName ?? "Thành viên"} đã đổi {statusLabel(item.previousStatus)} → {statusLabel(item.newStatus)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(item.occurredAt)} · Version {item.previousVersion} → {item.newVersion}
                      </p>
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                        Correlation ID: {item.correlationId ?? "không có"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Chưa có lần thay đổi trạng thái nào được ghi nhận.
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
