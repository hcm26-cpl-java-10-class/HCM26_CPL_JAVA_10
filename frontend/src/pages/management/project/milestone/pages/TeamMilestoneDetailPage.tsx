import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CalendarClock, Clock3, Globe2, ListChecks, RotateCw } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { milestoneApi } from "@/api/features/milestone.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import { MilestoneRubricCard } from "@/pages/management/project/milestone/components/MilestoneRubricCard";
import { MilestoneStatusBadge } from "@/pages/management/project/milestone/components/MilestoneStatusBadge";
import { formatPenalty, formatTenantDateTime } from "@/pages/management/project/milestone/milestone.utils";

export function TeamMilestoneDetailPage() {
  const { teamId: teamIdParam, milestoneId } = useParams<{ teamId: string; milestoneId: string }>();
  const teamId = Number(teamIdParam);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { hasPermission, activeRole } = usePermissions();
  const queryClient = useQueryClient();
  const isStudent = String(activeRole).toUpperCase().includes("STUDENT");
  const workspaceId = params.get("workspaceId");
  const query = useQuery({
    queryKey: ["team-milestone", teamId, milestoneId],
    queryFn: () => milestoneApi.getTeamDetail(teamId, milestoneId!),
    enabled: teamId > 0 && !!milestoneId,
    retry: false,
  });
  const openMilestone = useMutation({
    mutationFn: () => milestoneApi.openTeamMilestoneForSubmissions(teamId, milestoneId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["team-milestone", teamId, milestoneId] }),
  });
  const back = () => navigate(workspaceId ? `/management/workspaces/${workspaceId}?tab=milestones` : `/teams/${teamId}/milestones`);

  if (query.isPending) return <MainLayout pathName={{ milestones: "Milestone" }}>
    <div className="mx-auto grid w-full max-w-6xl gap-6"><Skeleton className="h-40 rounded-xl" /><div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div></div>
  </MainLayout>;
  if (query.isError || !query.data) return <MainLayout pathName={{ milestones: "Milestone" }}>
    <Card className="mx-auto max-w-2xl"><CardContent className="grid justify-items-start gap-4 p-6"><AlertCircle className="size-5 text-destructive" /><div><h2 className="font-semibold">Could not load milestone</h2><p className="mt-1 text-sm text-muted-foreground">The milestone may have been removed, or your account may not have access.</p></div><div className="flex gap-2"><Button variant="outline" onClick={back}><ArrowLeft />Back</Button><Button onClick={() => void query.refetch()}><RotateCw />Try again</Button></div></CardContent></Card>
  </MainLayout>;

  const milestone = query.data;
  const checklist = [...milestone.checklist].sort((a, b) => a.orderIndex - b.orderIndex);
  return <MainLayout pathName={{ milestones: "Milestones", [milestone.id]: milestone.title }}>
    <main className="mx-auto grid w-full max-w-6xl gap-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
        <CardHeader className="gap-4 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Team milestone</Badge><MilestoneStatusBadge status={milestone.status} />{milestone.mandatory && <Badge variant="secondary">Mandatory</Badge>}</div>
          <div className="grid gap-2"><CardTitle className="text-2xl md:text-3xl">{milestone.title}</CardTitle><CardDescription className="max-w-3xl whitespace-pre-wrap text-sm leading-6">{milestone.description || "No description provided."}</CardDescription></div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><CalendarClock className="size-4" />Due {formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)}</span><span className="inline-flex items-center gap-2"><Globe2 className="size-4" />{milestone.tenantTimeZone}</span></div>
        </CardHeader>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid gap-6">
          <Card>
            <CardHeader><div className="flex items-center justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><ListChecks className="size-5" />Acceptance checklist</CardTitle><CardDescription className="mt-1">{checklist.length ? `${checklist.length} acceptance criteria for this milestone` : "No checklist items configured"}</CardDescription></div>{checklist.length > 0 && <Badge variant="outline">{checklist.length} items</Badge>}</div></CardHeader>
            <CardContent className="grid gap-3">
              {checklist.length ? checklist.map((item, index) => <div key={item.id} className="flex items-start gap-3 rounded-xl border bg-card p-4"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{index + 1}</span><div className="min-w-0 flex-1"><p className="font-medium leading-6">{item.content}</p>{item.mandatory && <Badge variant="outline" className="mt-2">Required</Badge>}</div></div>) : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">The team has no acceptance criteria to review yet.</div>}
            </CardContent>
          </Card>
          {milestone.rubric && <MilestoneRubricCard rubric={milestone.rubric} />}
        </div>

        <aside className="grid gap-6">
          <Card><CardHeader><CardTitle>Milestone information</CardTitle></CardHeader><CardContent className="grid gap-4 text-sm"><div><p className="text-muted-foreground">Scope</p><p className="mt-1 font-medium">Team workspace</p></div><div><p className="text-muted-foreground">Deadline</p><p className="mt-1 flex items-start gap-2 font-medium"><CalendarClock className="mt-0.5 size-4 shrink-0" />{formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)}</p></div><div><p className="text-muted-foreground">Timezone</p><p className="mt-1 flex items-center gap-2 font-medium"><Globe2 className="size-4" />{milestone.tenantTimeZone}</p></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="size-5" />Late submission policy</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm">{milestone.latePolicy.type === "NO_LATE" ? <><Badge variant="outline" className="w-fit">No late submissions</Badge><p className="text-muted-foreground">Submissions are closed after the deadline.</p></> : <><Badge variant="secondary" className="w-fit">Late submissions allowed</Badge><div><p className="text-muted-foreground">Accepted until</p><p className="mt-1 font-medium">{formatTenantDateTime(milestone.latePolicy.lateUntil, milestone.tenantTimeZone)}</p></div><div><p className="text-muted-foreground">Penalty</p><p className="mt-1 font-medium">{formatPenalty(milestone.latePolicy.penaltyPercent)}</p></div></>}</CardContent></Card>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="outline" onClick={back}><ArrowLeft />Back to workspace</Button>
        <div className="flex flex-wrap items-center gap-2">{milestone.status === "PLANNED" && hasPermission("MILESTONE_WRITE") && <Button onClick={() => openMilestone.mutate()} disabled={openMilestone.isPending}>{openMilestone.isPending ? "Opening…" : "Open milestone"}</Button>}{milestone.status === "PLANNED" && <p className="w-full text-right text-xs text-muted-foreground">Open the milestone before students can submit.</p>}{openMilestone.isError && <p className="w-full text-right text-xs text-destructive">Could not open milestone. Check that the workspace project is active.</p>}{hasPermission("ARTIFACT_REVIEW") && <Button variant="outline" onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}/submissions?workspaceId=${workspaceId ?? ""}`)}>View submissions</Button>}{isStudent && hasPermission("ARTIFACT_READ") && <Button onClick={() => navigate(`/teams/${teamId}/milestones/${milestone.id}/submit`)}>Prepare artifact</Button>}</div>
      </div>
    </main>
  </MainLayout>;
}
