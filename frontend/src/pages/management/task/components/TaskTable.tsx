import { taskApi } from "@/api/features/task.api";
import ActionButton from "@/components/datatable/common/ActionButton";
import { ProTable } from "@/components/datatable/ProTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import type { FieldSchema } from "@/types";
import type { TaskDTO } from "@/types/features/task";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Eye, Loader2, Pen, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTaskTable } from "../hooks/useTaskTable";
import { useTaskWorkflowMutation } from "../hooks/useTaskWorkflowMutation";
import { getTaskError } from "../task-form.utils";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskBadges";
import { TaskDeleteDialog } from "./TaskDeleteDialog";
import { TaskCard } from "./TaskCard";
import { TaskMutationError } from "./TaskMutationError";

export function TaskTable({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const { user, activeRole, hasPermission } = usePermissions();
  const table = useTaskTable(projectId);
  const [deleting, setDeleting] = useState<{ task: TaskDTO; dependencyCount: number } | null>(null);
  const [preparingDelete, setPreparingDelete] = useState<string | null>(null);
  const preparingRef = useRef(false);
  const mutation = useTaskWorkflowMutation(
    deleting?.task.id ?? "",
    () => {
      const deletedId = deleting?.task.id;
      table.setSelected((previous) => previous.filter((id) => id !== deletedId));
      if (table.data.length === 1 && table.page > 0) table.setPage(table.page - 1);
    },
    () => setDeleting(null),
  );
  const firstTaskId = table.data[0]?.id;
  const deletePermission = useQuery({
    queryKey: ["tasks", user.email, activeRole, "delete-permission", projectId, firstTaskId],
    queryFn: async () => (await taskApi.getWorkflow(firstTaskId!)).deletable,
    enabled: !!firstTaskId && hasPermission("TASK_DELETE"),
    retry: false,
  });
  const busy = mutation.isPending || preparingDelete !== null;
  const viewTask = (task: TaskDTO) => navigate(`/tasks/${task.id}/detail`);
  const editTask = (task: TaskDTO) => navigate(`/tasks/${task.id}/edit`);

  const openDelete = async (task: TaskDTO) => {
    if (preparingRef.current || mutation.isPending) return;
    preparingRef.current = true;
    setPreparingDelete(task.id);
    mutation.clearError();
    try {
      const workflow = await taskApi.getWorkflow(task.id);
      if (!workflow.deletable) {
        toast.error("Only the project leader/mentor can delete tasks.");
        return;
      }
      if (workflow.task.status !== "TODO" && workflow.task.status !== "IN_PROGRESS") {
        toast.error("Only tasks in To Do or In Progress can be deleted.");
        void table.query.refetch();
        return;
      }
      setDeleting({
        task: workflow.task,
        dependencyCount: workflow.predecessors.length + workflow.successors.length,
      });
    } catch (error) {
      toast.error(getTaskError(error).message);
      void table.query.refetch();
    } finally {
      preparingRef.current = false;
      setPreparingDelete(null);
    }
  };

  const renderCell = (task: TaskDTO, field: FieldSchema) => {
    switch (field.name) {
      case "id":
        return (
          <span className="font-mono text-xs text-muted-foreground" title={task.id}>
            {task.id.slice(0, 8).toUpperCase()}
          </span>
        );
      case "title":
        return (
          <button
            type="button"
            title={task.title}
            className="block w-full truncate text-left font-medium hover:text-primary hover:underline focus-visible:outline-ring"
            onClick={() => viewTask(task)}
          >
            {task.title}
          </button>
        );
      case "status":
        return <TaskStatusBadge status={task.status} />;
      case "priority":
        return <TaskPriorityBadge priority={task.priority} />;
      case "assigneeProjectMemberId":
        return (
          <span className="text-muted-foreground" title={task.assigneeProjectMemberId ?? undefined}>
            {task.assigneeProjectMemberId
              ? `Member ${task.assigneeProjectMemberId.slice(0, 8)}`
              : "Unassigned"}
          </span>
        );
      case "tags":
        return task.tags.length ? (
          <div className="flex items-center gap-1 overflow-hidden">
            {task.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="max-w-24">
                <span className="truncate">{tag}</span>
              </Badge>
            ))}
            {task.tags.length > 2 && (
              <Badge variant="outline" title={task.tags.slice(2).join(", ")}>
                +{task.tags.length - 2}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      default:
        return undefined;
    }
  };

  return (
    <div className="flex min-h-[460px] min-w-0 flex-1 flex-col gap-4 [&>div:last-child]:min-w-0">
      <TaskMutationError
        error={mutation.error}
        onReload={() => {
          mutation.clearError();
          void table.query.refetch();
        }}
      />
      {table.query.isError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Unable to load tasks</AlertTitle>
          <AlertDescription>
            <p>{getTaskError(table.query.error).message}</p>
            <Button variant="outline" size="sm" onClick={() => void table.query.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <ProTable<TaskDTO>
        table={table}
        autoPageSize={false}
        compactToolbar
        responsiveCards
        rowHeight={56}
        onRowClick={viewTask}
        onView={viewTask}
        onEdit={editTask}
        onDelete={(task) => void openDelete(task)}
        renderCell={renderCell}
        renderCard={(props) => <TaskCard {...props} />}
        renderFormModal={() => null}
        headerActions={
          <div className="flex items-center gap-2">
            <ActionButton
              onClick={() => void table.query.refetch()}
              disabled={busy || table.isFetching}
              tooltip="Refresh tasks"
              icon={<RefreshCw className={`size-4 ${table.isFetching ? "animate-spin" : ""}`} />}
            />
            {table.permission.canCreate && (
              <ActionButton
                onClick={() => navigate(`/tasks/create?${new URLSearchParams({ projectId })}`)}
                disabled={busy}
                title="Create"
                tooltip="Create task"
                variant="default"
                icon={<Plus className="size-4" />}
              />
            )}
          </div>
        }
        renderRowActions={(task) => (
          <>
            <ActionButton
              tooltip={`View task ${task.title}`}
              disabled={busy}
              onClick={() => viewTask(task)}
              icon={<Eye className="size-4 text-muted-foreground" />}
            />
            {table.permission.canUpdate && (
              <ActionButton
                tooltip={`Edit task ${task.title}`}
                disabled={busy}
                onClick={() => editTask(task)}
                icon={<Pen className="size-4 text-muted-foreground" />}
              />
            )}
            {!deletePermission.isError && deletePermission.data === true && (
              <ActionButton
                tooltip={`Delete task ${task.title}`}
                disabled={busy || (task.status !== "TODO" && task.status !== "IN_PROGRESS")}
                onClick={() => void openDelete(task)}
                icon={
                  preparingDelete === task.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 text-destructive" />
                  )
                }
              />
            )}
          </>
        )}
      />
      {deleting && (
        <TaskDeleteDialog
          task={deleting.task}
          dependencyCount={deleting.dependencyCount}
          pending={mutation.isPending}
          onClose={() => {
            if (!mutation.isPending) setDeleting(null);
          }}
          onConfirm={() =>
            void mutation.execute({ kind: "DELETE", version: deleting.task.version })
          }
        />
      )}
    </div>
  );
}
