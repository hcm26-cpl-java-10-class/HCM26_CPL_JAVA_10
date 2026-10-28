import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus, ClipboardCheck, Eye } from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceSectionAccess } from "@/types/features/workspace";

export function WorkspaceMilestonesPanel({ projectId, teamId, workspaceId, access: _access }: {
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
  const reviewQuery = useQuery({
    queryKey: ["team-artifact-submissions", teamId],
    queryFn: () => milestoneApi.getTeamArtifactSubmissions(teamId),
    retry: false, refetchInterval: 20_000,
  });
  const submissionCounts = new Map<string, number>();
  reviewQuery.data?.forEach(({ submission }) => submissionCounts.set(submission.milestoneId, (submissionCounts.get(submission.milestoneId) ?? 0) + 1));
  const navigate = useNavigate();
  const createButton = (
    <Button type="button" title="Create milestone in this workspace"
      onClick={() => navigate(projectId
        ? `/projects/${projectId}/milestones/new?teamId=${teamId}&scope=team&workspaceId=${workspaceId}`
        : `/teams/${teamId}/milestones/new?workspaceId=${workspaceId}`)}>
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
      <CardContent className="px-4 pb-4 pt-0">
        {query.isPending ? <p className="py-5 text-sm text-muted-foreground">Loading milestones…</p>
          : query.data?.content.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">No milestones yet.</p>
          : <div className="overflow-hidden rounded-md border">
            {query.data?.content.map(milestone => (
              <div key={milestone.id} className="flex min-h-12 w-full items-center gap-3 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/40">
                <button type="button" className="grid min-w-0 flex-1 gap-0.5 text-left md:grid-cols-[minmax(180px,0.8fr)_minmax(220px,1.4fr)_auto] md:items-center md:gap-4" onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}?workspaceId=${workspaceId}`)}>
                  <p className="truncate text-sm font-medium" title={milestone.title}>{milestone.title}</p>
                  <p className="truncate text-xs text-muted-foreground" title={milestone.description || "No description available."}>{milestone.description || "No description available."}</p>
                  <p className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                    <CalendarClock className="size-3 shrink-0" />{new Date(milestone.deadline).toLocaleString("en-GB")}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-1.5"><Badge variant="outline" className="h-6 px-2 text-[11px]">{milestone.status}</Badge>
                  <Button size="sm" variant="ghost" className="h-8 px-2" title="View milestone" onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}?workspaceId=${workspaceId}`)}><Eye className="size-3.5" /><span className="hidden lg:inline">View</span></Button>
                  <Button size="sm" variant="secondary" className="h-8 px-2" title="Review submissions" onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}/submissions?workspaceId=${workspaceId}`)}><ClipboardCheck className="size-3.5" /><span className="hidden lg:inline">Review</span><span>{submissionCounts.get(milestone.id) ?? 0}</span></Button>
                </div>
              </div>
            ))}
          </div>}
      </CardContent>
    </Card>
  );
}
