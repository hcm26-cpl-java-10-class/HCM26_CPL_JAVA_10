import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceSectionKey, WorkspaceSectionAccess } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";

export function WorkspaceBusinessSectionPanel({ workspaceId, projectId, teamId, section, label, access, onAccessChanged }: {
  workspaceId: number; projectId?: number | null; teamId: number; section: WorkspaceSectionKey; label: string;
  access: WorkspaceSectionAccess; onAccessChanged: () => void;
}) {
  const { user, activeRole } = usePermissions();
  const query = useQuery({
    queryKey: ["workspace-section", workspaceId, section, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.section(workspaceId, section, signal),
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always"
  });
  const denied = sectionForbidden(query.error);
  useEffect(() => { if (denied) onAccessChanged(); }, [denied, onAccessChanged]);
  if (denied || query.isError || query.isPending || query.isFetching)
    return <WorkspaceSectionState loading={!query.isError && query.isFetching} denied={denied}
      error={query.error} retry={() => denied ? onAccessChanged() : void query.refetch()} />;
  const data = query.data;
  if (!data || data.workspaceId !== workspaceId || data.projectId !== projectId || data.teamId !== teamId || data.section !== section)
    return <WorkspaceSectionState error={new Error("Section context does not match this workspace.")}
      retry={() => void query.refetch()} />;
  const labels: Record<string, string> = { create: "Create " + (section === "milestones" ? "milestone" : section === "sprints" ? "sprint" : section === "feedback" ? "feedback" : "artifact"),
    createTask: "Create task", submit: "Submit artifact", review: "Record review" };
  return <>
    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{label}</CardTitle>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void query.refetch()}>Refresh section</Button>
          {Object.entries(access.actions).filter(([key, allowed]) => allowed && key in labels).map(([key]) =>
            <Button key={key} type="button" disabled title="Not available yet">{labels[key]}</Button>)}</div>
      </div></CardHeader>
      <CardContent>{data.items.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No {label.toLowerCase()} yet.</p>
        : <div className="divide-y">{data.items.map(item => <div key={item.id} className="space-y-2 py-4">
          <div className="flex items-start justify-between gap-3"><p className="font-medium">{item.title}</p><Badge variant="outline">{item.status}</Badge></div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description || "No information available"}</p>
          {item.occurredAt && <p className="text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString("en-GB")}</p>}
          {item.score != null && <p className="text-sm">Score: {item.score}/10</p>}
          {section === "backlog" && access.actions.createTask && <Button type="button" variant="outline" size="sm" disabled title="Not available yet">Edit task</Button>}
        </div>)}</div>}</CardContent>
    </Card>
  </>;
}
