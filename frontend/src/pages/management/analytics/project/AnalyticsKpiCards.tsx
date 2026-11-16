import { CheckCircle2, Circle, ClipboardList, Percent, TrendingUp, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ProjectAnalyticsKpi } from "@/types/features/project-analytics";

const KPI_ICONS: Record<string, LucideIcon> = {
  "work-items": ClipboardList,
  completed: CheckCircle2,
  open: Circle,
  "completion-rate": Percent,
  "created-in-window": TrendingUp,
};

const KPI_TONES: Record<string, string> = {
  "work-items": "text-slate-400",
  completed: "text-emerald-500",
  open: "text-amber-500",
  "completion-rate": "text-slate-400",
  "created-in-window": "text-blue-500",
};

const KPI_HINTS: Record<string, string> = {
  "work-items": "Scoped items",
  completed: "Done",
  open: "To-do state",
  "completion-rate": "Sprint target",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatShortDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]} ${year}`;
}

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
export function AnalyticsKpiCards({ kpis, windowStart }: {
  kpis: ProjectAnalyticsKpi[];
  windowStart: string;
}) {
  return (
    <section aria-label="Analytics KPI cards" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {kpis.map(kpi => {
        const Icon = KPI_ICONS[kpi.key] ?? ClipboardList;
        const tone = KPI_TONES[kpi.key] ?? "text-muted-foreground";
        const hint = kpi.key === "created-in-window"
          ? formatShortDate(windowStart)
          : KPI_HINTS[kpi.key] ?? kpi.hint;
        return (
          <Card key={kpi.key} className="gap-0 rounded-xl py-0 shadow-xs">
            <CardContent className="flex flex-col gap-2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="pt-0.5 text-[11px] font-medium text-muted-foreground">{kpi.label}</p>
                <span aria-hidden="true" className={`shrink-0 ${tone}`}>
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
              </div>
              <p className="text-2xl font-semibold leading-none tracking-tight tabular-nums">{formatValue(kpi)}</p>
              <p className="truncate text-[10px] text-muted-foreground" title={kpi.hint}>{hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
