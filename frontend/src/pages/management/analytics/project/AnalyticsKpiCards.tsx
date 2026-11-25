import { ClipboardList, Clock, Gauge, Percent, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectAnalyticsKpi } from "@/types/features/project-analytics";

const KPI_ICONS: Record<string, LucideIcon> = {
  "total-work-items": ClipboardList,
  "completion-rate": Percent,
  "avg-cycle-time": Clock,
  "avg-lead-time": Gauge,
};

const KPI_TONES: Record<string, string> = {
  "total-work-items": "text-slate-400",
  "completion-rate": "text-emerald-500",
  "avg-cycle-time": "text-blue-500",
  "avg-lead-time": "text-indigo-500",
};

/**
 * US-ANL-003: the summary strip above the trend charts.
 *
 * The four cards (total work items, completion rate, average cycle time,
 * average lead time) are computed by the backend for the applied scope, sprint,
 * work item type and window, so the whole strip refreshes together with the
 * charts. Values arrive preformatted — including the `0.0%` and `N/A` edge
 * cases of AC02 — so this component never divides by zero itself.
 */
export function AnalyticsKpiCards({
  kpis,
  isLoading = false,
}: {
  kpis: ProjectAnalyticsKpi[];
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <section aria-label="Loading sprint and backlog summary" role="status" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map(key => (
          <Card key={key} className="gap-0 rounded-xl py-0 shadow-xs">
            <CardContent className="flex flex-col gap-2.5 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="size-4 rounded" />
              </div>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-2.5 w-28" />
            </CardContent>
          </Card>
        ))}
      </section>
    );
  }

  return (
    <section aria-label="Sprint and backlog summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {kpis.map(kpi => {
        const Icon = KPI_ICONS[kpi.key] ?? ClipboardList;
        const tone = KPI_TONES[kpi.key] ?? "text-muted-foreground";
        return (
          <Card key={kpi.key} className="gap-0 rounded-xl py-0 shadow-xs">
            <CardContent className="flex flex-col gap-2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="pt-0.5 text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
                <span aria-hidden="true" className={`shrink-0 ${tone}`}>
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
              </div>
              <p
                className="text-2xl font-semibold leading-none tracking-tight tabular-nums"
                title={kpi.hint}
              >
                {kpi.value}
              </p>
              {kpi.caption && (
                <p className="truncate text-[10px] text-muted-foreground" title={kpi.hint}>
                  {kpi.caption}
                </p>
              )}
              {kpi.subCaption && (
                <p className="truncate text-[10px] text-muted-foreground/80" title={kpi.subCaption}>
                  {kpi.subCaption}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
