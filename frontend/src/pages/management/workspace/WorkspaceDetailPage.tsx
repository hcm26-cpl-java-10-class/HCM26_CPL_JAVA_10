import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkspaceSectionKey } from "@/types/features/workspace";
import { WORKSPACE_SECTIONS, WorkspaceStatusBadge } from "./workspace.shared";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";
import { WorkspaceBusinessSectionPanel } from "./WorkspaceBusinessSectionPanel";
import { WorkspaceMilestonesPanel } from "./WorkspaceMilestonesPanel";
import { WorkspaceArtifactsPanel } from "./WorkspaceArtifactsPanel";
import { WorkspaceOverviewSection } from "./WorkspaceOverviewSection";
import { WorkspaceMembersPanel } from "./WorkspaceMembersPanel";
import { sectionAccess } from "./workspace.section-access";
import { WorkspaceTeamBoardPanel } from "./WorkspaceTeamBoardPanel";
import { WorkspaceBacklogPanel } from "./WorkspaceBacklogPanel";
import { WorkspaceProjectLogsPanel } from "./WorkspaceProjectLogsPanel";

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, activeRole } = usePermissions();
  return <WorkspaceContext key={id + ":" + user.email + ":" + activeRole} workspaceId={Number(id)} />;
}
function WorkspaceContext({ workspaceId }: { workspaceId: number }) {
  const { user, activeRole, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selected = params.get("tab") ?? "overview";
  const tab: WorkspaceSectionKey = WORKSPACE_SECTIONS.find(section => section.id === selected)?.id ?? "overview";
  const [blocked, setBlocked] = useState<WorkspaceSectionKey>();
  const validId = Number.isSafeInteger(workspaceId) && workspaceId > 0;
  const navigation = useQuery({
    queryKey: ["workspace-navigation", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.navigation(workspaceId, signal),
    enabled: validId, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always"
  });
  const reloadAccess = useCallback(() => {
    setBlocked(tab); // Unmount the panel immediately, including any open action dialog.
    void navigation.refetch().then(result => { if (result.isSuccess) setBlocked(undefined); });
  }, [tab, navigation.refetch]);
  function changeTab(value: string) {
    setParams(previous => { const next = new URLSearchParams(previous);
      if (value === "overview") next.delete("tab"); else next.set("tab", value); return next;
    }, { replace: true });
  }
  const context = navigation.data?.workspaceId === workspaceId ? navigation.data : undefined;
  const sections = context?.sections.map(item => {
    const resolved = sectionAccess(item, hasPermission);
    // Team-only workspaces own their Board through the workspace Team, so the
    // Board remains available even when legacy section permissions are absent.
    return item.key === "sprints" && Number.isSafeInteger(context.teamId)
      ? { ...resolved, canRead: hasPermission("WORKSPACE_READ") || hasPermission("VIEW_PROJECT_WORKSPACE") }
      : resolved;
  }) ?? [];
  const current = sections.find(item => item.key === tab);
  const members = sections.find(item => item.key === "members");
  const denied = blocked === tab || !current?.canRead;
  const validContext = context && Number.isSafeInteger(context.teamId);
  async function refresh() {
    await navigation.refetch();
    await Promise.all(["workspace-detail", "workspace-members", "workspace-section"].map(key =>
      queryClient.invalidateQueries({ queryKey: [key, workspaceId] })));
  }
  return <MainLayout pathName={{ management: "Management", workspaces: "Workspace",
    [String(workspaceId)]: navigation.isError ? "Workspace details" : context?.projectName ?? context?.teamName ?? "Workspace details" }}>
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" asChild><Link to="/management/workspaces/candidates"><ArrowLeft />Workspace list</Link></Button>
        <Button variant="outline" disabled={!validId || navigation.isFetching} onClick={() => void refresh()}><RefreshCw />Refresh access</Button>
      </div>
      {!validId || navigation.isError || navigation.isPending || !validContext
        ? <WorkspaceSectionState loading={validId && navigation.isPending} denied={sectionForbidden(navigation.error)}
            error={navigation.error} retry={() => void navigation.refetch()} />
        : <>
          <Card><CardHeader><div className="flex items-center justify-between gap-3">
            <div className="space-y-2"><Badge variant="outline">{context.projectCode ?? "TEAM-ONLY"}</Badge>
              <CardTitle>{context.projectName ?? "Team workspace"}</CardTitle><p className="text-sm text-muted-foreground">{context.teamName}</p></div>
            {context.projectStatus && <WorkspaceStatusBadge status={context.projectStatus} />}
          </div></CardHeader></Card>
          <Tabs value={tab} onValueChange={changeTab} className="gap-5">
            <div className="overflow-x-auto border-b pb-1"><TabsList variant="line" aria-label="Workspace sections"
              className="w-max min-w-full justify-start">{WORKSPACE_SECTIONS.map(({ id, label, icon: Icon }) =>
              <TabsTrigger key={id} value={id} disabled={!sections.find(item => item.key === id)?.canRead}
                className="gap-2 px-4 py-2"><Icon />{label}</TabsTrigger>)}</TabsList></div>
            <TabsContent key={tab} value={tab} className="space-y-5">
              {denied || !current ? <WorkspaceSectionState denied retry={reloadAccess} />
                : tab === "overview" ? <WorkspaceOverviewSection workspaceId={workspaceId} projectId={context.projectId}
                    teamId={context.teamId} canViewMembers={!!members?.canRead} onViewMembers={() => changeTab("members")}
                    onAccessChanged={reloadAccess} />
                : tab === "members" ? <>
                    <WorkspaceMembersPanel workspaceId={workspaceId} teamId={context.teamId} canViewMembers
                      canManageMembers={current.actions.manage} onAccessChanged={reloadAccess} />
                    <WorkspaceOverviewSection workspaceId={workspaceId} projectId={context.projectId} teamId={context.teamId}
                      charter canManageMembers={current.actions.manage} canViewMembers onViewMembers={() => changeTab("members")}
                      onAccessChanged={reloadAccess} />
                  </>
                : tab === "milestones" ? <WorkspaceMilestonesPanel workspaceId={workspaceId} projectId={context.projectId}
                    teamId={context.teamId} access={current} />
                : tab === "artifacts" ? <WorkspaceArtifactsPanel workspaceId={workspaceId} projectId={context.projectId}
                    teamId={context.teamId} access={current} />
                : tab === "sprints" ? <WorkspaceTeamBoardPanel workspaceId={workspaceId} teamId={context.teamId}
                    canUpdate={hasPermission("SPRINT_BACKLOG_UPDATE")}
                    canMove={hasPermission("SPRINT_UPDATE")}
                    canDelete={hasPermission("SPRINT_BACKLOG_DELETE")}
                    canConfigureColumns={current.actions.configureBoard === true}
                    onCreateWorkItem={sections.find(item => item.key === "backlog")?.canRead ? () => changeTab("backlog") : undefined} />
                : tab === "backlog" ? <WorkspaceBacklogPanel projectId={context.projectId}
                    teamId={context.teamId} taskKeyPrefix={context.taskKeyPrefix} />
                : tab === "activity" ? <WorkspaceProjectLogsPanel workspaceId={workspaceId} />
                : <WorkspaceBusinessSectionPanel key={workspaceId + ":" + tab} workspaceId={workspaceId}
                    projectId={context.projectId} teamId={context.teamId} section={tab}
                    label={WORKSPACE_SECTIONS.find(section => section.id === tab)!.label}
                    access={current} onAccessChanged={reloadAccess} />}
            </TabsContent>
          </Tabs>
        </>}
    </div>
  </MainLayout>;
}
