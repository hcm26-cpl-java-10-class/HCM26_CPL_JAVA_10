import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceOverviewPanel } from "./WorkspaceOverviewPanel";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";
import type { WorkspaceProjectNode } from "@/types/features/project-assignment";

export function WorkspaceOverviewSection({ workspaceId, projectId, teamId, canViewMembers, onViewMembers, selectedProject, onViewAccess,
  onAccessChanged }: {
  workspaceId: number; projectId?: number | null; teamId: number; canViewMembers: boolean; onViewMembers: () => void;
  onViewAccess: () => void;
  onAccessChanged: () => void;
  selectedProject?: WorkspaceProjectNode;
}) {
  const { user, activeRole } = usePermissions();
  const query = useQuery({
    queryKey: ["workspace-detail", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.getById(workspaceId, signal),
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always"
  });
  const denied = sectionForbidden(query.error);
  useEffect(() => { if (denied) onAccessChanged(); }, [denied, onAccessChanged]);
  // A focus/reconnect refetch must not unmount the Git/resource editors and
  // discard unsaved input. Initial loading and access errors still hide them.
  if (query.isError || query.isPending)
    return <WorkspaceSectionState loading={!query.isError && query.isFetching} denied={denied} error={query.error}
      retry={() => denied ? onAccessChanged() : void query.refetch()} />;
  const workspace = query.data;
  if (!workspace || workspace.id !== workspaceId || workspace.teamId !== teamId || workspace.projectId !== projectId)
    return <WorkspaceSectionState error={new Error("Overview context does not match this workspace.")} retry={() => void query.refetch()} />;
  return <WorkspaceOverviewPanel workspace={workspace} selectedProject={selectedProject}
    canViewMembers={canViewMembers && workspace.can_view_members} onViewMembers={onViewMembers} onViewAccess={onViewAccess} />;
}
