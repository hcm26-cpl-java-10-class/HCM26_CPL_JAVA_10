import type { EntityCardRendererProps, MilestoneListItem } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowRight, CalendarClock, Clock, Flag } from "lucide-react";
import {
  formatDateTime,
  formatPenalty,
  formatRelativeDeadline,
  isPastDeadline,
} from "../milestone.utils";
import { MilestoneStatusBadge } from "./MilestoneStatusBadge";

export function MilestoneTableCard({
  row,
  showActions = true,
  onView,
  renderRowActions,
}: EntityCardRendererProps) {
  const milestone = row as MilestoneListItem;
  const pastDue = isPastDeadline(milestone);

  const openDetail = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, label, [role=switch]")) return;
    onView(row);
  };

  return (
    <Card
      className="group relative h-full cursor-pointer overflow-hidden border-border/70 bg-gradient-to-b from-background to-muted/30 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      onClick={openDetail}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-sky-100 via-cyan-100 to-emerald-100 dark:from-sky-900/30 dark:via-cyan-900/20 dark:to-emerald-900/30" />

      <CardHeader className="relative gap-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <MilestoneStatusBadge status={milestone.status} executionStatus={milestone.executionStatus} />
            <Badge variant={milestone.mandatory ? "secondary" : "outline"}>
              {milestone.mandatory ? "Mandatory" : "Optional"}
            </Badge>
          </div>
          {showActions && renderRowActions ? (
            <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
              {renderRowActions(row)}
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Flag className="size-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="line-clamp-1 text-base leading-tight">{milestone.title}</CardTitle>
            {milestone.projectName ? <p className="text-xs font-medium text-muted-foreground">{milestone.projectName}</p> : null}
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {milestone.description || "No description available."}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-3 pt-0 text-sm sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="size-3" /> Deadline
          </p>
          <p className="mt-1 font-medium">{formatDateTime(milestone.deadline)}</p>
          <p className={cn("text-xs text-muted-foreground", pastDue && "font-medium text-destructive")}>
            {pastDue ? "Past due · " : ""}{formatRelativeDeadline(milestone.deadline)}
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" /> Late policy
          </p>
          {milestone.latePolicyType === "NO_LATE" ? (
            <p className="mt-1 text-muted-foreground">No late submissions</p>
          ) : (
            <>
              <p className="mt-1 font-medium">Until {formatDateTime(milestone.lateUntil)}</p>
              <p className="text-xs text-muted-foreground">{formatPenalty(milestone.latePenaltyPercent)} penalty</p>
            </>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full justify-between"
          onClick={(event) => {
            event.stopPropagation();
            onView(row);
          }}
        >
          View detail
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
