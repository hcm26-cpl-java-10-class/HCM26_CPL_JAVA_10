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
          aria-label={`Remove prerequisite ${task.title}`}
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
          <CardTitle>Dependencies</CardTitle>
          {workflow.editable && (
            <Button variant="outline" size="sm" disabled={disabled} onClick={onAdd}>
              <Plus className="size-4" /> Add prerequisite
            </Button>
          )}
        </div>
        <CardDescription>
          All prerequisite tasks must be Done before this task can start.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <h2 className="text-sm font-medium">Prerequisites ({workflow.predecessors.length})</h2>
          {workflow.predecessors.length ? (
            workflow.predecessors.map((task) => renderTask(task, true))
          ) : (
            <p className="text-sm text-muted-foreground">No prerequisites.</p>
          )}
        </div>
        <div className="grid gap-2 border-t pt-4">
          <h2 className="text-sm font-medium">
            Tasks blocked by this task ({workflow.successors.length})
          </h2>
          {workflow.successors.length ? (
            workflow.successors.map((task) => renderTask(task, false))
          ) : (
            <p className="text-sm text-muted-foreground">
              No tasks depend on this task.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
