import { milestoneApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { MilestoneDetailRouteState } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CalendarClock, Check, Clock, RefreshCw, UserRound } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { formatDateTime, getMilestoneApiError } from "../milestone.utils";

export function MilestoneDetailPage() {
  const { projectId, milestoneId } = useParams<{ projectId: string; milestoneId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as MilestoneDetailRouteState | null;

  const detailQuery = useQuery({
    queryKey: ["projects", projectId, "milestones", milestoneId],
    queryFn: () => milestoneApi.getDetail(projectId as string, milestoneId as string),
    enabled: !!projectId && !!milestoneId,
    retry: false,
  });

  if (detailQuery.isLoading) {
    return (
      <MainLayout pathName={{ projects: "Projects", milestones: "Milestones" }}>
        <div className="mx-auto grid w-full max-w-6xl gap-6"><Skeleton className="h-44 rounded-xl" /><div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-80 rounded-xl lg:col-span-2" /><Skeleton className="h-80 rounded-xl" /></div></div>
      </MainLayout>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    const error = getMilestoneApiError(detailQuery.error);
    return (
      <MainLayout pathName={{ projects: "Projects", milestones: "Milestones" }}>
        <Alert variant="destructive" className="mx-auto max-w-3xl">
          <AlertCircle /><AlertTitle>Could not load milestone</AlertTitle>
          <AlertDescription>
            <p>{error.message || "The milestone does not exist or is outside your permitted scope."}</p>
            {error.correlationId ? <p>Correlation ID: {error.correlationId}</p> : null}
            <div className="mt-2 flex gap-2"><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft /> Go back</Button><Button onClick={() => detailQuery.refetch()}><RefreshCw /> Try again</Button></div>
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  const milestone = detailQuery.data;
  const completedCount = milestone.checklist.filter((item) => item.completed).length;
  const progress = milestone.checklist.length ? (completedCount / milestone.checklist.length) * 100 : 0;

  return (
    <MainLayout pathName={{ projects: "Projects", milestones: "Milestones", [milestone.id]: milestone.title }}>
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-background">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2"><Badge>{milestone.status}</Badge>{milestone.mandatory ? <Badge variant="secondary">Mandatory</Badge> : null}</div>
            <CardTitle className="mt-2 text-2xl">{milestone.title}</CardTitle>
            {milestone.description ? <CardDescription className="max-w-3xl text-sm">{milestone.description}</CardDescription> : null}
          </CardHeader>
        </Card>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4"><div><CardTitle>Acceptance checklist</CardTitle><CardDescription>{completedCount}/{milestone.checklist.length} items completed</CardDescription></div><span className="text-sm font-semibold">{Math.round(progress)}%</span></div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Progress value={progress} />
              <div className="grid gap-2">
                {[...milestone.checklist].sort((a, b) => a.orderIndex - b.orderIndex).map((item, index) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-xl border p-3">
                    <div className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border ${item.completed ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{item.completed ? <Check className="size-4" /> : index + 1}</div>
                    <div className="min-w-0 flex-1"><p className={item.completed ? "text-muted-foreground line-through" : "font-medium"}>{item.content}</p>{item.mandatory ? <Badge variant="outline" className="mt-2">Mandatory</Badge> : null}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card>
              <CardHeader><CardTitle>Milestone information</CardTitle></CardHeader>
              <CardContent className="grid gap-4 text-sm">
                <div><p className="text-muted-foreground">Project</p><p className="mt-1 font-medium">{routeState?.projectName || milestone.projectId}</p></div>
                <div><p className="text-muted-foreground">Deadline</p><p className="mt-1 flex items-center gap-2 font-medium"><CalendarClock className="size-4" /> {formatDateTime(milestone.deadline)}</p></div>
                <div><p className="text-muted-foreground">Rubric</p><p className="mt-1 font-medium">{routeState?.rubricName ? `${routeState.rubricName} · ${routeState.rubricVersion}` : milestone.rubricSnapshotId}</p></div>
                <div><p className="text-muted-foreground">Reviewer</p><p className="mt-1 flex items-center gap-2 font-medium"><UserRound className="size-4" /> {routeState?.reviewerName || milestone.reviewerId}</p></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-5" /> Late submission policy</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {milestone.latePolicyType === "NO_LATE" ? <p>Submissions are not accepted after the deadline.</p> : <div className="grid gap-2"><p>Submissions are accepted until <strong>{formatDateTime(milestone.lateUntil)}</strong>.</p><p>Penalty: <strong>{milestone.latePenaltyPercent}%</strong>.</p></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>System data</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm"><div><p className="text-muted-foreground">Created at</p><p>{formatDateTime(milestone.createdAt)}</p></div><div><p className="text-muted-foreground">Version</p><p>{milestone.version}</p></div></CardContent>
            </Card>
          </div>
        </div>

        <div><Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="size-4" /> Go back</Button></div>
      </div>
    </MainLayout>
  );
}
