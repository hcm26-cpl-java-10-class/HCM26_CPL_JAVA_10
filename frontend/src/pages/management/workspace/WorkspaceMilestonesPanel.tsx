import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus, Bell } from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceSectionAccess } from "@/types/features/workspace";
import { usePermissions } from "@/hooks/usePermissions";

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
  const { hasPermission } = usePermissions();
  const reviewQuery = useQuery({
    queryKey: ["team-artifact-submissions", teamId],
    queryFn: () => milestoneApi.getTeamArtifactSubmissions(teamId),
    enabled: hasPermission("ARTIFACT_REVIEW"), retry: false, refetchInterval: 20_000,
  });
  const submissionCounts = new Map<string, number>();
  reviewQuery.data?.forEach(({ submission }) => submissionCounts.set(submission.milestoneId, (submissionCounts.get(submission.milestoneId) ?? 0) + 1));
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
              <div key={milestone.id} className="flex w-full items-start justify-between gap-4 py-4 text-left hover:bg-muted/40">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}?workspaceId=${workspaceId}`)}>
                <div className="min-w-0">
                  <p className="font-medium">{milestone.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{milestone.description || "No description available."}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3" />{new Date(milestone.deadline).toLocaleString("en-GB")}
                  </p>
                </div>
                </button>
                <div className="flex shrink-0 items-center gap-2"><Badge variant="outline">{milestone.status}</Badge>
                  {hasPermission("ARTIFACT_REVIEW") && (submissionCounts.get(milestone.id) ?? 0) > 0 && <Button size="sm" variant="secondary" onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}/submissions?workspaceId=${workspaceId}`)}><Bell className="size-4" />{submissionCounts.get(milestone.id)} submissions</Button>}
                </div>
              </div>
            ))}
          </div>}
      </CardContent>
    </Card>
  );
}
