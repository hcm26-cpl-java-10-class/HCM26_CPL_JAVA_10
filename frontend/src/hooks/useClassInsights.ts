import { useQuery } from "@tanstack/react-query";
import { clsApi, type ClassStatistics } from "@/api/features/cls.api";
import type { ExternalClass } from "@/types";

export type ClassKpi = "all" | "inProgress" | "upcoming" | "completed";
export const classStatisticsKey = ["classes", "insights", "stats"] as const;
export const classReadinessKey = (id: string | number) => ["classes", "readiness", String(id)] as const;
export const useClassStatistics = () => useQuery({ queryKey: classStatisticsKey, queryFn: clsApi.getStatistics });

export function matchesClassKpi(item: ExternalClass, kpi: ClassKpi, stats?: ClassStatistics): boolean {
    if (kpi === "all") return true;
    if (kpi === "inProgress") return item.status === "active";
    if (kpi === "completed") return item.status === "completed" || item.status === "closed";
    const day = item.startDate?.slice(0, 10);
    return !!stats && !!day && (item.status === "planning" || item.status === "assigned")
        && day >= stats.asOf && day <= stats.upcomingThrough;
}
