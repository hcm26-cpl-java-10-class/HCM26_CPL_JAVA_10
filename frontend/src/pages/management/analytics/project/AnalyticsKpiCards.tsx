import { Activity, CheckCircle2, CircleDashed, ListChecks, Percent } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ProjectAnalyticsKpi } from "@/types/features/project-analytics";

const KPI_ICONS: Record<string, LucideIcon> = {
  "work-items": ListChecks,
  completed: CheckCircle2,
  open: CircleDashed,
  "completion-rate": Percent,
  "created-in-window": Activity,
};

const KPI_TONES: Record<string, string> = {
  "work-items": "border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  completed: "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  open: "border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  "completion-rate": "border-violet-100 bg-violet-50 text-violet-600 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-300",
  "created-in-window": "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
};

function formatValue(kpi: ProjectAnalyticsKpi) {
  return kpi.unit === "percent" ? `${kpi.value}%` : kpi.value.toLocaleString("en-US");
}

/**
 * US-ANL-002: the KPI cards above the trend charts.
 *
 * Every value is recalculated by the backend for the applied scope, sprint,
 * work item type and date window, so the whole row refreshes together with the
 * charts (AC01 / AC02 / AC03).
 */
export function AnalyticsKpiCards({ kpis }: { kpis: ProjectAnalyticsKpi[] }) {
  return (
    <section aria-label="Analytics KPI cards" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map(kpi => {
        const Icon = KPI_ICONS[kpi.key] ?? ListChecks;
        const tone = KPI_TONES[kpi.key] ?? "border bg-muted/40 text-muted-foreground";
        return (
          <Card key={kpi.key} className="shadow-xs">
            <CardContent className="flex flex-col gap-1.5 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <span aria-hidden="true" className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${tone}`}>
                  <Icon className="size-3.5" />
                </span>
              </div>
              <p className="text-2xl font-semibold leading-none tabular-nums">{formatValue(kpi)}</p>
              <p className="text-[10px] leading-4 text-muted-foreground" title={kpi.hint}>{kpi.hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
