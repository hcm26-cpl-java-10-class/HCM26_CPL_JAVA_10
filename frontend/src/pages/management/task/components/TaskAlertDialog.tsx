import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskAlertApi } from "@/api/features/task-alert.api";
import type { TaskDTO } from "@/types/features/task";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getTaskError } from "../task-form.utils";

export function TaskAlertDialog({ projectId, tasks, note, onNoteChange, onClose, onReload, onSuccess, enabled }: {
  projectId: string; tasks: TaskDTO[]; note: string; onNoteChange: (value: string) => void;
  onClose: () => void; onReload: () => Promise<void>; onSuccess: () => void; enabled: boolean;
}) {
  const client = useQueryClient();
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const pending = useRef(false);
  const mutation = useMutation({
    mutationFn: ({ payload, key }: { payload: { projectId: string; tasks: { taskId: string; version: number }[]; warningNote: string }; key: string }) =>
      taskAlertApi.send(payload, key),
    onError: cause => {
      if ([401, 403].includes(getTaskError(cause).status ?? 0)) {
        setAccessDenied(true);
        void onReload();
      }
    },
    onSuccess: async () => {
      toast.success("Alert queued for the selected assignees.");
      await Promise.all([client.invalidateQueries({ queryKey: ["task-alert-history"] }),
        client.invalidateQueries({ queryKey: ["task-alerts"] }), client.invalidateQueries({ queryKey: ["tasks"] })]);
      onSuccess();
    }
  });
  const error = mutation.isError ? getTaskError(mutation.error) : undefined;
  const fieldError = error?.fieldErrors.warningNote?.[0];
  const denied = accessDenied || error?.status === 401 || error?.status === 403;
  async function submit() {
    if (pending.current || !enabled || denied || tasks.length === 0 || !note.trim()) return;
    const payload = { projectId, tasks: tasks.map(task => ({ taskId: task.id, version: task.version }))
      .sort((a, b) => a.taskId.localeCompare(b.taskId)), warningNote: note };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
    pending.current = true;
    try { await mutation.mutateAsync({ payload, key: request.current.key }); }
    catch { /* Retain the complete note and same request key for an unchanged retry. */ }
    finally { pending.current = false; }
  }
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent className="max-h-[85vh] min-w-0 overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Send overdue task alert</DialogTitle>
        <DialogDescription>{tasks.length} selected task(s). Alerts will be queued for the assignees.</DialogDescription></DialogHeader>
      <form noValidate className="min-w-0 space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
        <div className="min-w-0 space-y-2"><Label htmlFor="task-alert-note">Warning note</Label>
          <Textarea id="task-alert-note" rows={6} value={note} disabled={mutation.isPending}
            aria-invalid={!!fieldError || note.length > 500} aria-describedby="task-alert-note-error"
            className={"field-sizing-fixed min-h-36 min-w-0 max-w-full resize-y " + (fieldError || note.length > 500 ? "border-destructive" : "")}
            onChange={event => { onNoteChange(event.target.value); if (!mutation.isPending) mutation.reset(); }} />
          <p className={"text-right text-xs " + (note.length > 500 ? "text-destructive" : "text-muted-foreground")}>{note.length}/500</p>
          {fieldError && <p id="task-alert-note-error" role="alert" className="text-sm text-destructive">{fieldError}</p>}
        </div>
        {error && error.status !== 422 && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
        {error?.status === 422 && !fieldError && <p role="alert" className="text-sm text-destructive">
          {Object.values(error.fieldErrors).flat()[0] ?? error.message}</p>}
        {(error?.status === 409 || denied) && <Button type="button" variant="outline" onClick={() => {
          void onReload().then(() => { setAccessDenied(false); mutation.reset(); });
        }}>Reload task list</Button>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!enabled || mutation.isPending || denied || tasks.length === 0 || !note.trim()}>
            {mutation.isPending ? "Queuing..." : "Send alert"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
