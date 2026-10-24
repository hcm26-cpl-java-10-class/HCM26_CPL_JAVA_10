import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskDependencyDTO, TaskWorkflowDTO } from "@/types/features/task";
import { Link2, Plus, Unlink } from "lucide-react";
import { Link } from "react-router-dom";
import { TaskStatusBadge } from "./TaskBadges";

export function TaskDependencyPanel({
  workflow,
  disabled,
  onAdd,
  onRemove,
}: {
  workflow: TaskWorkflowDTO;
  disabled: boolean;
  onAdd: () => void;
  onRemove: (dependency: TaskDependencyDTO) => void;
}) {
  const renderTask = (task: TaskDependencyDTO, removable: boolean) => (
    <div key={task.taskId} className="flex items-center gap-3 rounded-lg border p-3">
      <Link2 className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <Link
          to={`/tasks/${task.taskId}/detail`}
          className="break-words text-sm font-medium hover:text-primary hover:underline"
        >
          {task.title}
        </Link>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {task.taskId.slice(0, 8).toUpperCase()}
        </p>
      </div>
      <TaskStatusBadge status={task.status} />
      {removable && workflow.editable && (
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Gỡ Task tiền đề ${task.title}`}
          onClick={() => onRemove(task)}
        >
          <Unlink className="size-4" />
        </Button>
      )}
    </div>
  );
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Liên kết phụ thuộc</CardTitle>
          {workflow.editable && (
            <Button variant="outline" size="sm" disabled={disabled} onClick={onAdd}>
              <Plus className="size-4" /> Thêm Task tiền đề
            </Button>
          )}
        </div>
        <CardDescription>
          Tất cả Task tiền đề phải Done trước khi công việc này được bắt đầu.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <h2 className="text-sm font-medium">Task tiền đề ({workflow.predecessors.length})</h2>
          {workflow.predecessors.length ? (
            workflow.predecessors.map((task) => renderTask(task, true))
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có Task tiền đề.</p>
          )}
        </div>
        <div className="grid gap-2 border-t pt-4">
          <h2 className="text-sm font-medium">
            Task đang chờ công việc này ({workflow.successors.length})
          </h2>
          {workflow.successors.length ? (
            workflow.successors.map((task) => renderTask(task, false))
          ) : (
            <p className="text-sm text-muted-foreground">
              Chưa có Task phụ thuộc vào công việc này.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
