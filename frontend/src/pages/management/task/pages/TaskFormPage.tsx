import { taskApi } from "@/api/features/task.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TaskForm } from "../components/TaskForm";
import { getTaskError, isProjectId, taskListPath } from "../task-form.utils";

export function TaskFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, activeRole } = usePermissions();
  const taskQuery = useQuery({
    queryKey: ["tasks", user.email, activeRole, "detail", id, location.key],
    queryFn: () => taskApi.getById(id!),
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const projectId = taskQuery.data?.projectId ?? searchParams.get("projectId") ?? "";
  const returnToDetail = !!id && searchParams.get("from") === "detail";
  const goBack = () => navigate(returnToDetail ? `/tasks/${id}/detail` : taskListPath(projectId));
  const missingProject = !id && !isProjectId(projectId);

  return (
    <MainLayout
      pathName={{
        tasks: "Công việc",
        create: "Tạo mới",
        edit: "Chỉnh sửa",
        ...(id ? { [id]: "Task" } : {}),
      }}
    >
      <section className="grid gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-sm text-muted-foreground">Project Management</p>
            <h1 className="mt-1 text-2xl font-semibold">
              {id ? "Chỉnh sửa Task" : "Tạo Task mới"}
            </h1>
          </div>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="size-4" /> {returnToDetail ? "Về chi tiết Task" : "Về danh sách"}
          </Button>
        </header>
        {id && taskQuery.isLoading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
          >
            <Loader2 className="size-5 animate-spin" /> Đang tải Task...
          </div>
        ) : taskQuery.isError || missingProject ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>{missingProject ? "Chưa chọn dự án" : "Không tải được Task"}</AlertTitle>
            <AlertDescription>
              <p>
                {missingProject
                  ? "Vui lòng chọn dự án từ danh sách công việc trước khi tạo Task."
                  : getTaskError(taskQuery.error).message}
              </p>
              {id && (
                <Button variant="outline" size="sm" onClick={() => void taskQuery.refetch()}>
                  Thử lại
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <TaskForm
            key={id ?? projectId}
            task={taskQuery.data}
            projectId={projectId}
            onCancel={goBack}
            onSaved={(saved) =>
              navigate(returnToDetail ? `/tasks/${saved.id}/detail` : taskListPath(saved.projectId))
            }
          />
        )}
      </section>
    </MainLayout>
  );
}
