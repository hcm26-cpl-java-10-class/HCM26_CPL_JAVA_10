import { taskApi } from "@/api/features/task.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { TaskDTO, TaskDependencyDTO } from "@/types/features/task";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Loader2, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TaskActivityFeed } from "../components/TaskActivityFeed";
import { TaskPriorityBadge } from "../components/TaskBadges";
import { TaskDependencyDialog } from "../components/TaskDependencyDialog";
import { TaskDeleteDialog } from "../components/TaskDeleteDialog";
import { TaskDependencyPanel } from "../components/TaskDependencyPanel";
import { TaskMutationError } from "../components/TaskMutationError";
import { TaskStatusActions } from "../components/TaskStatusActions";
import { useTaskWorkflowMutation } from "../hooks/useTaskWorkflowMutation";
import { getTaskError, taskListPath } from "../task-form.utils";

export function TaskDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  return <TaskDetailContent key={id} taskId={id} />;
}

function TaskDetailContent({ taskId: id }: { taskId: string }) {
  const navigate = useNavigate();
  const { user, activeRole, hasPermission } = usePermissions();
  const [dependencyTask, setDependencyTask] = useState<TaskDTO | null>(null);
  const [removing, setRemoving] = useState<{ task: TaskDTO; dependency: TaskDependencyDTO } | null>(
    null,
  );
  const [deleting, setDeleting] = useState<{ task: TaskDTO; dependencyCount: number } | null>(null);
  const workflowQuery = useQuery({
    queryKey: ["tasks", user.email, activeRole, "workflow", id],
    queryFn: () => taskApi.getWorkflow(id),
    enabled: !!id,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
  const mutation = useTaskWorkflowMutation(
    id,
    (action) => {
      setDependencyTask(null);
      setRemoving(null);
      if (action.kind === "DELETE") {
        navigate(taskListPath(deleting?.task.projectId ?? ""), { replace: true });
      }
    },
    (action) => {
      if (action.kind === "DELETE") setDeleting(null);
    },
  );
  const workflow =
    !workflowQuery.isError && workflowQuery.data
      ? {
          ...workflowQuery.data,
          editable: workflowQuery.data.editable && hasPermission("TASK_UPDATE"),
          deletable: workflowQuery.data.deletable && hasPermission("TASK_DELETE"),
        }
      : undefined;
  const closeDialog = () => {
    setDependencyTask(null);
    setRemoving(null);
    setDeleting(null);
    mutation.clearError();
  };
  const reload = () => {
    closeDialog();
    void workflowQuery.refetch();
  };

  return (
    <MainLayout pathName={{ tasks: "Tasks", [id]: "Task", detail: "Details" }}>
      <section className="grid gap-5">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Project Management</p>
            <h1 className="mt-1 break-words text-2xl font-semibold">
              {workflow?.task.title ?? "Task details"}
            </h1>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => navigate(taskListPath(workflow?.task.projectId ?? ""))}
            >
              <ArrowLeft className="size-4" /> Back to tasks
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh task"
              disabled={mutation.isPending || workflowQuery.isFetching}
              onClick={reload}
            >
              <RefreshCw className={`size-4 ${workflowQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
            {workflow?.editable && (
              <Button
                disabled={mutation.isPending}
                onClick={() => navigate(`/tasks/${id}/edit?from=detail`)}
              >
                <Pencil className="size-4" /> Edit details
              </Button>
            )}
            {workflow?.deletable && (
              <Button
                variant="destructive"
                disabled={
                  mutation.isPending ||
                  workflowQuery.isFetching ||
                  (workflow.task.status !== "TODO" && workflow.task.status !== "IN_PROGRESS")
                }
                title="Only tasks in To Do or In Progress can be deleted"
                onClick={() => {
                  mutation.clearError();
                  setDeleting({
                    task: workflow.task,
                    dependencyCount: workflow.predecessors.length + workflow.successors.length,
                  });
                }}
              >
                <Trash2 className="size-4" /> Delete task
              </Button>
            )}
          </div>
        </header>
        {workflowQuery.isLoading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
          >
            <Loader2 className="size-5 animate-spin" /> Loading task...
          </div>
        ) : workflowQuery.isError || !workflow ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Unable to load task</AlertTitle>
            <AlertDescription>
              <p>{getTaskError(workflowQuery.error).message}</p>
              <Button variant="outline" size="sm" onClick={reload}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {!dependencyTask && !removing && (
              <TaskMutationError error={mutation.error} onReload={reload} />
            )}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
              <div className="grid min-w-0 gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle>Task description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                      {workflow.task.description || "No description provided."}
                    </p>
                  </CardContent>
                </Card>
                <TaskDependencyPanel
                  workflow={workflow}
                  disabled={mutation.isPending || workflowQuery.isFetching}
                  onAdd={() => {
                    mutation.clearError();
                    setDependencyTask(workflow.task);
                  }}
                  onRemove={(dependency) => {
                    mutation.clearError();
                    setRemoving({ task: workflow.task, dependency });
                  }}
                />
                <TaskActivityFeed taskId={id} />
              </div>
              <div className="grid min-w-0 gap-5">
                <TaskStatusActions
                  workflow={workflow}
                  disabled={mutation.isPending || workflowQuery.isFetching}
                  onChange={(status) =>
                    void mutation.execute({
                      kind: "STATUS",
                      status,
                      version: workflow.task.version,
                    })
                  }
                />
                <Card>
                  <CardHeader>
                    <CardTitle>Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Assignee</span>
                      <span>
                        {workflow.task.assigneeProjectMemberId
                          ? `Member ${workflow.task.assigneeProjectMemberId.slice(0, 8)}`
                          : "Unassigned"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Estimate</span>
                      <span>
                        {workflow.task.estimatedHours == null
                          ? "Not estimated"
                          : `${workflow.task.estimatedHours} hours`}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Priority</span>
                      <TaskPriorityBadge priority={workflow.task.priority} />
                    </div>
                    <div className="grid gap-2 border-t pt-4">
                      <span className="text-muted-foreground">Tags</span>
                      <div className="flex flex-wrap gap-2">
                        {workflow.task.tags.length ? (
                          workflow.task.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="max-w-full">
                              <span className="truncate">{tag}</span>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">No tags</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            {dependencyTask && (
              <TaskDependencyDialog
                task={dependencyTask}
                pending={mutation.isPending}
                error={mutation.error}
                onClose={closeDialog}
                onReload={reload}
                onClearError={mutation.clearError}
                onSubmit={mutation.execute}
              />
            )}
            {deleting && (
              <TaskDeleteDialog
                task={deleting.task}
                dependencyCount={deleting.dependencyCount}
                pending={mutation.isPending}
                onClose={closeDialog}
                onConfirm={() =>
                  void mutation.execute({ kind: "DELETE", version: deleting.task.version })
                }
              />
            )}
            {removing && (
              <Dialog
                open
                onOpenChange={(open) => {
                  if (!open && !mutation.isPending) closeDialog();
                }}
              >
                <DialogContent
                  showCloseButton={!mutation.isPending}
                  onEscapeKeyDown={(event) => {
                    if (mutation.isPending) event.preventDefault();
                  }}
                  onInteractOutside={(event) => {
                    if (mutation.isPending) event.preventDefault();
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Remove prerequisite?</DialogTitle>
                    <DialogDescription>
                      Remove the dependency on "{removing.dependency.title}". This task will remain
                      in the project.
                    </DialogDescription>
                  </DialogHeader>
                  <TaskMutationError error={mutation.error} onReload={reload} />
                  <DialogFooter>
                    <Button variant="outline" disabled={mutation.isPending} onClick={closeDialog}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={mutation.isPending}
                      onClick={() =>
                        void mutation.execute({
                          kind: "REMOVE",
                          predecessorTaskId: removing.dependency.taskId,
                          version: removing.task.version,
                        })
                      }
                    >
                      {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                      {mutation.isPending ? "Removing..." : "Remove dependency"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}
      </section>
    </MainLayout>
  );
}
