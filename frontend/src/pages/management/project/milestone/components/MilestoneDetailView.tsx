import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, ClipboardCheck, Clock, Globe2, Pencil, RotateCcw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import { WorkspaceArtifactsPanel } from "@/pages/management/workspace/WorkspaceArtifactsPanel";
import type { MilestoneDetailResponse } from "@/types";
import { MilestoneDraftHistory } from "./MilestoneDraftHistory";
import { MilestoneLifecycleStepper } from "./MilestoneLifecycleStepper";
import { MilestoneRubricCard } from "./MilestoneRubricCard";
import { MilestoneStatusBadge } from "./MilestoneStatusBadge";
import { MilestoneTimeline } from "./MilestoneTimeline";
import { milestoneStatusStyles } from "../milestone-status.styles";
import { tenantStartOfDay } from "../milestone-form.schema";
import { formatPenalty, formatTenantDateTime } from "../milestone.utils";

type Section = "overview" | "deliverables" | "rubric" | "history";

interface MilestoneDetailViewProps {
  milestone: MilestoneDetailResponse;
  projectId?: string;
  workspaceId?: number;
  teamId?: number;
  backLabel: string;
  onBack: () => void;
  onRefresh: () => void;
}

export function MilestoneDetailView({ milestone, projectId, workspaceId, teamId, backLabel, onBack, onRefresh }: MilestoneDetailViewProps) {
  const navigate = useNavigate();
  const { hasPermission, activeRole } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [openedAt] = useState(() => Date.now());
  const isStudent = normalizeRole(activeRole) === STUDENT_ROLE;

  const canReadArtifacts = Boolean(teamId && hasPermission("ARTIFACT_READ"));
  const canReadHistory = Boolean(projectId || (teamId && hasPermission("MILESTONE_WRITE")));
  const sections: Section[] = ["overview", ...(canReadArtifacts ? ["deliverables" as const] : []), "rubric", ...(canReadHistory ? ["history" as const] : [])];
  const requestedSection = params.get("section") as Section | null;
  const section: Section = requestedSection && sections.includes(requestedSection) ? requestedSection : "overview";

  const checklist = [...milestone.checklist].sort((a, b) => a.orderIndex - b.orderIndex);
  const completed = checklist.filter((item) => item.completed).length;
  const required = checklist.filter((item) => item.mandatory).length;
  const progress = checklist.length ? Math.round((completed / checklist.length) * 100) : 0;
  // Completion is tracked per team; without a team context only the definition is meaningful.
  const tracksCompletion = Boolean(teamId);

  const active = milestone.lifecycleStatus === "IN_PROGRESS" || milestone.lifecycleStatus === "CHANGES_REQUESTED";
  const deadlineTime = new Date(milestone.deadline).getTime();
  const deadlinePassed = active && deadlineTime < openedAt;
  const deadlineSoon = active && !deadlinePassed && deadlineTime - openedAt <= 48 * 60 * 60 * 1000;
  const scheduledStart = milestone.scheduledStartAt ?? (milestone.startDate ? tenantStartOfDay(milestone.startDate, milestone.tenantTimeZone)?.toISOString() : null);
  const lateUntil = milestone.latePolicy.type === "ALLOW_LATE" ? milestone.latePolicy.lateUntil : null;

  const query = workspaceId ? `?workspaceId=${workspaceId}` : "";
  const submitUrl = teamId ? `/teams/${teamId}/milestones/${milestone.id}/submit${query}` : "";
  const submissionsUrl = teamId
    ? `${isStudent ? "/student" : ""}/teams/${teamId}/milestones/${milestone.id}/submissions${query}`
    : "";
  const editUrl = projectId
    ? `/projects/${projectId}/milestones/${milestone.id}/edit${teamId ? `?teamId=${teamId}` : ""}`
    : teamId ? `/teams/${teamId}/milestones/${milestone.id}/edit${query}` : "";

  const canSubmit = active && Boolean(teamId) && hasPermission("ARTIFACT_SUBMIT");
  const canEdit = Boolean(editUrl) && ["PLANNED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(milestone.lifecycleStatus) && hasPermission("MILESTONE_WRITE");
  const canViewSubmissions = Boolean(submissionsUrl) && (isStudent ? hasPermission("ARTIFACT_READ") : milestone.lifecycleStatus !== "PLANNED");

  const latePolicyLabel = milestone.latePolicy.type === "NO_LATE" ? "Not allowed" : "Allowed";
  const latePolicyHint = milestone.latePolicy.type === "ALLOW_LATE"
    ? formatPenalty(milestone.latePolicy.penaltyPercent, milestone.latePolicy.penaltyBasis)
    : "Submissions close at the deadline";
  const resubmissionHint = milestone.resubmissionPolicy.allowed
    ? `${milestone.resubmissionPolicy.maxAttempts ?? "Unlimited"} attempt${milestone.resubmissionPolicy.maxAttempts === 1 ? "" : "s"}`
    : "Only one submission";

  const selectSection = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "overview") next.delete("section");
    else next.set("section", value);
    setParams(next, { replace: true });
  };

  return <main className="mx-auto grid w-full min-w-0 max-w-6xl gap-4">
    {/* Header */}
    <div className="grid gap-1">
      <Button variant="ghost" size="sm" className="-ml-3 w-fit" onClick={onBack}><ArrowLeft className="size-4" /> {backLabel}</Button>
      <Card className={cn("gap-0 overflow-hidden border-l-4 py-4 bg-gradient-to-r from-sky-50/70 via-card to-card dark:from-sky-950/20", milestoneStatusStyles[milestone.lifecycleStatus].edge)}>
        <CardHeader className="gap-4 px-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <MilestoneStatusBadge status={milestone.lifecycleStatus} />
                <Badge variant="outline">{milestone.mandatory ? "Mandatory" : "Optional"}</Badge>
                {deadlinePassed || deadlineSoon ? <Badge variant="outline" className={deadlinePassed ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"}>{deadlinePassed ? "Past due" : "Due soon"}</Badge> : null}
                <Badge variant="outline" className="gap-1 font-normal text-muted-foreground" title={latePolicyHint}><Clock className="size-3" /> Late: {latePolicyLabel.toLowerCase()}</Badge>
                <Badge variant="outline" className="gap-1 font-normal text-muted-foreground" title={resubmissionHint}><RotateCcw className="size-3" /> Resubmit: {milestone.resubmissionPolicy.allowed ? resubmissionHint : "not allowed"}</Badge>
              </div>
              <CardTitle className="mt-2 break-words text-2xl leading-tight md:text-3xl">{milestone.title}</CardTitle>
              {milestone.project?.name ? <CardDescription className="mt-1">{milestone.project.name}</CardDescription> : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {canSubmit ? <Button className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600" onClick={() => navigate(submitUrl)}><Upload className="size-4" /> {milestone.lifecycleStatus === "CHANGES_REQUESTED" ? "Resubmit artifact" : "Submit artifact"}</Button> : null}
              {canViewSubmissions ? <Button variant="outline" onClick={() => navigate(submissionsUrl)}><ClipboardCheck className="size-4" /> {isStudent ? "My submissions" : "View submissions"}</Button> : null}
              {canEdit ? <Button variant="outline" onClick={() => navigate(editUrl)}><Pencil className="size-4" /> {milestone.lifecycleStatus === "CHANGES_REQUESTED" ? "Extend deadline" : "Edit milestone"}</Button> : null}
            </div>
          </div>
          <div className="grid gap-4 border-t pt-4 lg:grid-cols-2 lg:gap-6">
            <div className="flex flex-col justify-center gap-2">
              <span className="text-sm font-medium">Progress</span>
              <MilestoneLifecycleStepper status={milestone.lifecycleStatus} />
            </div>
            <div className="border-t pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <MilestoneTimeline start={scheduledStart} deadline={milestone.deadline} lateUntil={lateUntil} timeZone={milestone.tenantTimeZone} now={openedAt} showOverdue={active} />
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>

    <Tabs value={section} onValueChange={selectSection} className="min-w-0">
      <TabsList variant="line" className="w-full max-w-full justify-start overflow-x-auto border-b pb-1">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {canReadArtifacts ? <TabsTrigger value="deliverables">Deliverables</TabsTrigger> : null}
        <TabsTrigger value="rubric">Rubric{milestone.rubric?.criteria.length ? <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{milestone.rubric.criteria.length}</span> : null}</TabsTrigger>
        {canReadHistory ? <TabsTrigger value="history">History</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="overview" className="mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
        <div className="grid min-w-0 gap-4">
          <Card className="gap-3 py-4"><CardHeader className="px-5"><CardTitle>About this milestone</CardTitle></CardHeader><CardContent className="px-5 whitespace-pre-wrap break-words text-sm leading-6">{milestone.description || <span className="text-muted-foreground">No description provided.</span>}</CardContent></Card>
          <Card className="gap-3 py-4">
            <CardHeader className="px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle>Acceptance checklist</CardTitle>
                <CardDescription>
                  {tracksCompletion ? `${completed} of ${checklist.length} completed` : `${checklist.length} item${checklist.length === 1 ? "" : "s"} · ${required} required`}
                </CardDescription>
              </div>
              {tracksCompletion && checklist.length ? <Progress value={progress} className="mt-2 h-1.5" /> : null}
            </CardHeader>
            <CardContent className="grid gap-1.5 px-5">
              {checklist.length ? checklist.map((item, index) => {
                const done = tracksCompletion && item.completed;
                return <div key={item.id} className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm">
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", done ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "text-muted-foreground")}>{done ? <Check className="size-3.5" /> : index + 1}</span>
                  <p className={cn("min-w-0 flex-1 break-words", done && "text-muted-foreground line-through")}>{item.content}</p>
                  {item.mandatory ? <Badge variant="outline" className="shrink-0 text-[11px]">Required</Badge> : null}
                </div>;
              }) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No checklist items were stored.</p>}
            </CardContent>
          </Card>
        </div>
        <div className="grid min-w-0 gap-4">
          <Card className="gap-3 py-4"><CardHeader className="px-5"><CardTitle>Submission rules</CardTitle></CardHeader><CardContent className="grid gap-2.5 px-5 text-sm">
            <div><p className="text-muted-foreground">Late submissions</p><p className="mt-1 font-medium">{latePolicyLabel}</p></div>
            {milestone.latePolicy.type === "ALLOW_LATE" ? <>
              <div><p className="text-muted-foreground">Accepted until</p><p className="mt-1 font-medium">{formatTenantDateTime(milestone.latePolicy.lateUntil, milestone.tenantTimeZone)}</p></div>
              <div><p className="text-muted-foreground">Penalty</p><p className="mt-1 font-medium">{formatPenalty(milestone.latePolicy.penaltyPercent, milestone.latePolicy.penaltyBasis)}</p></div>
            </> : null}
            <div className="border-t pt-3"><p className="text-muted-foreground">Resubmissions</p><p className="mt-1 font-medium">{milestone.resubmissionPolicy.allowed ? `Allowed · ${resubmissionHint}` : "Not allowed"}</p></div>
          </CardContent></Card>
          <details className="group rounded-xl border bg-card px-5 py-3 text-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium">More details <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary>
            <dl className="mt-3 grid gap-2.5 border-t pt-3">
              <div><dt className="text-muted-foreground">Project</dt><dd className="font-medium">{milestone.project?.name ?? "Team workspace"}</dd></div>
              <div><dt className="flex items-center gap-1 text-muted-foreground"><Globe2 className="size-3.5" /> Time zone</dt><dd>{milestone.tenantTimeZone}</dd></div>
              <div><dt className="text-muted-foreground">Created at</dt><dd>{formatTenantDateTime(milestone.createdAt, milestone.tenantTimeZone)}</dd></div>
            </dl>
          </details>
        </div>
      </TabsContent>

      {canReadArtifacts ? <TabsContent value="deliverables" className="mt-3"><WorkspaceArtifactsPanel teamId={teamId!} milestone={milestone} workspaceId={workspaceId} onRefreshMilestone={onRefresh} /></TabsContent> : null}
      <TabsContent value="rubric" className="mt-3">{milestone.rubric ? <MilestoneRubricCard rubric={milestone.rubric} /> : <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No rubric is available for this milestone.</CardContent></Card>}</TabsContent>
      {canReadHistory ? <TabsContent value="history" className="mt-3"><MilestoneDraftHistory projectId={projectId} teamId={teamId ?? 0} milestoneId={milestone.id} showEmpty /></TabsContent> : null}
    </Tabs>
  </main>;
}
