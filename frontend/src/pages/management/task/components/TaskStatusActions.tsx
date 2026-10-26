import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskStatus, TaskWorkflowDTO } from "@/types/features/task";
import { ArrowRight, Loader2 } from "lucide-react";
import { TaskStatusBadge } from "./TaskBadges";

const actionLabels: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "Start task",
  REVIEW: "Submit for review",
  DONE: "Complete task",
  BLOCKED: "Mark as blocked",
};

function actionLabel(from: TaskStatus, to: TaskStatus) {
  if (to === "IN_PROGRESS" && from === "REVIEW") return "Return to In Progress";
  if (to === "IN_PROGRESS" && from === "BLOCKED") return "Resume task";
  return actionLabels[to];
}

export function TaskStatusActions({
  workflow,
  disabled,
  onChange,
}: {
  workflow: TaskWorkflowDTO;
  disabled: boolean;
  onChange: (status: TaskStatus) => void;
}) {
  const unfinished = workflow.predecessors.filter((task) => task.status !== "DONE").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Task status</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Current status</span>
          <TaskStatusBadge status={workflow.task.status} />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          To Do → In Progress → Review → Done
        </p>
        {workflow.task.status === "REVIEW" && (
          <p className="text-sm text-muted-foreground">
            Tasks that need changes can return from Review to In Progress.
          </p>
        )}
        {unfinished > 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {unfinished} prerequisite task(s) are not Done. Complete all prerequisites before
            starting or completing this task.
          </p>
        )}
        {workflow.editable &&
          workflow.allowedTransitions.map((status) => (
            <Button
              key={status}
              variant={
                status === "BLOCKED" ||
                (workflow.task.status === "REVIEW" && status === "IN_PROGRESS")
                  ? "outline"
                  : "default"
              }
              disabled={
                disabled || (unfinished > 0 && (status === "IN_PROGRESS" || status === "DONE"))
              }
              onClick={() => onChange(status)}
            >
              {disabled ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              {actionLabel(workflow.task.status, status)}
            </Button>
          ))}
        {workflow.task.status === "DONE" && (
          <p className="text-sm text-muted-foreground">This task is complete.</p>
        )}
        {!workflow.editable && (
          <p className="text-sm text-muted-foreground">You have view-only access to this task.</p>
        )}
      </CardContent>
    </Card>
  );
}
