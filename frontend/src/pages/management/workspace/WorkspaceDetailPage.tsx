import { workspaceApi } from "@/api/features/workspace.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceOverviewPanel } from "./WorkspaceOverviewPanel";
import { WorkspaceMembersPanel } from "./WorkspaceMembersPanel";
import { Activity, AlertCircle, ArrowLeft, CalendarDays, CheckCheck, ClipboardList, FolderOpen, ListTodo, Loader2, MessageSquare, RefreshCw, ShieldCheck } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { TeamCharterForm } from "./TeamCharterForm";
import { formatWorkspaceDate, getWorkspaceError, WORKSPACE_SECTIONS, WorkspaceEmptyState, WorkspaceStatusBadge } from "./workspace.shared";

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const workspaceId = Number(id);
  const validId = Number.isSafeInteger(workspaceId) && workspaceId > 0;
  const query = useQuery({ queryKey: ["workspace-detail", workspaceId, user.email], queryFn: () => workspaceApi.getById(workspaceId), enabled: validId, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always" });
  const workspace = query.data?.id === workspaceId ? query.data : undefined;
  const canViewMembers = !!workspace?.can_view_members && hasPermission("WORKSPACE_MEMBER_READ");
  const selected = params.get("tab") ?? "overview";
  const tab = WORKSPACE_SECTIONS.some(section => section.id === selected) ? selected : "overview";
  function changeTab(value: string) { setParams(previous => { const next = new URLSearchParams(previous); if (value === "overview") next.delete("tab"); else next.set("tab", value); return next; }, { replace: true }); }
  const backParams = new URLSearchParams(params);
  backParams.delete("tab");
  const backUrl = `/management/workspaces/candidates${backParams.size ? `?${backParams}` : ""}`;

  return (
    <MainLayout pathName={{ management: "Management", workspaces: "Workspace", [id ?? ""]: workspace?.projectName ?? "Workspace details" }}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" asChild><Link to={backUrl}><ArrowLeft />Workspace list</Link></Button><Button variant="outline" onClick={() => void Promise.all([query.refetch(), queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] })])} disabled={!validId || query.isFetching}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />Refresh</Button></div>
        {query.isLoading || query.isFetching ? <Card><CardContent className="flex items-center justify-center gap-2 py-20"><Loader2 className="size-4 animate-spin" />Loading workspace...</CardContent></Card>
          : !validId || query.isError || !workspace ? <Card><WorkspaceEmptyState icon={AlertCircle} title="Unable to open workspace" description={!validId ? "The workspace URL is invalid." : getWorkspaceError(query.error)} action={<Button variant="outline" onClick={() => void query.refetch()} disabled={!validId}>Try again</Button>} /></Card>
          : <>
            <Card>
              <CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{workspace.projectCode}</Badge><span className="text-sm text-muted-foreground">{workspace.teamName} · {workspace.cohortName ?? "Not assigned"}</span></div><CardTitle className="text-xl">{workspace.projectName}</CardTitle><CardDescription>{workspace.projectDescription?.trim() || "No information available"}</CardDescription></div><WorkspaceStatusBadge status={workspace.projectStatus} /></div></CardHeader>
            </Card>
            <Tabs value={tab} onValueChange={changeTab} className="gap-5">
              <div className="overflow-x-auto border-b pb-1"><TabsList variant="line" aria-label="Workspace sections" className="w-max min-w-full justify-start">{WORKSPACE_SECTIONS.map(({ id: sectionId, label, icon: Icon }) => <TabsTrigger key={sectionId} value={sectionId} className="gap-2 px-4 py-2"><Icon />{label}</TabsTrigger>)}</TabsList></div>
              <TabsContent value="overview" className="space-y-5">
                <WorkspaceOverviewPanel workspace={workspace} canViewMembers={canViewMembers} onViewMembers={() => changeTab("members")} />
              </TabsContent>
              <TabsContent value="members" className="space-y-5">
                  <WorkspaceMembersPanel workspaceId={workspaceId} teamId={workspace.teamId} canViewMembers={canViewMembers} />
                  <Card><CardHeader><CardTitle>Team charter</CardTitle><CardDescription>Agree on goals, communication channels and team working rules.</CardDescription></CardHeader><CardContent><TeamCharterForm key={workspace.teamId} teamId={workspace.teamId} initial={workspace.charter} /></CardContent></Card>
              </TabsContent>
              <TabsContent value="milestones"><div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]"><Card><CardHeader><CardTitle>Milestone & Submission</CardTitle><CardDescription>The team's delivery milestones, deadlines and submission versions.</CardDescription></CardHeader><CardContent><WorkspaceEmptyState icon={CalendarDays} title="No milestones yet" description="Milestones will appear after deadlines, rubrics and late submission policies are configured. No submissions are due yet." /></CardContent></Card><Card><CardHeader><CardTitle>Acceptance criteria</CardTitle></CardHeader><CardContent className="space-y-5 text-sm"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="font-medium">Rubric</p><p className="mt-1 leading-6 text-muted-foreground">No assessment criteria or weights yet.</p></div></div><div className="flex gap-3"><CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="font-medium">Deadlines & late submissions</p><p className="mt-1 leading-6 text-muted-foreground">No deadlines or late submission policies yet.</p></div></div></CardContent></Card></div></TabsContent>
              <TabsContent value="sprints" className="space-y-5"><Card><CardHeader><CardTitle>Sprint Board</CardTitle><CardDescription>No active sprint. Tasks will be organized by their current status.</CardDescription></CardHeader></Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{["Backlog", "To do", "In progress", "Review / Done"].map(column => <Card key={column} className="min-h-72 gap-4 bg-muted/20"><CardHeader className="px-4"><div className="flex items-center justify-between"><CardTitle className="text-sm">{column}</CardTitle><Badge variant="outline">0</Badge></div></CardHeader><CardContent className="px-4"><div className="rounded-lg border border-dashed p-5 text-center text-xs leading-6 text-muted-foreground">No tasks yet</div></CardContent></Card>)}</div></TabsContent>
              <TabsContent value="backlog"><Card><CardHeader><CardTitle>Project backlog</CardTitle><CardDescription>Project tasks, priorities and assignees.</CardDescription></CardHeader><CardContent><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Priority</TableHead><TableHead>Assignee</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell colSpan={4}><WorkspaceEmptyState icon={ListTodo} title="The backlog is empty" description="Project tasks will appear here when the team starts planning." /></TableCell></TableRow></TableBody></Table></div></CardContent></Card></TabsContent>
              <TabsContent value="artifacts"><Card><CardHeader><CardTitle>Artifacts & documents</CardTitle><CardDescription>Manage deliverables, repository links and document versions.</CardDescription></CardHeader><CardContent><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Deliverable / document</TableHead><TableHead>Type</TableHead><TableHead>Version</TableHead><TableHead>Submitted by</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell colSpan={5}><WorkspaceEmptyState icon={FolderOpen} title="No artifacts yet" description="The team's documents and deliverables will appear here after they are added." /></TableCell></TableRow></TableBody></Table></div></CardContent></Card></TabsContent>
              <TabsContent value="feedback"><Card><CardHeader><CardTitle>Feedback</CardTitle><CardDescription>Mentor reviews and discussions about the team's deliverables.</CardDescription></CardHeader><CardContent><WorkspaceEmptyState icon={MessageSquare} title="No feedback yet" description="Feedback on milestones, deliverables and teamwork will appear here." /></CardContent></Card></TabsContent>
              <TabsContent value="activity" className="space-y-5"><Card><CardHeader><CardTitle>Workspace activity</CardTitle><CardDescription>Workspace creation and shared team activity.</CardDescription></CardHeader><CardContent>{workspace.activities.length ? <div className="divide-y">{workspace.activities.map(item => <div key={item.eventId} className="flex gap-3 py-4 first:pt-0 last:pb-0"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"><Activity className="size-4" /></div><div className="space-y-1"><p className="text-sm font-medium">{item.action === "WORKSPACE_CREATED" ? "Workspace created" : item.action}</p><p className="text-sm text-muted-foreground">{item.actorName} · {formatWorkspaceDate(item.occurredAt)}</p><p className="text-xs text-muted-foreground">{workspace.projectName} / {workspace.teamName}</p></div></div>)}</div> : <WorkspaceEmptyState icon={Activity} title="No activity yet" description="Recorded workspace activity will appear here." />}</CardContent></Card><Card><CardHeader><CardTitle>Risks & Decisions</CardTitle><CardDescription>Track project risks and important decisions.</CardDescription></CardHeader><CardContent><Tabs defaultValue="risks"><TabsList><TabsTrigger value="risks">Risk log</TabsTrigger><TabsTrigger value="decisions">Decision log</TabsTrigger></TabsList><TabsContent value="risks"><WorkspaceEmptyState icon={ClipboardList} title="No risks recorded" description="Risks, owners, impact and mitigation plans will appear here." /></TabsContent><TabsContent value="decisions"><WorkspaceEmptyState icon={CheckCheck} title="No decisions recorded" description="Team decisions and their rationale will appear here." /></TabsContent></Tabs></CardContent></Card></TabsContent>
            </Tabs>
          </>}
      </div>
    </MainLayout>
  );
}
