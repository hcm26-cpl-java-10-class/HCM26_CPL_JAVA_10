import { milestoneApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { MilestoneDetailRouteState } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Check, Clock, Globe2 } from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MilestoneDetailError } from "../components/MilestoneDetailError";
import { MilestoneRubricCard } from "../components/MilestoneRubricCard";
import { MilestoneStatusBadge } from "../components/MilestoneStatusBadge";
import { formatPenalty, formatTenantDateTime, getMilestoneApiError } from "../milestone.utils";

function DetailPageSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <Skeleton className="h-44 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="grid gap-6"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>
        <div className="grid gap-6"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
      </div>
    </div>
  );
}

export function MilestoneDetailPage() {
  const { projectId, milestoneId } = useParams<{ projectId: string; milestoneId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const teamIdParam = searchParams.get("teamId");
  const teamId = teamIdParam ? Number(teamIdParam) : undefined;
  const routeState = location.state as MilestoneDetailRouteState | null;
  const defaultListUrl = projectId ? `/projects/${projectId}/milestones` : "/teacher";
  const returnUrl = routeState?.returnTo?.startsWith(`/projects/${projectId}/milestones`)
    ? routeState.returnTo
    : defaultListUrl;

  const detailQuery = useQuery({
    queryKey: ["projects", projectId, "milestones", milestoneId, teamId],
    queryFn: () => milestoneApi.getDetail(projectId as string, milestoneId as string, teamId),
    enabled: Boolean(projectId && milestoneId),
    retry: false,
  });

  if (detailQuery.isLoading) {
    return <MainLayout pathName={{ projects: "Projects", milestones: "Milestones" }}><DetailPageSkeleton /></MainLayout>;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <MainLayout pathName={{ projects: "Projects", milestones: "Milestones" }}>
        <MilestoneDetailError
          error={getMilestoneApiError(detailQuery.error)}
          onBack={() => navigate(returnUrl)}
          onRetry={() => void detailQuery.refetch()}
        />
      </MainLayout>
    );
  }

  const milestone = detailQuery.data;
  const orderedChecklist = [...milestone.checklist].sort((a, b) => a.orderIndex - b.orderIndex);
  const completedCount = orderedChecklist.filter((item) => item.completed).length;
  const progress = orderedChecklist.length ? (completedCount / orderedChecklist.length) * 100 : 0;
  const breadcrumbs = {
    projects: "Projects",
    [milestone.project.id]: milestone.project.name,
    milestones: "Milestones",
    [milestone.id]: milestone.title,
  };

  return (
    <MainLayout pathName={breadcrumbs}>
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <MilestoneStatusBadge status={milestone.status} />
              {milestone.mandatory ? <Badge variant="secondary">Mandatory</Badge> : null}
            </div>
            <CardTitle className="mt-2 text-2xl">{milestone.title}</CardTitle>
            {milestone.description ? <CardDescription className="max-w-3xl whitespace-pre-wrap text-sm">{milestone.description}</CardDescription> : null}
          </CardHeader>
        </Card>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div><CardTitle>Acceptance checklist</CardTitle><CardDescription>{orderedChecklist.length ? `${completedCount}/${orderedChecklist.length} items completed` : "No checklist items stored"}</CardDescription></div>
                  {orderedChecklist.length ? <span className="text-sm font-semibold">{Math.round(progress)}%</span> : null}
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                {orderedChecklist.length ? (
                  <>
                    <Progress value={progress} />
                    <div className="grid gap-2">
                      {orderedChecklist.map((item, index) => (
                        <div key={item.id} className="flex items-start gap-3 rounded-xl border p-3">
                          <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${item.completed ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{item.completed ? <Check className="size-4" /> : index + 1}</div>
                          <div className="min-w-0 flex-1"><p className={item.completed ? "text-muted-foreground line-through" : "font-medium"}>{item.content}</p>{item.mandatory ? <Badge variant="outline" className="mt-2">Mandatory</Badge> : null}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No checklist items were stored for this milestone.</p>
                )}
              </CardContent>
            </Card>

            <MilestoneRubricCard rubric={milestone.rubric} />
          </div>

          <div className="grid gap-6">
            <Card>
              <CardHeader><CardTitle>Milestone information</CardTitle></CardHeader>
              <CardContent className="grid gap-4 text-sm">
                <div><p className="text-muted-foreground">Project</p><p className="mt-1 font-medium">{milestone.project.name}</p></div>
                <div><p className="text-muted-foreground">Deadline</p><p className="mt-1 flex items-start gap-2 font-medium"><CalendarClock className="mt-0.5 size-4 shrink-0" /> {formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)}</p></div>
                <div><p className="text-muted-foreground">Tenant timezone</p><p className="mt-1 flex items-center gap-2 font-medium"><Globe2 className="size-4" /> {milestone.tenantTimeZone}</p></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-5" /> Late submission policy</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {milestone.latePolicy.type === "NO_LATE" ? (
                  <div className="grid gap-2"><Badge variant="outline">No late submissions</Badge><p>The deadline is final. Submissions are not accepted after it.</p></div>
                ) : (
                  <div className="grid gap-3">
                    <Badge variant="secondary">Late submissions allowed</Badge>
                    <div><p className="text-muted-foreground">Accepted until</p><p className="mt-1 font-semibold">{formatTenantDateTime(milestone.latePolicy.lateUntil, milestone.tenantTimeZone)}</p></div>
                    <div><p className="text-muted-foreground">Penalty</p><p className="mt-1 font-semibold">{formatPenalty(milestone.latePolicy.penaltyPercent)}</p></div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>System data</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div><p className="text-muted-foreground">Created at</p><p className="mt-1">{formatTenantDateTime(milestone.createdAt, milestone.tenantTimeZone)}</p></div>
                <div><p className="text-muted-foreground">Version</p><p className="mt-1">{milestone.version}</p></div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => navigate(returnUrl)}><ArrowLeft className="size-4" /> Back to milestones</Button>
          <Button onClick={() => navigate(`/projects/${projectId}/milestones/${milestone.id}/submit`)}>Prepare artifact</Button></div>
      </div>
    </MainLayout>
  );
}
