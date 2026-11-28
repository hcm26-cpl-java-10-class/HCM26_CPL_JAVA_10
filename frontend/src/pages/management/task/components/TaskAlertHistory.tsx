import { taskAlertApi } from "@/api/features/task-alert.api";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTaskError } from "../task-form.utils";

export function TaskAlertHistory({ taskId }: { taskId: string }) {
  const { user, activeRole } = usePermissions();
  const query = useQuery({
    queryKey: ["task-alert-history", user.email, activeRole, taskId],
    queryFn: ({ signal }) => taskAlertApi.history(taskId, signal), retry: false, gcTime: 0
  });
  return <Card><CardHeader><CardTitle>Alert history</CardTitle></CardHeader><CardContent>
    {query.isPending ? <p role="status">Loading alert history...</p>
      : query.isError ? <div className="space-y-3"><p role="alert">{getTaskError(query.error).message}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>
      : query.data.length === 0 ? <p className="text-sm text-muted-foreground">No alerts yet.</p>
      : <div className="divide-y">{query.data.map(item => <div key={item.batchId} className="space-y-2 py-3">
          <div className="flex items-center justify-between gap-3"><p className="text-sm">{new Date(item.createdAt).toLocaleString()}</p>
            <Badge variant="outline">{item.status === "PENDING" ? "Queued" : item.status === "DELIVERED" ? "Delivered" : "Failed"}</Badge></div>
          <p className="whitespace-pre-wrap break-words text-sm">{item.warningNote}</p>
        </div>)}</div>}
  </CardContent></Card>;
}
