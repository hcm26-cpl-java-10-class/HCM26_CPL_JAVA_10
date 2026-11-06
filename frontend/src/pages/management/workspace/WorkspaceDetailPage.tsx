import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Hash, RefreshCw, Users } from "lucide-react";
import { workspaceApi } from "@/api/features/workspace.api";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { WorkspaceProjectHierarchy, flattenWorkspaceProjects } from "./WorkspaceProjectHierarchy";
import { ProjectCompletionPanel } from "./ProjectCompletionPanel";
import { WorkspaceMasterMilestonesPanel } from "./WorkspaceMasterMilestonesPanel";
import { WorkspaceResourcesPanel } from "./WorkspaceResourcesPanel";
import { WorkspaceAlertsPanel } from "@/pages/management/alerts/WorkspaceAlertsPanel";

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
  const [showAccess, setShowAccess] = useState(false);
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
  const hierarchy = useQuery({
    queryKey: ["workspace-project-hierarchy", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => projectAssignmentApi.workspace(workspaceId, signal),
    enabled: validId && navigation.isSuccess, retry: false, staleTime: 0,
  });
  const projects = flattenWorkspaceProjects(hierarchy.data?.projects ?? []).filter(project => project.assigned);
  const requestedProject = params.get("project");
  const project = projects.find(item => item.id === (requestedProject ? Number(requestedProject) : context?.projectId));
  const invalidProject = requestedProject !== null && hierarchy.isSuccess && !project;
  const projectId = project?.id ?? context?.projectId;
  const projectReadOnly = !!hierarchy.data?.readOnly || ["COMPLETED", "CANCELLED"].includes(project?.status ?? context?.projectStatus ?? "");
  const projectScoped = hierarchy.data?.assignmentId != null || !!hierarchy.data?.readOnly;
  const isMaster = hierarchy.data?.assignmentId != null && project?.parentProjectId == null;
  const sharedMasterSelected = isMaster && hierarchy.data?.mode === "SPLIT";
  function selectProject(projectId: number) {
    setParams(previous => { const next = new URLSearchParams(previous); next.set("project", String(projectId)); return next; }, { replace: true });
  }
  const sections = context?.sections.map(item => {
    const permissions = projectReadOnly ? { ...item, actions: Object.fromEntries(Object.keys(item.actions).map(action => [action, false])) } : item;
    const resolved = sectionAccess(permissions, hasPermission);
    // Team-only workspaces own their Board through the workspace Team, so the
    // Board remains available even when legacy section permissions are absent.
    return (item.key === "sprints" || item.key === "feedback") && Number.isSafeInteger(context.teamId)
      ? { ...resolved, canRead: hasPermission("WORKSPACE_READ") || hasPermission("VIEW_PROJECT_WORKSPACE") }
      : resolved;
  }) ?? [];
  const current = sections.find(item => item.key === tab);
  const members = sections.find(item => item.key === "members");
  const denied = blocked === tab || !current?.canRead;
  const validContext = context && Number.isSafeInteger(context.teamId);
  async function refresh() {
    await Promise.all([navigation.refetch(), hierarchy.refetch()]);
    await Promise.all(["workspace-detail", "workspace-members", "workspace-section", "workspace-resources"].map(key =>
      queryClient.invalidateQueries({ queryKey: [key, workspaceId] })));
  }
  return <MainLayout contentClassName="bg-slate-50/70 dark:bg-background" pathName={{ management: "Management", workspaces: "Workspace",
    [String(workspaceId)]: navigation.isError ? "Workspace details" : context?.projectName ?? context?.teamName ?? "Workspace details" }}>
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild><Link to="/management/workspaces/candidates"><ArrowLeft />Workspace list</Link></Button>
        <Button variant="outline" size="sm" disabled={!validId || navigation.isFetching} onClick={() => void refresh()}><RefreshCw className={navigation.isFetching ? "animate-spin" : undefined} />Refresh access</Button>
      </div>
      {invalidProject ? <p role="alert" className="rounded-lg border p-5 text-destructive">The selected project is outside this workspace.</p>
        : !validId || navigation.isError || navigation.isPending || hierarchy.isError || hierarchy.isPending || !validContext
        ? <WorkspaceSectionState loading={validId && (navigation.isPending || hierarchy.isPending)} denied={sectionForbidden(navigation.error ?? hierarchy.error)}
            error={navigation.error ?? hierarchy.error} retry={() => void refresh()} />
        : <>
          <section aria-label="Workspace heading" className="flex flex-wrap items-start justify-between gap-3 pt-1">
            <div className="min-w-0 flex-1 basis-60 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="max-w-full gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400"><Hash className="size-3" /><span className="min-w-0 whitespace-normal break-words">{context.projectCode ?? "TEAM-ONLY"}</span></Badge>
                <span className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground"><Users className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">{context.teamName}</span></span>
              </div>
              <h1 className="break-words text-xl font-bold leading-8 tracking-tight sm:text-2xl">{context.projectName ?? "Team workspace"}</h1>
            </div>
            {context.projectStatus && <div className="pt-1 sm:pt-6"><WorkspaceStatusBadge status={context.projectStatus} colored /></div>}
          </section>
          {hierarchy.data && <WorkspaceProjectHierarchy data={hierarchy.data} selectedId={projectId} onSelect={selectProject} />}
          {projectScoped && projectId && !sharedMasterSelected && <ProjectCompletionPanel key={`${projectId}:${context.teamId}`} workspaceId={workspaceId}
            projectId={projectId} teamId={context.teamId} readOnly={projectReadOnly} onChanged={() => void refresh()}
            title={`${isMaster ? "Master" : "Module"} completion — ${project?.name ?? context.projectName}`} />}
          <Tabs value={tab} onValueChange={changeTab} className="min-w-0 gap-5">
            <div className="min-w-0 overflow-x-auto overflow-y-hidden border-b"><TabsList aria-label="Workspace sections"
              className="h-10 w-max min-w-full justify-start gap-1 rounded-none bg-transparent p-0 align-top group-data-[orientation=horizontal]/tabs:h-10">{WORKSPACE_SECTIONS.map(({ id, label, icon: Icon }) =>
              <TabsTrigger key={id} value={id} disabled={!sections.find(item => item.key === id)?.canRead}
                className="h-10 flex-none gap-2 rounded-none rounded-t-md border-0 border-b-2 border-transparent px-3 text-xs text-muted-foreground shadow-none after:hidden data-[state=active]:border-foreground data-[state=active]:bg-muted/40 data-[state=active]:text-foreground dark:data-[state=active]:bg-muted/30 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-none"><Icon className="size-4" />{label}</TabsTrigger>)}</TabsList></div>
            <TabsContent key={tab} value={tab} className="space-y-5">
              {denied || !current ? <WorkspaceSectionState denied retry={reloadAccess} />
                : tab === "overview" ? <WorkspaceOverviewSection workspaceId={workspaceId} projectId={context.projectId} selectedProject={projectScoped ? project : undefined}
                    teamId={context.teamId} canViewMembers={!!members?.canRead} onViewMembers={() => changeTab("members")}
                    onViewAccess={() => setShowAccess(true)}
                    onAccessChanged={reloadAccess} />
                : tab === "members" ? <WorkspaceMembersPanel workspaceId={workspaceId} teamId={context.teamId}
                    classId={context.classId} allocationSessionId={context.allocationSessionId} canViewMembers
                    onAccessChanged={reloadAccess} />
                : tab === "resources" ? <WorkspaceResourcesPanel key={projectId} workspaceId={workspaceId} projectId={context.projectId}
                    teamId={context.teamId} selectedProjectId={projectId} onAccessChanged={reloadAccess} />
                : tab === "milestones" ? <>
                    {hierarchy.data?.assignmentId != null && (!isMaster || hierarchy.data.mode === "SPLIT") &&
                      <WorkspaceMasterMilestonesPanel workspaceId={workspaceId} onOpenMaster={selectProject} onChanged={() => void refresh()} />}
                    {!sharedMasterSelected && <WorkspaceMilestonesPanel key={projectId} workspaceId={workspaceId} projectId={projectId}
                      teamId={context.teamId} access={current} projectScoped={projectScoped} readOnly={projectReadOnly}
                      title={hierarchy.data?.assignmentId != null ? `${isMaster ? "Master" : "Module"} milestones — ${project?.name ?? context.projectName}` : undefined} />}
                  </>
                : tab === "artifacts" ? <WorkspaceArtifactsPanel key={projectId} workspaceId={workspaceId} projectId={projectId}
                    teamId={context.teamId} access={current} projectScoped={projectScoped} readOnly={projectReadOnly} />
                : tab === "sprints" ? <WorkspaceTeamBoardPanel key={projectId} workspaceId={workspaceId} teamId={context.teamId}
                    projectId={projectId} readOnly={projectReadOnly}
                    canUpdate={!projectReadOnly && hasPermission("SPRINT_BACKLOG_UPDATE")}
                    canMove={!projectReadOnly && hasPermission("SPRINT_UPDATE")}
                    canDelete={!projectReadOnly && hasPermission("SPRINT_BACKLOG_DELETE")}
                    onCreateWorkItem={sections.find(item => item.key === "backlog")?.canRead ? () => changeTab("backlog") : undefined} />
                : tab === "backlog" ? <WorkspaceBacklogPanel key={projectId} workspaceId={workspaceId} projectId={projectId}
                    teamId={context.teamId} projectName={project?.name ?? context.projectName}
                    taskKeyPrefix={context.taskKeyPrefix} readOnly={projectReadOnly} />
                : tab === "activity" ? <WorkspaceProjectLogsPanel workspaceId={workspaceId} readOnly={projectReadOnly} />
                : tab === "feedback" ? <WorkspaceAlertsPanel workspaceId={workspaceId} teamId={context.teamId} />
                : <WorkspaceBusinessSectionPanel key={workspaceId + ":" + tab} workspaceId={workspaceId}
                    projectId={context.projectId} teamId={context.teamId} section={tab}
                    label={WORKSPACE_SECTIONS.find(section => section.id === tab)!.label}
                    access={current} onAccessChanged={reloadAccess} />}
            </TabsContent>
          </Tabs>
        </>}
      <Dialog open={showAccess} onOpenChange={setShowAccess}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Quyền truy cập Workspace</DialogTitle><DialogDescription>Các mục có thể truy cập theo vai trò đang sử dụng.</DialogDescription></DialogHeader>
          <ul className="divide-y rounded-lg border">{WORKSPACE_SECTIONS.map(({ id, label, icon: Icon }) => <li key={id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"><span className="flex items-center gap-2 text-xs"><Icon className="size-4 text-muted-foreground" />{label}</span><Badge variant={sections.find(item => item.key === id)?.canRead ? "secondary" : "outline"} className="text-[10px]">{sections.find(item => item.key === id)?.canRead ? "Có thể xem" : "Không có quyền"}</Badge></li>)}</ul>
        </DialogContent>
      </Dialog>
    </div>
  </MainLayout>;
}
