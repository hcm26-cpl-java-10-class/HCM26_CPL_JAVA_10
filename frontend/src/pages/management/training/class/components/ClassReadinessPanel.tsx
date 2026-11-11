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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClassSetupForm } from "./ClassSetupForm";

const guidance: Record<string, string> = {
    basic: "Saving Class Info does not link a training program. Open Class Setup and link an ACTIVE program to this internal class ID. Its code or name must match the saved Program.",
    trainer: "Master Trainer text does not create an assignment. Open Class Setup to create a MAIN assignment for this internal class and a subject of its linked program, covering all class dates and using a verified active trainer matching Master Trainer.",
    enrollment: "Open Trainee List and save at least one ACTIVE trainee. Active and reserved seats must fit within Planned Size.",
    calendar: "Open Calendar > Manage Sessions and save a non-cancelled session for this internal class, within its start/end dates. The class date overview and draft calendar versions alone do not count as sessions.",
    operations: "In Class Info, enter Delivery Type and Format Type. Offline, Hybrid and Blended require an exact, unique room name and capacity at least Planned Size from the real room directory. Online requires an HTTP(S) meeting URL. A building name alone cannot identify a room.",
};

export function ClassReadinessPanel({ classItem, onNavigate }: { classItem: ExternalClass; onNavigate: (tab: string) => void }) {
    const query = useQuery({ queryKey: classReadinessKey(classItem.id), queryFn: () => clsApi.getReadiness(classItem.id), refetchOnMount: "always" });
    const { hasPermission } = usePermissions();
    const [editing, setEditing] = useState(false);
    const [setupOpen, setSetupOpen] = useState(false);
    const canReadSetup = ["CLASS_READ", "PROGRAM_READ", "ASSIGNMENT_READ"].every(hasPermission);
    const data = query.data;
    const blocked = data?.blocked ?? data?.checks.filter(check => check.status === "BLOCKED").length ?? 0;
    const go = (target: string) => {
        if (target === "setup" && canReadSetup) setSetupOpen(true);
        else if (target === "edit" && hasPermission("CLASS_UPDATE")) setEditing(true);
        else if (target === "trainees" || target === "calendar") onNavigate(target);
    };
    return <section aria-label="Class Readiness" className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Class Readiness</h2>
            <Button variant="outline" size="sm" disabled={!canReadSetup} onClick={() => setSetupOpen(true)}>Class Setup</Button>
            <Button variant="ghost" size="sm" aria-label="Refresh readiness" onClick={() => void query.refetch()} disabled={query.isFetching}>
                <RefreshCw className="size-4" /> Refresh</Button></div>
        {query.isPending ? <div aria-label="Loading readiness" role="status"><Skeleton className="h-5 w-72" /><Skeleton className="mt-3 h-28 w-full" /></div>
            : query.isError ? <ApiErrorState error={query.error} resource="class readiness" onRetry={() => void query.refetch()} />
            : data && <>
                <p className="text-xs text-muted-foreground">Class {classItem.code || classItem.name} · Internal ID {data.classId}. Saving Class Info updates profile fields; readiness also checks linked records and directory evidence.</p>
                <p className="text-sm" aria-live="polite">{data.ready}/{data.verified} verified checks ready, {data.unknown} unknown.{blocked > 0 && ` ${blocked} BLOCKED.`}</p>
                <p className="text-xs text-muted-foreground">{data.checks.length} total checks. UNKNOWN and BLOCKED checks are not counted as verified.</p>
                <div role="progressbar" aria-label="Verified readiness checks" aria-valuemin={0} aria-valuemax={data.verified || 1}
                    aria-valuenow={data.ready} aria-valuetext={`${data.ready} of ${data.verified} verified checks ready; ${data.unknown} unknown; ${blocked} blocked`}
                    className="h-2 overflow-hidden rounded bg-muted"><div className="h-full bg-emerald-600" style={{ width: `${data.verified ? data.ready / data.verified * 100 : 0}%` }} /></div>
                <ul className="divide-y">{data.checks.map(check => <li key={check.key} className="flex flex-wrap items-center gap-3 py-3">
                    {check.status === "READY" ? <CheckCircle2 className="size-5 text-emerald-600" />
                        : check.status === "UNKNOWN" || check.status === "BLOCKED" ? <CircleHelp className="size-5 text-amber-600" /> : <CircleX className="size-5 text-destructive" />}
                    <div className="min-w-0 flex-1"><div className="text-sm font-medium">{check.label} <span className="ml-2 text-xs text-muted-foreground">{check.status}</span></div>
                        <p className="text-sm text-muted-foreground">{check.reason}</p>
                        {check.status !== "READY" && <p className="mt-1 text-sm"><strong>Next step: </strong>{check.action || guidance[check.key]}</p>}</div>
                    {check.status !== "READY" && <Button variant="outline" size="sm" disabled={(check.target === "edit" && !hasPermission("CLASS_UPDATE")) || (check.target === "setup" && !canReadSetup)}
                        title={check.target === "edit" && !hasPermission("CLASS_UPDATE") ? "You do not have permission to edit class information."
                            : check.target === "setup" && !canReadSetup ? "Class Setup requires CLASS_READ, PROGRAM_READ and ASSIGNMENT_READ." : undefined}
                        onClick={() => go(check.target)}>{check.target === "trainees" ? "Open Trainee List" : check.target === "calendar" ? "Open Calendar"
                            : check.target === "setup" ? "Open Class Setup" : "Edit Class Info"}</Button>}
                </li>)}</ul>
                <p className="text-xs text-muted-foreground">Evaluated {new Date(data.evaluatedAt).toLocaleString()}. Readiness does not change the class status.</p>
            </>}
        {editing && hasPermission("CLASS_UPDATE") && <ClassModal open onOpenChange={setEditing} classItem={classItem} />}
        <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Class Setup</DialogTitle></DialogHeader>
                {setupOpen && <ClassSetupForm key={classItem.id} classId={classItem.id} />}
            </DialogContent>
        </Dialog>
    </section>;
}
