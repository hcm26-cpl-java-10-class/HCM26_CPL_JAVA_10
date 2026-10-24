import { taskApi } from "@/api/features/task.api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/hooks/usePermissions";
import type { TaskActivityDTO } from "@/types/features/task";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { getTaskError, taskStatusOptions } from "../task-form.utils";

function activityDescription(activity: TaskActivityDTO): string {
  if (activity.action === "CREATE") return "Tạo Task";
  if (activity.action === "UPDATE") return "Cập nhật thông tin Task";
  if (activity.action === "STATUS_CHANGED") {
    const before =
      taskStatusOptions.find((option) => option.value === activity.before?.status)?.label ?? "";
    const after =
      taskStatusOptions.find((option) => option.value === activity.after.status)?.label ?? "";
    return `Chuyển trạng thái: ${before} → ${after}`;
  }
  const before = activity.before?.predecessorTaskIds ?? [];
  const after = activity.after.predecessorTaskIds ?? [];
  if (activity.action === "DEPENDENCY_ADDED") {
    return `Thêm Task tiền đề: ${after
      .filter((id) => !before.includes(id))
      .map((id) => id.slice(0, 8).toUpperCase())
      .join(", ")}`;
  }
  if (activity.action === "DEPENDENCY_REMOVED") {
    return `Gỡ Task tiền đề: ${before
      .filter((id) => !after.includes(id))
      .map((id) => id.slice(0, 8).toUpperCase())
      .join(", ")}`;
  }
  return "Cập nhật công việc";
}

export function TaskActivityFeed({ taskId }: { taskId: string }) {
  const { user, activeRole } = usePermissions();
  const activityQuery = useQuery({
    queryKey: ["tasks", user.email, activeRole, "activity", taskId],
    queryFn: () => taskApi.getActivity(taskId),
    retry: false,
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4" /> Lịch sử thay đổi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activityQuery.isLoading ? (
          <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải lịch sử...
          </div>
        ) : activityQuery.isError ? (
          <div role="alert" className="grid gap-2 text-sm text-destructive">
            <p>{getTaskError(activityQuery.error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void activityQuery.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : !activityQuery.data?.length ? (
          <p className="text-sm text-muted-foreground">Chưa có lịch sử thay đổi.</p>
        ) : (
          <ol className="grid gap-5">
            {[...activityQuery.data].reverse().map((activity) => (
              <li key={activity.id} className="border-l-2 border-muted pl-4">
                <p className="text-sm font-medium">{activityDescription(activity)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activity.actorName || "Thành viên"} ·{" "}
                  {new Date(activity.occurredAt).toLocaleString("vi-VN")}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
