import { taskApi } from "@/api/features/task.api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/usePermissions";
import { TaskActivityFeed } from "@/pages/management/task/components/TaskActivityFeed";
import { TaskPriorityBadge } from "@/pages/management/task/components/TaskBadges";
import { TaskDeleteDialog } from "@/pages/management/task/components/TaskDeleteDialog";
import { TaskForm } from "@/pages/management/task/components/TaskForm";
import { useTaskWorkflowMutation } from "@/pages/management/task/hooks/useTaskWorkflowMutation";
import { getTaskError, subtaskStatusOptions } from "@/pages/management/task/task-form.utils";
import type { TaskDTO, TaskStatus, TaskWorkflowDTO } from "@/types/features/task";
import { useQuery } from "@tanstack/react-query";
import { History, ListTree, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

function SubtaskRow({ workflow, onEdit }: {
  workflow: TaskWorkflowDTO;
  onEdit: (task: TaskDTO) => void;
}) {
  const task = workflow.task;
  const [deleting, setDeleting] = useState(false);
  const [history, setHistory] = useState(false);
  const mutation = useTaskWorkflowMutation(task.id, () => setDeleting(false),
    (action) => { if (action.kind === "DELETE") setDeleting(false); });
  return <div className="space-y-3 rounded-lg border p-3">
    <div className="flex items-start gap-2">
      <ListTree className="mt-1 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{task.title}</p>
        {task.description && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{task.description}</p>}
      </div>
      {workflow.editable && <Button size="icon" variant="ghost" className="size-7 shrink-0" disabled={mutation.isPending}
        aria-label={`Edit subtask ${task.title}`} onClick={() => onEdit(task)}><Pencil className="size-3.5" /></Button>}
      {workflow.deletable && <Button size="icon" variant="ghost" className="size-7 shrink-0 text-destructive" disabled={mutation.isPending}
        aria-label={`Delete subtask ${task.title}`} onClick={() => setDeleting(true)}><Trash2 className="size-3.5" /></Button>}
    </div>
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Select value={task.status} disabled={!workflow.editable || mutation.isPending}
        onValueChange={status => void mutation.execute({ kind: "STATUS", status: status as TaskStatus, version: task.version })}>
        <SelectTrigger size="sm" className="h-7 w-36 text-xs" aria-label={`Status of subtask ${task.title}`}>
          {mutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>{subtaskStatusOptions.map(option => <SelectItem key={option.value} value={option.value}
          disabled={option.value !== task.status && !workflow.allowedTransitions.includes(option.value)}>
          {option.label}
        </SelectItem>)}</SelectContent>
      </Select>
      <TaskPriorityBadge priority={task.priority} />
      {task.estimatedHours != null && <span>{task.estimatedHours} h</span>}
      <Button size="icon" variant="ghost" className="ml-auto size-7" aria-label={`Activity of subtask ${task.title}`}
        aria-expanded={history} onClick={() => setHistory(value => !value)}><History className="size-3.5" /></Button>
    </div>
    {mutation.error && <Alert variant="destructive"><AlertDescription>
      {Object.values(mutation.error.fieldErrors).flat()[0] ?? mutation.error.message}
    </AlertDescription></Alert>}
    {history && <TaskActivityFeed taskId={task.id} />}
    {deleting && <TaskDeleteDialog task={task} pending={mutation.isPending} onClose={() => setDeleting(false)}
      onConfirm={() => void mutation.execute({ kind: "DELETE", version: task.version })} />}
  </div>;
}

export function BacklogSubtasksPanel({ backlogId }: { backlogId: number }) {
  const { hasPermission, user, activeRole } = usePermissions();
  const [editing, setEditing] = useState<{ task?: TaskDTO } | null>(null);
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: ["backlog-subtasks", user.email, activeRole, backlogId],
    queryFn: () => taskApi.getSubtasks(backlogId),
    enabled: hasPermission("TASK_READ"),
    retry: false,
  });
  if (!hasPermission("TASK_READ")) return null;
  const error = query.isError ? getTaskError(query.error) : null;
  const data = query.data;
  const done = data?.items.filter(item => item.task.status === "DONE").length ?? 0;
  return <section className="space-y-3 border-t pt-5" aria-label="Subtasks">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><ListTree className="size-4" />Subtasks
        {data && <span className="text-xs font-normal text-muted-foreground">{done}/{data.items.length} done</span>}</h3>
      {hasPermission("TASK_CREATE") && data && !error && <Button size="sm" variant="outline" onClick={() => setEditing({})}>
        <Plus className="size-3.5" />Add subtask</Button>}
    </div>
    <p className="text-xs text-muted-foreground">To Do ↔ In Progress ↔ Done. Subtask status is managed separately from the backlog item.</p>
    {query.isPending && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading subtasks...</p>}
    {error && <Alert variant="destructive"><AlertDescription>
      {Object.values(error.fieldErrors).flat()[0] ?? error.message}
      <Button size="sm" variant="outline" className="mt-2" onClick={() => void query.refetch()}><RefreshCw className="size-3" />Retry</Button>
    </AlertDescription></Alert>}
    {data && !error && (data.items.length ? data.items.map(workflow => <SubtaskRow key={workflow.task.id}
      workflow={workflow} onEdit={task => setEditing({ task })} />)
      : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No subtasks yet.</p>)}
    {editing && data && <Dialog open onOpenChange={open => { if (!open && !saving) setEditing(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" showCloseButton={!saving}
        onEscapeKeyDown={event => { if (saving) event.preventDefault(); }} onInteractOutside={event => event.preventDefault()}>
        <DialogHeader><DialogTitle>{editing.task ? "Edit subtask" : "Create subtask"}</DialogTitle>
          <DialogDescription>This subtask belongs to the selected backlog item.</DialogDescription></DialogHeader>
        <TaskForm key={editing.task?.id ?? `new-${backlogId}`} projectId={data.projectId} backlogItemId={backlogId}
          task={editing.task} onBusyChange={setSaving}
          onSaved={() => { setSaving(false); setEditing(null); }} onCancel={() => setEditing(null)} />
      </DialogContent>
    </Dialog>}
  </section>;
}
