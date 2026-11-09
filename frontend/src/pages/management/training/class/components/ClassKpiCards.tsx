import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ClassKpi, useClassStatistics } from "@/hooks/useClassInsights";

export function ClassKpiCards({ active, onSelect, query }: {
    active: ClassKpi; onSelect: (kpi: ClassKpi) => void; query: ReturnType<typeof useClassStatistics>;
}) {
    const cards = [
        { key: "all", label: "Total Classes", field: "totalClasses" },
        { key: "inProgress", label: "In Progress", field: "inProgress" },
        { key: "upcoming", label: "Upcoming Classes", field: "upcomingClasses" },
        { key: "completed", label: "Completed Classes", field: "completedClasses" },
    ] as const;
    return <section aria-label="Class dashboard" className="space-y-3 border-b p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-semibold">Class Overview</h2>
                <p className="text-xs text-muted-foreground">Upcoming: planning/assigned, today through the next 30 days. Completed includes closed classes.
                    {query.data && ` Evaluated ${query.data.asOf} (${query.data.timezone}).`}</p></div>
            <Button variant="ghost" size="sm" aria-label="Refresh class statistics" disabled={query.isFetching} onClick={() => void query.refetch()}>
                <RefreshCw className={cn("size-4", query.isFetching && "animate-spin")} /> Refresh
            </Button>
        </div>
        {query.isError ? <div role="alert" className="rounded-md border border-destructive p-3 text-sm">
            Class statistics could not be loaded. <Button variant="link" onClick={() => void query.refetch()}>Retry statistics</Button>
        </div> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(card => <button key={card.key} type="button" aria-pressed={active === card.key}
                aria-label={card.label} disabled={query.isPending} onClick={() => onSelect(card.key)}
                className={cn("rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted focus-visible:outline-2",
                    active === card.key && "border-primary bg-primary/5 ring-1 ring-primary")}>
                <span className="block text-sm text-muted-foreground">{card.label}</span>
                {query.isPending ? <Skeleton className="mt-2 h-8 w-16" />
                    : <span className="mt-2 block text-3xl font-semibold tabular-nums">{query.data[card.field]}</span>}
            </button>)}
        </div>}
        {query.data?.totalClasses === 0 && <p className="text-sm text-muted-foreground">No active class records yet.</p>}
    </section>;
}
