import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Plus, ClipboardCheck, Eye, Pencil, Trash2, Upload } from "lucide-react";
import { milestoneApi } from "@/api/features/milestone.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ConfirmDialog from "@/components/ui/confirmdialog";
import { MilestoneStatusBadge } from "@/pages/management/project/milestone/components/MilestoneStatusBadge";
import { OpenTeamMilestoneButton } from "@/pages/management/project/milestone/components/OpenTeamMilestoneButton";
import { getMilestoneApiError } from "@/pages/management/project/milestone/milestone.utils";
import type { MilestoneListItem } from "@/types";
import type { WorkspaceSectionAccess } from "@/types/features/workspace";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import { useState } from "react";

export function WorkspaceMilestonesPanel({ projectId, teamId, workspaceId, access: _access }: {
  projectId?: number | null;
  teamId: number;
  workspaceId: number;
  access: WorkspaceSectionAccess;
}) {
  const [pendingDelete, setPendingDelete] = useState<MilestoneListItem | null>(null);
  const { activeRole } = usePermissions();
  const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["workspace-milestones", projectId, teamId],
    queryFn: () => milestoneApi.getTeamList(teamId, { page: 0, size: 100 }),
    retry: false,
    refetchInterval: 30_000,
  });
  const reviewQuery = useQuery({
    queryKey: ["team-artifact-submissions", teamId],
    queryFn: () => milestoneApi.getTeamArtifactSubmissions(teamId),
    retry: false, refetchInterval: 20_000, enabled: !isStudent,
  });
  const submissionCounts = new Map<string, number>();
  reviewQuery.data?.forEach(({ submission }) => submissionCounts.set(submission.milestoneId, (submissionCounts.get(submission.milestoneId) ?? 0) + 1));
  const navigate = useNavigate();
  const deleteMilestone = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => milestoneApi.deleteDraft(projectId ? String(projectId) : undefined, teamId, id, version),
    onSuccess: () => {
      setPendingDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["workspace-milestones", projectId, teamId] });
    },
  });
  const createButton = (
    <Button type="button" title="Create milestone in this workspace"
      onClick={() => navigate(projectId
        ? `/projects/${projectId}/milestones/new?teamId=${teamId}&scope=team&workspaceId=${workspaceId}`
        : `/teams/${teamId}/milestones/new?workspaceId=${workspaceId}`)}>
      <Plus />Create milestone
    </Button>
  );
  const rowColumns = "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(160px,0.8fr)_minmax(100px,0.6fr)_220px]";
  if (query.error) {
    return (
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Milestones</CardTitle>
          {!isStudent && createButton}
        </CardHeader>
        <CardContent>
          <p className="rounded-md border p-6 text-sm text-muted-foreground">Unable to load milestones.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Milestones</CardTitle>
        {!isStudent && createButton}
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        {query.isPending ? <p className="py-5 text-sm text-muted-foreground">Loading milestones…</p>
          : query.data?.content.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">No milestones yet.</p>
          : <div className="overflow-hidden rounded-md border">
            <div className={`hidden gap-4 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground lg:grid ${rowColumns}`}>
              <span>Milestone</span><span>Description</span><span>Deadline</span><span>Status</span><span className="text-right">Actions</span>
            </div>
            {query.data?.content.map(milestone => (
              <div key={milestone.id} className={`grid min-h-12 gap-2 border-b px-3 py-3 text-left last:border-b-0 hover:bg-muted/40 lg:items-center lg:gap-4 ${rowColumns}`}>
                <button type="button" className="min-w-0 truncate text-left text-sm font-medium hover:underline" title={milestone.title} onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}?workspaceId=${workspaceId}`)}>{milestone.title}</button>
                <p className="min-w-0 truncate text-xs text-muted-foreground" title={milestone.description || "No description available."}>{milestone.description || "No description available."}</p>
                <p className="flex min-w-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground"><CalendarClock className="size-3 shrink-0" />{new Date(milestone.deadline).toLocaleString("en-GB")}</p>
                <Badge variant="outline" className="h-6 w-fit px-2 text-[11px]"><MilestoneStatusBadge status={milestone.lifecycleStatus} /></Badge>
                <div className="flex min-w-0 flex-wrap items-center gap-1 lg:justify-end">
                  <OpenTeamMilestoneButton compact teamId={teamId} milestoneId={milestone.id} title={milestone.title} lifecycleStatus={milestone.lifecycleStatus} />
                  {!isStudent && (milestone.lifecycleStatus === "PLANNED" || milestone.lifecycleStatus === "IN_PROGRESS" || milestone.lifecycleStatus === "CHANGES_REQUESTED") && <>
                    <Button size="icon" variant="ghost" className="size-8" title="Edit milestone" aria-label={`Edit ${milestone.title}`} onClick={() => navigate(milestone.lifecycleStatus === "PLANNED"
                      ? projectId ? `/projects/${projectId}/milestones/${milestone.id}/edit?teamId=${teamId}&scope=team&workspaceId=${workspaceId}` : `/teams/${teamId}/milestones/${milestone.id}/edit?workspaceId=${workspaceId}`
                      : `/teams/${teamId}/milestones/${milestone.id}/edit?workspaceId=${workspaceId}`)}><Pencil className="size-4" /></Button>
                    {milestone.lifecycleStatus === "PLANNED" &&
                    <Button size="icon" variant="ghost" className="size-8 text-destructive" title="Delete milestone" aria-label={`Delete ${milestone.title}`} disabled={deleteMilestone.isPending} onClick={() => { deleteMilestone.reset(); setPendingDelete(milestone); }}><Trash2 className="size-4" /></Button>
                    }
                  </>}
                  <Button size="icon" variant="ghost" className="size-8" title="View milestone" aria-label={`View ${milestone.title}`} onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}?workspaceId=${workspaceId}`)}><Eye className="size-4" /></Button>
                  {isStudent && (milestone.lifecycleStatus === "IN_PROGRESS" || milestone.lifecycleStatus === "CHANGES_REQUESTED") &&
                    <Button size="icon" variant="ghost" className="size-8" title="Prepare and submit artifact" aria-label={`Submit artifact for ${milestone.title}`} onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}/submit?workspaceId=${workspaceId}`)}><Upload className="size-4" /></Button>}
                  {isStudent
                    ? <Button asChild size="icon" variant="secondary" className="size-8" title="View my submissions"><Link aria-label={`View my submissions for ${milestone.title}`} to={`/student/teams/${teamId}/milestones/${milestone.id}/submissions?workspaceId=${workspaceId}`}><ClipboardCheck className="size-4" /></Link></Button>
                    : <Button size="icon" variant="secondary" className="relative size-8" title="Review submissions" aria-label={`Review submissions for ${milestone.title} (${submissionCounts.get(milestone.id) ?? 0})`} onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}/submissions?workspaceId=${workspaceId}`)}><ClipboardCheck className="size-4" /><span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-background px-1 text-[10px] leading-4 text-foreground ring-1 ring-border">{submissionCounts.get(milestone.id) ?? 0}</span></Button>}
                </div>
              </div>
            ))}
          </div>}
      </CardContent>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete milestone?"
        description={<div className="space-y-2"><p><strong>{pendingDelete?.title}</strong> will be removed from this workspace.</p>{deleteMilestone.isError && <p className="text-destructive">{getMilestoneApiError(deleteMilestone.error).message}</p>}</div>}
        confirmLabel="Delete milestone"
        loading={deleteMilestone.isPending}
        onCancel={() => { if (!deleteMilestone.isPending) setPendingDelete(null); }}
        onConfirm={() => { if (pendingDelete) deleteMilestone.mutate({ id: pendingDelete.id, version: pendingDelete.version }); }}
      />
    </Card>
  );
}
