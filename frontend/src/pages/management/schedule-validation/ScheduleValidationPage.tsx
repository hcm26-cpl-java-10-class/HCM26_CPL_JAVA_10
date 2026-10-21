import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { scheduleValidationApi, type ScheduleCandidate, type ScheduleValidationResult } from "@/api/features/schedule-check.api";
import { ScheduleCandidateForm } from "./ScheduleCandidateForm";
import { ScheduleIssues } from "./ScheduleIssues";
import { usePermissions } from "@/hooks/usePermissions";

const blank = (): ScheduleCandidate => ({ title: "", startTime: "", endTime: "" });
export default function ScheduleValidationPage() {
    const { hasPermission, hasAnyPermission } = usePermissions();
    const canValidate = hasPermission("SESSION_READ") && hasAnyPermission(["SESSION_CREATE", "SESSION_UPDATE"]);
    const query = useQuery({ queryKey: ["schedule-validation", "resources"], queryFn: scheduleValidationApi.resources, retry: false, enabled: canValidate });
    const [rows, setRows] = useState<{ key: number; value: ScheduleCandidate }[]>([{ key: 0, value: blank() }]);
    const nextKey = useRef(1);
    const [result, setResult] = useState<ScheduleValidationResult>();
    const [error, setError] = useState("");
    const [checking, setChecking] = useState(false);
    const change = (index: number, value: ScheduleCandidate) => {
        setRows(old => old.map((r, i) => i === index ? { ...r, value } : r));
        setResult(undefined);
        setError("");
    };
    const focusRow = (index: number) => {
        const node = document.getElementById(`candidate-${index}`);
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        node?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    };
    if (!canValidate) return <MainLayout><p role="alert">You do not have permission to validate schedules. Session viewing access and either create or update access are required.</p></MainLayout>;
    return <MainLayout><div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Schedule validation</h1><Link className="text-blue-600 underline" to="/sessions">Manage sessions</Link></div>
        {query.isPending && <p role="status">Loading classes, teaching assignments, rooms, and holidays...</p>}
        {query.isError && <div role="alert" className="space-y-2 rounded border border-red-400 p-4"><p>Unable to load scheduling information. {isAxiosError(query.error) ? query.error.response?.data?.message : ""}</p><Button onClick={() => query.refetch()}>Retry</Button></div>}
        {query.data && <>
            <p className="text-sm text-muted-foreground">Time zone: {query.data.rules.timezone}. Permitted hours: {query.data.rules.openingTime}–{query.data.rules.closingTime}. Consecutive sessions are allowed. Validation checks existing schedules and all sessions in this batch.</p>
            {query.data.references.assignments.length === 0 && <p role="status">No teaching assignments are available. Create an assignment before validating sessions.</p>}
            <details className="rounded border p-3"><summary>Holidays and working days</summary><p className="mt-2 text-sm">Working days (1 = Monday, 7 = Sunday): {[...query.data.rules.workingDays].sort().join(", ")}</p>{query.data.references.holidays.length ? <ul className="mt-2 text-sm">{query.data.references.holidays.map((h, i) => <li key={i}>{h.date}{h.endDate ? ` – ${h.endDate}` : ""}: {h.name}</li>)}</ul> : <p className="mt-2 text-sm">No holidays are configured.</p>}</details>
            <form className="space-y-5" onSubmit={async e => {
                e.preventDefault(); setChecking(true); setError(""); setResult(undefined);
                try { setResult(await scheduleValidationApi.validate(rows.map(r => r.value))); }
                catch (err) { setError(isAxiosError(err) ? err.response?.data?.message ?? "Unable to validate the schedule. Please try again." : "Unable to validate the schedule. Please try again."); }
                finally { setChecking(false); }
            }}>
                {rows.map((row, i) => <section id={`candidate-${i}`} key={row.key} className="space-y-4 rounded-lg border p-4">
                    <div className="flex justify-between"><h2 className="font-semibold">Session {i + 1}</h2>{rows.length > 1 && <Button type="button" variant="outline" disabled={checking} onClick={() => { setRows(old => old.filter(r => r.key !== row.key)); setResult(undefined); }}>Remove session</Button>}</div>
                    <ScheduleCandidateForm value={row.value} onChange={value => change(i, value)} resources={query.data!} disabled={checking} prefix={`row-${row.key}`} />
                </section>)}
                <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" disabled={checking || rows.length >= query.data.rules.maxBatchSize} onClick={() => { setRows(old => [...old, { key: nextKey.current++, value: blank() }]); setResult(undefined); }}>Add session</Button><Button disabled={checking}>{checking ? "Validating..." : "Validate all sessions"}</Button></div>
            </form>
            {error && <p role="alert" className="text-red-600">{error}</p>}
            {result && <ScheduleIssues result={result} focusRow={focusRow} />}
        </>}
    </div></MainLayout>;
}
