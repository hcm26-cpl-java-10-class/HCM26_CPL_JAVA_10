import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceOverviewPanel } from "./WorkspaceOverviewPanel";
import { TeamCharterForm } from "./TeamCharterForm";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";

export function WorkspaceOverviewSection({ workspaceId, projectId, teamId, canViewMembers, onViewMembers,
  onAccessChanged, charter = false, canManageMembers = false }: {
  workspaceId: number; projectId: number; teamId: number; canViewMembers: boolean; onViewMembers: () => void;
  onAccessChanged: () => void; charter?: boolean; canManageMembers?: boolean;
}) {
  const { user, activeRole } = usePermissions();
  const query = useQuery({
    queryKey: ["workspace-detail", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.getById(workspaceId, signal),
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always"
  });
  const denied = sectionForbidden(query.error);
  useEffect(() => { if (denied) onAccessChanged(); }, [denied, onAccessChanged]);
  if (query.isError || query.isPending || query.isFetching)
    return <WorkspaceSectionState loading={!query.isError && query.isFetching} denied={denied} error={query.error}
      retry={() => denied ? onAccessChanged() : void query.refetch()} />;
  const workspace = query.data;
  if (!workspace || workspace.id !== workspaceId || workspace.teamId !== teamId || workspace.projectId !== projectId)
    return <WorkspaceSectionState error={new Error("Overview context does not match this workspace.")} retry={() => void query.refetch()} />;
  return charter ? <Card><CardHeader><CardTitle>Team charter</CardTitle></CardHeader><CardContent>
    <TeamCharterForm key={teamId} teamId={teamId} initial={workspace.charter}
      canManage={canManageMembers} onAccessChanged={onAccessChanged} />
  </CardContent></Card> : <WorkspaceOverviewPanel workspace={workspace}
    canViewMembers={canViewMembers && workspace.can_view_members} onViewMembers={onViewMembers} />;
}
