import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, CircleHelp, CircleX, RefreshCw } from "lucide-react";
import { clsApi } from "@/api/features/cls.api";
import { Button } from "@/components/ui/button";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";
import type { ExternalClass } from "@/types";
import { ClassModal } from "./ClassModal";
import { classReadinessKey } from "@/hooks/useClassInsights";

export function ClassReadinessPanel({ classItem, onNavigate }: { classItem: ExternalClass; onNavigate: (tab: string) => void }) {
    const query = useQuery({ queryKey: classReadinessKey(classItem.id), queryFn: () => clsApi.getReadiness(classItem.id), refetchOnMount: "always" });
    const { hasPermission } = usePermissions();
    const [editing, setEditing] = useState(false);
    const [setupUnavailable, setSetupUnavailable] = useState(false);
    const data = query.data;
    const go = (target: string) => {
        // There is no Class Setup page registered in this frontend.
        if (target === "setup") setSetupUnavailable(true);
        else if (target === "edit" && hasPermission("CLASS_UPDATE")) setEditing(true);
        else if (target === "trainees" || target === "calendar") onNavigate(target);
    };
    return <section aria-label="Class Readiness" className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Class Readiness</h2>
            <Button variant="ghost" size="sm" aria-label="Refresh readiness" onClick={() => void query.refetch()} disabled={query.isFetching}>
                <RefreshCw className="size-4" /> Refresh</Button></div>
        {query.isPending ? <div aria-label="Loading readiness" role="status"><Skeleton className="h-5 w-72" /><Skeleton className="mt-3 h-28 w-full" /></div>
            : query.isError ? <ApiErrorState error={query.error} resource="class readiness" onRetry={() => void query.refetch()} />
            : data && <>
                <p className="text-sm" aria-live="polite">{data.ready}/{data.verified} verified checks ready, {data.unknown} unknown.</p>
                <div role="progressbar" aria-label="Verified readiness checks" aria-valuemin={0} aria-valuemax={data.verified || 1}
                    aria-valuenow={data.ready} aria-valuetext={`${data.ready} of ${data.verified} verified checks ready; ${data.unknown} unknown`}
                    className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-emerald-600" style={{ width: `${data.verified ? data.ready / data.verified * 100 : 0}%` }} /></div>
                <ul className="divide-y">{data.checks.map(check => <li key={check.key} className="flex flex-wrap items-center gap-3 py-3">
                    {check.status === "READY" ? <CheckCircle2 className="size-5 text-emerald-600" />
                        : check.status === "UNKNOWN" ? <CircleHelp className="size-5 text-amber-600" /> : <CircleX className="size-5 text-destructive" />}
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium">{check.label} <span className="ml-2 text-xs text-muted-foreground">{check.status}</span></div>
                        <p className="text-sm text-muted-foreground">{check.reason}</p></div>
                    {check.status !== "READY" && <Button variant="outline" size="sm" disabled={check.target === "edit" && !hasPermission("CLASS_UPDATE")}
                        title={check.target === "edit" && !hasPermission("CLASS_UPDATE") ? "You do not have permission to edit class information." : undefined}
                        onClick={() => go(check.target)}>{check.target === "trainees" ? "Open Trainee List" : check.target === "calendar" ? "Open Calendar"
                            : check.target === "setup" ? "Open Class Setup" : "Edit Class Info"}</Button>}
                </li>)}</ul>
                {setupUnavailable && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">
                    Class Setup is not available in this application. Program linking and trainer assignment configuration are not available here.
                </p>}
                <p className="text-xs text-muted-foreground">Evaluated {new Date(data.evaluatedAt).toLocaleString()}. Readiness does not change the class status.</p>
            </>}
        {editing && hasPermission("CLASS_UPDATE") && <ClassModal open onOpenChange={setEditing} classItem={classItem} />}
    </section>;
}
