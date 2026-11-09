import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bell, RefreshCw } from "lucide-react";
import { projectAlertApi } from "@/api/features/project-alert.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { AlertKind } from "@/types/features/project-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAlertError } from "./alert-errors";

const date = (value: string) => new Date(value).toLocaleString();
const label = (value: string) => value === "TODO" ? "To do" : value.toLowerCase().replaceAll("_", " ");

export function WorkspaceAlertsPanel({ workspaceId, teamId }: { workspaceId: number; teamId: number }) {
  const { user, activeRole } = usePermissions();
  const [kind, setKind] = useState<AlertKind | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: ["workspace-alerts", workspaceId, teamId, user.email, activeRole, kind, page],
    queryFn: ({ signal }) => projectAlertApi.sentInWorkspace(workspaceId,
      { page, size: 20, kind: kind === "ALL" ? undefined : kind }, signal),
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always", refetchInterval: 15_000,
  });
  const failure = query.isError ? getAlertError(query.error) : undefined;
  const data = !failure && query.data?.workspaceId === workspaceId && query.data.teamId === teamId ? query.data : undefined;

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2"><Bell className="size-5" />Alerts</CardTitle>
        <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
          <RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} />Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Task and milestone alerts sent to this team. Details show the situation when each alert was sent.</p>
      <div className="max-w-xs space-y-2">
        <Label htmlFor="workspace-alert-kind">Alert type</Label>
        <Select value={kind} onValueChange={value => { setKind(value as AlertKind | "ALL"); setPage(0); }}>
          <SelectTrigger id="workspace-alert-kind" className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="ALL">All sent alerts</SelectItem>
            <SelectItem value="BACKLOG">Overdue tasks</SelectItem><SelectItem value="MILESTONE">Milestone risks</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {query.isPending ? <p role="status">Loading sent alerts...</p> : failure ? <div className="space-y-3">
        <p role="alert" className="text-destructive">{failure.message}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>
      </div> : !data ? <p role="alert">Unable to load alerts for this workspace.</p>
        : !data.content.length ? <p className="py-8 text-center text-muted-foreground">No sent alerts match this filter. Alerts appear here after a manager sends them.</p>
          : data.content.map(alert => <article key={alert.id} className="space-y-4 rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1"><p className="font-medium">{alert.kind === "BACKLOG" ? "Overdue task alert" : "Milestone risk alert"}</p>
                <p className="text-xs text-muted-foreground">{alert.senderName} · {date(alert.sentAt)}</p></div>
              <Badge variant="outline">Sent</Badge>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm">{alert.warningNote}</p>
            {!!alert.items.length && <div className="space-y-3 rounded-md bg-muted/40 p-3">
              {alert.items.map((item, index) => <div key={item.id ?? index} className="space-y-1 text-sm">
                <p className="break-words font-medium">{item.title ?? (alert.kind === "BACKLOG" ? "Backlog item" : "Milestone")}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {item.status && <span>Status at send: {label(item.status)}</span>}
                  {item.deadline && <span>Deadline: {date(item.deadline)}</span>}
                  {item.assigneeName && <span>Assignee: {item.assigneeName}</span>}
                  {item.percentage != null && <span>Progress at send: {item.percentage}% · {item.done}/{item.total} Done</span>}
                </div>
                <Button variant="link" size="sm" className="h-auto px-0" asChild>
                  <Link to={alert.kind === "MILESTONE" && item.id
                    ? `/teams/${teamId}/milestones/${encodeURIComponent(item.id)}?workspaceId=${workspaceId}`
                    : `/management/workspaces/${workspaceId}?tab=backlog`}>
                    {alert.kind === "MILESTONE" ? "Open milestone" : "Open backlog"}
                  </Link>
                </Button>
              </div>)}
            </div>}
          </article>)}
      {data && data.total > 0 && <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{data.total} sent alert(s)</span><div className="flex items-center gap-3">
          <Button variant="outline" size="sm" disabled={query.isFetching || page === 0} onClick={() => setPage(value => value - 1)}>Previous</Button>
          <span>Page {page + 1} of {Math.max(1, Math.ceil(data.total / data.size))}</span>
          <Button variant="outline" size="sm" disabled={query.isFetching || (page + 1) * data.size >= data.total} onClick={() => setPage(value => value + 1)}>Next</Button>
        </div>
      </div>}
    </CardContent>
  </Card>;
}
