import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Check, ChevronDown, Globe2, Pencil, RotateCcw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { WorkspaceArtifactsPanel } from "@/pages/management/workspace/WorkspaceArtifactsPanel";
import type { MilestoneDetailResponse } from "@/types";
import { MilestoneDraftHistory } from "./MilestoneDraftHistory";
import { MilestoneRubricCard } from "./MilestoneRubricCard";
import { MilestoneStatusBadge } from "./MilestoneStatusBadge";
import { milestoneStatusStyles } from "../milestone-status.styles";
import { tenantStartOfDay } from "../milestone-form.schema";
import { formatPenalty, formatRelativeDeadline, formatTenantDateTime } from "../milestone.utils";

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
  const { hasPermission } = usePermissions();
  const [params, setParams] = useSearchParams();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const canReadArtifacts = Boolean(teamId && hasPermission("ARTIFACT_READ"));
  const canReadHistory = Boolean(projectId || (teamId && hasPermission("MILESTONE_WRITE")));
  const sections: Section[] = ["overview", ...(canReadArtifacts ? ["deliverables" as const] : []), "rubric", ...(canReadHistory ? ["history" as const] : [])];
  const requestedSection = params.get("section") as Section | null;
  const section: Section = requestedSection && sections.includes(requestedSection) ? requestedSection : "overview";
  const checklist = [...milestone.checklist].sort((a, b) => a.orderIndex - b.orderIndex);
  const completed = checklist.filter((item) => item.completed).length;
  const progress = checklist.length ? Math.round(completed / checklist.length * 100) : 0;
  const active = milestone.lifecycleStatus === "IN_PROGRESS" || milestone.lifecycleStatus === "CHANGES_REQUESTED";
  const deadlinePassed = active && new Date(milestone.deadline).getTime() < openedAt;
  const deadlineSoon = active && !deadlinePassed && new Date(milestone.deadline).getTime() - openedAt <= 48 * 60 * 60 * 1000;
  const showDescriptionToggle = Boolean(milestone.description && milestone.description.length > 180);
  const scheduledStart = milestone.scheduledStartAt ?? (milestone.startDate ? tenantStartOfDay(milestone.startDate, milestone.tenantTimeZone)?.toISOString() : null);
  const submitUrl = teamId ? `/teams/${teamId}/milestones/${milestone.id}/submit${workspaceId ? `?workspaceId=${workspaceId}` : ""}` : "";
  const editUrl = projectId
    ? `/projects/${projectId}/milestones/${milestone.id}/edit${teamId ? `?teamId=${teamId}` : ""}`
    : teamId ? `/teams/${teamId}/milestones/${milestone.id}/edit${workspaceId ? `?workspaceId=${workspaceId}` : ""}` : "";

  const selectSection = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "overview") next.delete("section");
    else next.set("section", value);
    setParams(next, { replace: true });
  };

  return <main className="mx-auto grid w-full max-w-6xl gap-5">
    <Card className={cn("overflow-hidden border-l-4 bg-gradient-to-r from-sky-50/70 via-card to-card dark:from-sky-950/20", milestoneStatusStyles[milestone.lifecycleStatus].edge)}>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <MilestoneStatusBadge status={milestone.lifecycleStatus} />
          <Badge variant="outline">{milestone.mandatory ? "Mandatory" : "Optional"}</Badge>
          {deadlinePassed || deadlineSoon ? <Badge variant="outline" className={deadlinePassed ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300" : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"}>{deadlinePassed ? "Past due" : "Due soon"}</Badge> : null}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="break-words text-2xl leading-tight md:text-3xl">{milestone.title}</CardTitle>
            {milestone.description ? <div className="mt-2 max-w-3xl">
              <CardDescription className={cn("whitespace-pre-wrap leading-6", !descriptionExpanded && "line-clamp-2")}>{milestone.description}</CardDescription>
              {showDescriptionToggle ? <button type="button" className="mt-1 text-sm font-medium text-indigo-700 underline-offset-2 hover:underline dark:text-indigo-300" onClick={() => setDescriptionExpanded((open) => !open)}>{descriptionExpanded ? "Show less" : "Read more"}</button> : null}
            </div> : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {active && teamId && hasPermission("ARTIFACT_SUBMIT") ? <Button className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600" onClick={() => navigate(submitUrl)}><Upload className="size-4" /> {milestone.lifecycleStatus === "CHANGES_REQUESTED" ? "Resubmit artifact" : "Submit artifact"}</Button> : null}
            {editUrl && ["PLANNED", "IN_PROGRESS", "CHANGES_REQUESTED"].includes(milestone.lifecycleStatus) && hasPermission("MILESTONE_WRITE") ? <Button variant="outline" onClick={() => navigate(editUrl)}><Pencil className="size-4" /> {milestone.lifecycleStatus === "CHANGES_REQUESTED" ? "Extend deadline" : "Edit milestone"}</Button> : null}
          </div>
        </div>
        <div className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Deadline · {milestone.tenantTimeZone}</p><p className="mt-1 flex items-start gap-2 font-semibold"><CalendarClock className="mt-0.5 size-4 shrink-0 text-indigo-700 dark:text-indigo-300" />{formatTenantDateTime(milestone.deadline, milestone.tenantTimeZone)}</p><p className="mt-1 text-xs text-muted-foreground">{formatRelativeDeadline(milestone.deadline)}</p></div>
          <div><p className="text-xs text-muted-foreground">Starts automatically</p><p className="mt-1 font-medium">{scheduledStart ? formatTenantDateTime(scheduledStart, milestone.tenantTimeZone) : "Not scheduled"}</p></div>
          <div><p className="text-xs text-muted-foreground">Acceptance checklist</p><p className="mt-1 font-semibold">{completed}/{checklist.length} completed</p><Progress value={progress} className="mt-2 h-1.5" /></div>
        </div>
      </CardHeader>
    </Card>

    <Tabs value={section} onValueChange={selectSection} className="min-w-0">
      <TabsList variant="line" className="w-full max-w-full justify-start overflow-x-auto border-b pb-1">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {canReadArtifacts ? <TabsTrigger value="deliverables">Deliverables</TabsTrigger> : null}
        <TabsTrigger value="rubric">Rubric</TabsTrigger>
        {canReadHistory ? <TabsTrigger value="history">History</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="overview" className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
        <div className="grid gap-5">
        <Card><CardHeader><CardTitle>About this milestone</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap break-words text-sm leading-6">{milestone.description || <span className="text-muted-foreground">No description provided.</span>}</CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Acceptance checklist</CardTitle><CardDescription>{completed} of {checklist.length} completed</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {checklist.length ? checklist.map((item, index) => <div key={item.id} className="flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm">
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold", item.completed ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "text-muted-foreground")}>{item.completed ? <Check className="size-3.5" /> : index + 1}</span>
              <div className="min-w-0 flex-1"><p className={cn("break-words", item.completed && "text-muted-foreground line-through")}>{item.content}</p>{item.mandatory ? <span className="mt-1 inline-block text-xs font-medium text-muted-foreground">Required</span> : null}</div>
            </div>) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No checklist items were stored.</p>}
          </CardContent>
        </Card>
        </div>
        <div className="grid gap-5">
          <Card><CardHeader><CardTitle>Submission rules</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm">
            <div><p className="text-muted-foreground">Late submissions</p><p className="mt-1 font-medium">{milestone.latePolicy.type === "NO_LATE" ? "Not allowed" : "Allowed"}</p></div>
            {milestone.latePolicy.type === "ALLOW_LATE" ? <><div><p className="text-muted-foreground">Accepted until</p><p className="mt-1 font-medium">{formatTenantDateTime(milestone.latePolicy.lateUntil, milestone.tenantTimeZone)}</p></div><div><p className="text-muted-foreground">Penalty</p><p className="mt-1 font-medium">{formatPenalty(milestone.latePolicy.penaltyPercent, milestone.latePolicy.penaltyBasis)}</p></div></> : null}
            <div className="border-t pt-3"><p className="flex items-center gap-2 text-muted-foreground"><RotateCcw className="size-4" /> Resubmissions</p><p className="mt-1 font-medium">{milestone.resubmissionPolicy.allowed ? `Allowed · ${milestone.resubmissionPolicy.maxAttempts ?? "Unlimited"} attempts` : "Not allowed"}</p></div>
          </CardContent></Card>
          <details className="group rounded-xl border bg-card p-4 text-sm"><summary className="flex cursor-pointer list-none items-center justify-between font-medium">More details <ChevronDown className="size-4 transition-transform group-open:rotate-180" /></summary><dl className="mt-4 grid gap-3 border-t pt-4"><div><dt className="text-muted-foreground">Project</dt><dd className="font-medium">{milestone.project?.name ?? "Team workspace"}</dd></div><div><dt className="flex items-center gap-1 text-muted-foreground"><Globe2 className="size-3.5" /> Time zone</dt><dd>{milestone.tenantTimeZone}</dd></div><div><dt className="text-muted-foreground">Created at</dt><dd>{formatTenantDateTime(milestone.createdAt, milestone.tenantTimeZone)}</dd></div><div><dt className="text-muted-foreground">Version</dt><dd>{milestone.version}</dd></div></dl></details>
        </div>
      </TabsContent>

      {canReadArtifacts ? <TabsContent value="deliverables" className="mt-4"><WorkspaceArtifactsPanel teamId={teamId!} milestone={milestone} workspaceId={workspaceId} onRefreshMilestone={onRefresh} /></TabsContent> : null}
      <TabsContent value="rubric" className="mt-4">{milestone.rubric ? <MilestoneRubricCard rubric={milestone.rubric} /> : <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No rubric is available for this milestone.</CardContent></Card>}</TabsContent>
      {canReadHistory ? <TabsContent value="history" className="mt-4"><MilestoneDraftHistory projectId={projectId} teamId={teamId ?? 0} milestoneId={milestone.id} showEmpty /></TabsContent> : null}
    </Tabs>

    <div className="border-t pt-4"><Button variant="outline" onClick={onBack}><ArrowLeft className="size-4" /> {backLabel}</Button></div>
  </main>;
}
