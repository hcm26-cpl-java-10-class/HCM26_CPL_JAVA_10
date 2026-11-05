import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SprintDTO, SprintPlanningItem } from "@/types";
import { ArrowRight, ListChecks } from "lucide-react";
import {
  completionRate,
  countByStatus,
  formatDate,
  formatHours,
  sprintStatusMeta,
  sumHours,
} from "./board.constants";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}

function StatCard({ label, value, hint, tone }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-bold text-foreground", tone)}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface OverviewTabProps {
  sprints: SprintDTO[];
  selectedSprintId?: number;
  sprintItems: SprintPlanningItem[];
  productItems: SprintPlanningItem[];
  onSelectSprint: (id: number) => void;
  onOpenBacklog: () => void;
}

/** Workspace overview: sprint KPIs plus the whole sprint catalogue. */
export function OverviewTab({
  sprints,
  selectedSprintId,
  sprintItems,
  productItems,
  onSelectSprint,
  onOpenBacklog,
}: OverviewTabProps) {
  const progress = completionRate(sprintItems);
  const counts = countByStatus(sprintItems);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Planned capacity"
          value={formatHours(sumHours(sprintItems))}
          hint={`${sprintItems.length} tasks in the sprint backlog`}
        />
        <StatCard
          label="Completion"
          value={`${progress.percent}%`}
          hint={`${formatHours(progress.done)} of ${formatHours(progress.total)} done`}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label="Work in progress"
          value={String(counts.inProgress)}
          hint={`${counts.todo} to do • ${counts.done} done`}
        />
        <StatCard
          label="Product backlog"
          value={String(productItems.length)}
          hint={`${formatHours(sumHours(productItems))} still unplanned`}
        />
      </div>

      <section className="rounded-xl border bg-card shadow-xs">
        <header className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Sprints</h3>
            <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
              {sprints.length}
            </Badge>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenBacklog}>
            Open sprint portfolio
            <ArrowRight className="h-4 w-4" />
          </Button>
        </header>

        <div className="divide-y">
          {sprints.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No sprint has been created yet.
            </p>
          ) : (
            sprints.map((sprint, index) => {
              const status = sprintStatusMeta(sprint.status);

              return (
                <button
                  key={sprint.id}
                  type="button"
                  onClick={() => sprint.id != null && onSelectSprint(sprint.id)}
                  className={cn(
                    "flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/60",
                    sprint.id === selectedSprintId && "bg-primary/5",
                  )}
                >
                  <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Sprint {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {sprint.name || `Sprint #${sprint.id}`}
                  </span>
                  <span className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block">
                    {sprint.sprintGoal || "—"}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      status.badge,
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                    {status.label}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
