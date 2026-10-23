import { taskApi } from "@/api/features/task.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import type { TaskDTO, TaskPriority, TaskStatus } from "@/types/features/task";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ClipboardList, FolderOpen, Plus, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TaskPagination } from "./components/TaskPagination";
import { TaskProjectPicker } from "./components/TaskProjectPicker";
import { TaskTable } from "./components/TaskTable";
import {
  getTaskError,
  isProjectId,
  taskPriorityOptions,
  taskStatusOptions,
} from "./task-form.utils";

export default function TaskManagementPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, activeRole, hasPermission } = usePermissions();
  const projectStorageKey = `task-project:${user.email}`;
  const projectId =
    searchParams.get("projectId") ?? sessionStorage.getItem(projectStorageKey) ?? "";
  const projectSelected = isProjectId(projectId);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState<TaskStatus | "ALL">("ALL");
  const [priority, setPriority] = useState<TaskPriority | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const canCreate = hasPermission("TASK_CREATE");
  const canEdit = hasPermission("TASK_UPDATE");

  useEffect(() => {
    if (projectSelected) sessionStorage.setItem(projectStorageKey, projectId);
  }, [projectId, projectSelected, projectStorageKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const tasksQuery = useQuery({
    queryKey: [
      "tasks",
      user.email,
      activeRole,
      "list",
      projectId,
      page,
      size,
      appliedSearch,
      status,
      priority,
    ],
    queryFn: () =>
      taskApi.getPage({ page, size, sort: "createdAt,desc" }, appliedSearch, {
        projectId,
        status: status === "ALL" ? undefined : status,
        priority: priority === "ALL" ? undefined : priority,
      }),
    enabled: projectSelected && hasPermission("TASK_READ"),
    retry: false,
  });
  const createTask = () => navigate(`/tasks/create?${new URLSearchParams({ projectId })}`);
  const editTask = (task: TaskDTO) => navigate(`/tasks/${task.id}/edit`);
  const hasFilters = !!search || status !== "ALL" || priority !== "ALL";
  const clearFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setStatus("ALL");
    setPriority("ALL");
    setPage(0);
  };

  const selectProject = (id: string) => {
    sessionStorage.setItem(projectStorageKey, id);
    setSearchParams({ projectId: id });
    clearFilters();
  };

  return (
    <MainLayout pathName={{ tasks: "Công việc" }}>
      <section className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Project Management</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
              <ClipboardList className="size-6 text-primary" /> Quản lý công việc
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tạo, phân loại và cập nhật công việc trong dự án.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Tải lại danh sách"
              disabled={!projectSelected || tasksQuery.isFetching}
              onClick={() => void tasksQuery.refetch()}
            >
              <RefreshCw className={`size-4 ${tasksQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
            {canCreate && (
              <Button disabled={!projectSelected} onClick={createTask}>
                <Plus className="size-4" /> Tạo Task
              </Button>
            )}
          </div>
        </header>

        <TaskProjectPicker key={projectId} projectId={projectId} onSelect={selectProject} />

        {!projectSelected ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <FolderOpen className="size-10 text-muted-foreground" />
            <h2 className="font-semibold">Chọn dự án để bắt đầu</h2>
            <p className="max-w-md px-4 text-sm text-muted-foreground">
              Mở dự án bằng mã được chia sẻ để xem danh sách công việc và tạo Task mới.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
              <div className="relative min-w-48 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Tìm công việc"
                  className="pl-9"
                  value={search}
                  placeholder="Tìm theo tên hoặc mô tả..."
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as TaskStatus | "ALL");
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-full sm:w-44" aria-label="Lọc trạng thái">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                  {taskStatusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={priority}
                onValueChange={(value) => {
                  setPriority(value as TaskPriority | "ALL");
                  setPage(0);
                }}
              >
                <SelectTrigger className="w-full sm:w-44" aria-label="Lọc độ ưu tiên">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tất cả ưu tiên</SelectItem>
                  {taskPriorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="size-4" /> Xóa bộ lọc
                </Button>
              )}
            </div>
            {tasksQuery.isError ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Không tải được danh sách công việc</AlertTitle>
                <AlertDescription>
                  <p>{getTaskError(tasksQuery.error).message}</p>
                  <Button variant="outline" size="sm" onClick={() => void tasksQuery.refetch()}>
                    Thử lại
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Tổng cộng:{" "}
                  <strong className="text-foreground">{tasksQuery.data?.totalElements ?? 0}</strong>{" "}
                  công việc
                </p>
                <TaskTable
                  tasks={tasksQuery.data?.content ?? []}
                  loading={tasksQuery.isFetching}
                  canEdit={canEdit}
                  canCreate={canCreate}
                  filtered={hasFilters}
                  onEdit={editTask}
                  onCreate={createTask}
                />
                <TaskPagination
                  page={page}
                  size={size}
                  totalPages={tasksQuery.data?.totalPages ?? 0}
                  disabled={tasksQuery.isFetching}
                  onPageChange={setPage}
                  onSizeChange={(value) => {
                    setSize(value);
                    setPage(0);
                  }}
                />
              </>
            )}
          </>
        )}
      </section>
    </MainLayout>
  );
}
