import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { taskAlertApi } from "@/api/features/task-alert.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { TaskDTO } from "@/types/features/task";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskAlertDialog } from "./TaskAlertDialog";
import { TaskAlertHistory } from "./TaskAlertHistory";
import { getTaskError } from "../task-form.utils";

export function OverdueTaskPanel({ projectId }: { projectId: string }) {
  const { user, activeRole, hasPermission } = usePermissions();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [targets, setTargets] = useState<TaskDTO[] | null>(null);
  const [note, setNote] = useState("");
  const [historyId, setHistoryId] = useState<string>();
  const query = useQuery({
    queryKey: ["task-alerts", user.email, activeRole, projectId, page],
    queryFn: ({ signal }) => taskAlertApi.overdue(projectId, page, signal), retry: false, gcTime: 0
  });
  const error = query.isError ? getTaskError(query.error) : undefined;
  const denied = error?.status === 401 || error?.status === 403;
  const rows = query.isError ? [] : query.data?.content ?? [];
  const canSend = !query.isError && !!query.data?.canSend && hasPermission("TASK_ALERT_SEND");
  const selectedTasks = rows.filter(row => row.canSend && selected.includes(row.task.id)).map(row => row.task);
  async function reload() {
    const result = await query.refetch();
    if (result.isSuccess) {
      setTargets(previous => previous?.flatMap(old => {
        const fresh = result.data.content.find(row => row.task.id === old.id && row.canSend);
        return fresh ? [fresh.task] : [];
      }) ?? null);
      setSelected(previous => previous.filter(id => result.data.content.some(row => row.task.id === id && row.canSend)));
    }
  }
  return <>
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Overdue tasks</CardTitle>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void reload()} disabled={query.isFetching}>Refresh</Button>
        {canSend && <Button onClick={() => setTargets(selectedTasks)} disabled={query.isFetching || selectedTasks.length === 0}>Send alert</Button>}</div>
    </div></CardHeader><CardContent>
      {query.isPending ? <p role="status" className="py-8">Loading overdue tasks...</p>
        : query.isError ? <div role="alert" className="space-y-3"><p>{error?.message}</p><Button variant="outline" onClick={() => void reload()}>Try again</Button></div>
        : rows.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No overdue tasks.</p>
        : <Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Task</TableHead><TableHead>Status</TableHead>
            <TableHead>Deadline</TableHead><TableHead>History</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map(({ task, canSend: allowed }) => <TableRow key={task.id}>
            <TableCell><Checkbox aria-label={"Select " + task.title} checked={selected.includes(task.id)}
              disabled={!canSend || !allowed || query.isFetching}
              onCheckedChange={value => setSelected(previous => value === true ? [...previous, task.id] : previous.filter(id => id !== task.id))} /></TableCell>
            <TableCell>{task.title}</TableCell><TableCell>{task.status === "TODO" ? "To Do" : "In Progress"}</TableCell>
            <TableCell>{task.deadline ? new Date(task.deadline).toLocaleString() : "Not set"}</TableCell>
            <TableCell><Button variant="outline" size="sm" onClick={() => setHistoryId(task.id)}>Alert history</Button></TableCell>
          </TableRow>)}</TableBody></Table>}
      {!query.isError && query.data && <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{query.data.totalElements} overdue task(s)</p>
        <div className="flex gap-2"><Button variant="outline" disabled={page === 0 || query.isFetching}
          onClick={() => { setSelected([]); setPage(value => value - 1); }}>Previous</Button>
          <Button variant="outline" disabled={(page + 1) * 20 >= query.data.totalElements || query.isFetching}
            onClick={() => { setSelected([]); setPage(value => value + 1); }}>Next</Button></div></div>}
    </CardContent></Card>
    {targets && !denied && <TaskAlertDialog projectId={projectId} tasks={targets} note={note} onNoteChange={setNote}
      enabled={canSend && !query.isFetching} onClose={() => setTargets(null)} onReload={reload}
      onSuccess={() => { setTargets(null); setSelected([]); setNote(""); }} />}
    {historyId && !denied && <Dialog open onOpenChange={open => { if (!open) setHistoryId(undefined); }}>
      <DialogContent><DialogHeader><DialogTitle>Task alerts</DialogTitle></DialogHeader>
        <TaskAlertHistory taskId={historyId} /></DialogContent></Dialog>}
  </>;
}
