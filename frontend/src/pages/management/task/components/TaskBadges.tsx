import { Badge } from "@/components/ui/badge";
import type { TaskPriority, TaskStatus } from "@/types/features/task";
import { taskPriorityOptions, taskStatusOptions } from "../task-form.utils";

const statusColors: Record<TaskStatus, string> = {
  TODO: "bg-muted text-muted-foreground",
  IN_PROGRESS:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  REVIEW:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  DONE: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={statusColors[status]}>
      {taskStatusOptions.find((option) => option.value === status)?.label}
    </Badge>
  );
}

export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <Badge variant={priority === "HIGH" ? "destructive" : "secondary"}>
      {taskPriorityOptions.find((option) => option.value === priority)?.label}
    </Badge>
  );
}
