import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus } from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceSectionAccess } from "@/types/features/workspace";

export function WorkspaceMilestonesPanel({ projectId, teamId, workspaceId, access }: {
  projectId?: number | null;
  teamId: number;
  workspaceId: number;
  access: WorkspaceSectionAccess;
}) {
  const query = useQuery({
    queryKey: ["workspace-milestones", projectId, teamId],
    queryFn: () => milestoneApi.getTeamList(teamId, { page: 0, size: 100 }),
    retry: false,
  });
  const navigate = useNavigate();
  const createButton = access.actions.create && (
    <Button type="button" title="Create milestone in this workspace"
      onClick={() => navigate(`/projects/${projectId ?? 0}/milestones/new?teamId=${teamId}&scope=team&workspaceId=${workspaceId}`)}>
      <Plus />Create milestone
    </Button>
  );
  if (query.error) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Milestones</CardTitle>
          <div className="flex items-center gap-2">
            <Button asChild type="button" variant="outline">
              <Link to={`/teams/${teamId}/milestones`}>View all</Link>
            </Button>
            {createButton}
          </div>
        </CardHeader>
        <CardContent>
          <p className="rounded-md border p-6 text-sm text-muted-foreground">Unable to load milestones.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Milestones</CardTitle>
        <div className="flex items-center gap-2">
          <Button asChild type="button" variant="outline">
            <Link to={`/teams/${teamId}/milestones`}>View all</Link>
          </Button>
          {createButton}
        </div>
      </CardHeader>
      <CardContent>
        {query.isPending ? <p className="py-8 text-sm text-muted-foreground">Loading milestones…</p>
          : query.data?.content.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No milestones yet.</p>
          : <div className="divide-y">
            {query.data?.content.map(milestone => (
              <button type="button" key={milestone.id} className="flex w-full items-start justify-between gap-4 py-4 text-left hover:bg-muted/40"
                onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}?workspaceId=${workspaceId}`)}>
                <div className="min-w-0">
                  <p className="font-medium">{milestone.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{milestone.description || "No description available."}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3" />{new Date(milestone.deadline).toLocaleString("en-GB")}
                  </p>
                </div>
                <Badge variant="outline">{milestone.status}</Badge>
              </button>
            ))}
          </div>}
      </CardContent>
    </Card>
  );
}
