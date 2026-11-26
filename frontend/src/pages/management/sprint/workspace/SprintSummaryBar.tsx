import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SprintPlanning, SprintPlanningItem, SprintStatus } from "@/types";
import { CalendarRange, CheckCheck, Flag, Loader2, Pencil, Target, ArrowLeft } from "lucide-react";
import {
  completionRate,
  countByStatus,
  formatDate,
  formatHours,
  sprintStatusMeta,
  sprintTimeline,
} from "./board.constants";

interface SprintSummaryBarProps {
  plan: SprintPlanning | null;
  sprintItems: SprintPlanningItem[];
  canUpdate: boolean;
  statusUpdating: boolean;
  onEditScope: () => void;
  onChangeStatus: (status: SprintStatus) => void;
  onBackToOverview: () => void;
}

/** Sprint ribbon of the workspace: goal, milestone, capacity and progress. */
export function SprintSummaryBar({
  plan,
  sprintItems,
  canUpdate,
  statusUpdating,
  onEditScope,
  onChangeStatus,
  onBackToOverview,
}: SprintSummaryBarProps) {
  const status = sprintStatusMeta(plan?.status);
  const timeline = sprintTimeline(plan?.startDate, plan?.endDate);
  const progress = completionRate(sprintItems);
  const counts = countByStatus(sprintItems);

  const focusedMilestone = sprintItems
    .filter((item) => item.milestoneName)
    .sort((a, b) => {
      const aDue = a.milestoneDueDate ? new Date(a.milestoneDueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.milestoneDueDate ? new Date(b.milestoneDueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })[0];

  const schedule = (() => {
    if (plan?.status === "COMPLETED") {
      return { label: "Sprint completed", tone: "text-indigo-600 dark:text-indigo-300" };
    }

    if (plan?.status === "CANCELLED") {
      return { label: "Sprint cancelled", tone: "text-rose-600 dark:text-rose-300" };
    }

    if (!timeline) {
      return { label: "No schedule", tone: "text-muted-foreground" };
    }

    if (timeline.notStarted) {
      return { label: "Not started", tone: "text-muted-foreground" };
    }

    if (timeline.overdue) {
      return { label: "Past sprint end", tone: "text-rose-600 dark:text-rose-300" };
    }

    const expected = Math.round((timeline.day / timeline.totalDays) * 100);

    if (progress.percent + 5 >= expected) {
      return {
        label: `On schedule (${timeline.daysLeft}d left)`,
        tone: "text-emerald-600 dark:text-emerald-300",
      };
    }

    return {
      label: `Behind schedule (${timeline.daysLeft}d left)`,
      tone: "text-amber-600 dark:text-amber-300",
    };
  })();

  return (
    <section className="rounded-xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="xs"
              className="-ml-2 text-muted-foreground hover:text-foreground"
              onClick={onBackToOverview}
              title="Quay lại Overview"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Overview
            </Button>
            <span className="text-border">|</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                status.badge,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
            <h2 className="truncate text-sm font-semibold text-foreground">
              {plan?.sprintName ?? "Sprint"}
            </h2>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" />
            {formatDate(plan?.startDate)} – {formatDate(plan?.endDate)}
            {timeline && (
              <>
                <span className="text-border">•</span>
                Day {timeline.day} of {timeline.totalDays}
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!canUpdate}
            onClick={onEditScope}
          >
            <Pencil className="h-4 w-4" />
            Edit Sprint Scope
          </Button>
          <Button
            size="sm"
            disabled={!canUpdate || plan?.status !== "ACTIVE" || statusUpdating}
            onClick={() => onChangeStatus("COMPLETED")}
          >
            {statusUpdating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Complete Sprint
          </Button>
        </div>
      </div>

      <div className="grid gap-2 px-4 py-3 text-xs">
        <div className="flex items-start gap-2">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 leading-relaxed text-foreground/90">
            <span className="font-semibold text-foreground">Sprint Goal: </span>
            {plan?.sprintGoal || "No sprint goal defined yet."}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Flag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          {focusedMilestone ? (
            <p className="min-w-0 flex-1 leading-relaxed text-foreground/90">
              <span className="font-semibold text-foreground">Milestone: </span>
              {focusedMilestone.milestoneName}
              {focusedMilestone.milestoneDueDate
                ? ` (Due ${formatDate(focusedMilestone.milestoneDueDate)})`
                : ""}
            </p>
          ) : (
            <p className="min-w-0 flex-1 leading-relaxed text-muted-foreground">
              No milestone linked to the sprint backlog.
            </p>
          )}
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {progress.percent}% complete
            </span>
            <span className="text-border">•</span>
            <span>
              {formatHours(progress.done)} / {formatHours(progress.total)}
            </span>
            <span className="text-border">•</span>
            <span>{counts.inProgress} in progress</span>
            <span className="text-border">•</span>
            <span>{counts.todo} to do</span>
            <span className="text-border">•</span>
            <span>{counts.done} done</span>
          </div>
          <Badge
            variant="outline"
            className={cn("border-transparent bg-muted/60 font-medium", schedule.tone)}
          >
            {schedule.label}
          </Badge>
        </div>
        <Progress
          value={progress.percent}
          className="mt-2 h-2 bg-muted [&_[data-slot=progress-indicator]]:bg-emerald-500"
        />
      </div>
    </section>
  );
}
