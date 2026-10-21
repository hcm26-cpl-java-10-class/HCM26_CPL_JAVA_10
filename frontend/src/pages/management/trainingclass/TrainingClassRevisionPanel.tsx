import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
    actOnTrainingClassRevision, createTrainingClassDraft, getTrainingClass,
    getTrainingClassCreateOptions, getTrainingClassRevisions, trainingClassTableApi,
    type TrainingClassResponse,
} from "@/api/features/schedule/training-class.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TrainingClassEditForm from "./TrainingClassEditForm";
import { trainingClassSchema } from "./training-class.schema";

const snapshotFields = [
    ["name", "Class Name"], ["description", "Description / Notes"], ["traineeType", "Trainee Type"],
    ["deliveryFormat", "Delivery Format"], ["site", "Site"], ["location", "Location"],
    ["startDate", "Start Date"], ["endDate", "End Date"], ["capacity", "Capacity"],
] as const;
type Action = "submit" | "approve" | "reject";
const actionNames: Record<Action, string> = { submit: "Submit for approval", approve: "Approve revision", reject: "Reject revision" };

export default function TrainingClassRevisionPanel({ data, onChanged }: {
    data: TrainingClassResponse;
    onChanged: (data: TrainingClassResponse) => void;
}) {
    const { hasPermission } = usePermissions();
    const qc = useQueryClient();
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [editing, setEditing] = useState(false);
    const [confirmation, setConfirmation] = useState<Action | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const canUpdate = hasPermission("TRAINING_CLASS_UPDATE");
    const mutable = data.isActive && ["PLANNING", "ONGOING"].includes(data.status);
    const query = useQuery({ queryKey: ["training-class-revisions", data.id, data.version],
        queryFn: () => getTrainingClassRevisions(data.id), staleTime: 0 });
    const options = useQuery({ queryKey: ["training-class-create-options"], queryFn: getTrainingClassCreateOptions, enabled: canUpdate });
    const revisions = query.data ?? [];
    const selected = revisions.find((revision) => revision.id === selectedId)
        ?? revisions.find((revision) => revision.id === data.pendingRevisionId)
        ?? revisions.find((revision) => revision.id === data.currentRevisionId) ?? revisions[0];
    const current = revisions.find((revision) => revision.id === data.currentRevisionId);
    const pendingSelected = selected?.id === data.pendingRevisionId;
    const locked = busy || query.isFetching;
    const schema = { ...trainingClassSchema, fields: trainingClassSchema.fields.map((field) => {
        const choices = field.name === "site" ? options.data?.sites
            : field.name === "traineeType" ? options.data?.traineeTypes
            : field.name === "deliveryFormat" ? options.data?.deliveryFormats
            : field.name === "location" ? options.data?.locations : undefined;
        return choices ? { ...field, type: "select" as const, options: choices } : field;
    }) };

    function fail(err: unknown) {
        setError(axios.isAxiosError(err) ? err.response?.data?.message ?? "Unable to complete this action." : "Unable to complete this action.");
        if (axios.isAxiosError(err) && err.response?.data?.errors) setFieldErrors(err.response.data.errors);
    }

    function changed(root: TrainingClassResponse) {
        onChanged(root);
        void qc.invalidateQueries({ queryKey: ["training-class"] });
    }

    async function reload() {
        setBusy(true);
        setError("");
        try { changed(await getTrainingClass(String(data.id))); await query.refetch(); }
        catch (err) { fail(err); }
        finally { setBusy(false); }
    }

    async function createDraft() {
        if (locked) return;
        setBusy(true); setError("");
        try { const root = await createTrainingClassDraft(data); changed(root); setSelectedId(root.pendingRevisionId); }
        catch (err) { fail(err); }
        finally { setBusy(false); }
    }

    async function saveDraft(values: Record<string, unknown>) {
        if (busy) return;
        setBusy(true); setError(""); setFieldErrors({});
        try { changed(await trainingClassTableApi.update(data.id, values)); setEditing(false); }
        catch (err) { fail(err); }
        finally { setBusy(false); }
    }

    async function confirmAction() {
        if (!confirmation || !selected || locked || (confirmation === "reject" && !reason.trim())) return;
        setBusy(true); setError("");
        try {
            changed(await actOnTrainingClassRevision(data, selected, confirmation, reason.trim()));
            setConfirmation(null); setReason("");
        } catch (err) { fail(err); }
        finally { setBusy(false); }
    }

    return (
        <section aria-label="Class revisions" className="space-y-4 rounded-lg border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="font-semibold">Class Revisions</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {current ? `Active v${current.revisionNo} is used for class operations. Draft changes require approval.`
                            : "No revision has been approved. Submit a draft for approval before using this class."}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" disabled={locked} onClick={() => void reload()}>Refresh revisions</Button>
                    {mutable && canUpdate && !data.pendingRevisionId && <Button disabled={locked} onClick={() => void createDraft()}>Create Draft v{data.lastIssuedRevisionNo + 1}</Button>}
                </div>
            </div>
            {error && <div role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error} Refresh revisions to load the latest state.</div>}
            {query.isPending && <p role="status">Loading revisions...</p>}
            {query.isError && <p role="alert">Unable to load revisions. Use Refresh revisions to retry.</p>}
            {query.isSuccess && !revisions.length && <p role="status">No revisions are available.</p>}
            <div className="flex flex-wrap gap-2" aria-label="Revision history">
                {revisions.map((revision) => <Button key={revision.id} variant={selected?.id === revision.id ? "default" : "outline"}
                    onClick={() => setSelectedId(revision.id)} aria-pressed={selected?.id === revision.id}>
                    v{revision.revisionNo} · {revision.status.replace(/_/g, " ")}
                </Button>)}
            </div>
            {selected && <>
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">Revision v{selected.revisionNo}</h3>
                    <Badge variant="secondary">{selected.status.replace(/_/g, " ")}</Badge>
                    {selected.baseRevisionId && <span className="text-xs text-muted-foreground">Based on revision ID {selected.baseRevisionId}</span>}
                </div>
                {selected.dependencyValidationRequired && <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    This revision changes training dates, capacity or resources. Approval requires schedule, enrollment and resource checks.
                </p>}
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted/50"><tr><th className="p-3">Field</th><th className="p-3">{current ? `Active v${current.revisionNo}` : "Currently applied"}</th><th className="p-3">Selected v{selected.revisionNo}</th></tr></thead>
                        <tbody>{snapshotFields.map(([key, label]) => {
                            const before = current?.[key]; const after = selected[key];
                            const differs = current && before !== after;
                            return <tr key={key} className={differs ? "border-t bg-amber-50/60 dark:bg-amber-950/20" : "border-t"}>
                                <th scope="row" className="p-3 font-medium">{label}</th>
                                <td className="max-w-sm whitespace-pre-wrap break-words p-3 text-muted-foreground">{String(before ?? "—")}</td>
                                <td className="max-w-sm whitespace-pre-wrap break-words p-3">{String(after ?? "—")}</td>
                            </tr>;
                        })}</tbody>
                    </table>
                </div>
                <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                    <div><dt>Created</dt><dd>{selected.createdAt?.replace("T", " ")} · User {selected.createdBy ?? "—"}</dd></div>
                    <div><dt>Submitted</dt><dd>{selected.submittedAt?.replace("T", " ") ?? "—"} · User {selected.submittedBy ?? "—"}</dd></div>
                    <div><dt>Reviewed</dt><dd>{selected.reviewedAt?.replace("T", " ") ?? "—"} · User {selected.reviewedBy ?? "—"}</dd></div>
                </dl>
                {selected.rejectionReason && <p className="rounded-md border p-3 text-sm"><strong>Rejection reason:</strong> {selected.rejectionReason}</p>}
                {mutable && pendingSelected && <div className="flex flex-wrap gap-2">
                    {selected.status === "DRAFT" && canUpdate && <Button variant="outline" disabled={locked || !options.isSuccess} onClick={() => { setFieldErrors({}); setError(""); setEditing(true); }}>Edit Draft v{selected.revisionNo}</Button>}
                    {selected.status === "DRAFT" && hasPermission("TRAINING_CLASS_SUBMIT") && <Button disabled={locked} onClick={() => { setError(""); setConfirmation("submit"); }}>Submit for approval</Button>}
                    {selected.status === "UNDER_REVIEW" && hasPermission("TRAINING_CLASS_APPROVE") && <>
                        <Button disabled={locked} onClick={() => { setError(""); setConfirmation("approve"); }}>Approve revision</Button>
                        <Button variant="destructive" disabled={locked} onClick={() => { setError(""); setReason(""); setConfirmation("reject"); }}>Reject revision</Button>
                    </>}
                </div>}
            </>}
            <TrainingClassEditForm open={editing} initial={data} schema={schema} isSubmitting={busy} fieldErrors={fieldErrors}
                onClearErrors={() => setFieldErrors({})} onSubmit={(values) => void saveDraft(values)}
                onClose={(open) => { if (!busy) { setEditing(open); if (!open) void reload(); } }} />
            <Dialog open={confirmation !== null} onOpenChange={(open) => { if (!open && !busy) setConfirmation(null); }}>
                <DialogContent showCloseButton={!busy} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
                    <DialogHeader>
                        <DialogTitle>{confirmation ? actionNames[confirmation] : "Revision action"} v{selected?.revisionNo}</DialogTitle>
                        <DialogDescription>{confirmation === "approve"
                            ? `Publish this revision for ${data.code}? ${current ? `Active v${current.revisionNo} will be archived.` : "This will become the first approved revision."} Class status remains ${data.status}.`
                            : confirmation === "reject" ? "The active revision will remain in use. Enter a reason for rejecting this proposal."
                            : "Submit this saved draft for review? It will become read only while awaiting a decision."}</DialogDescription>
                    </DialogHeader>
                    {confirmation === "reject" && <div className="grid gap-2"><Label htmlFor="class-rejection-reason">Rejection reason</Label>
                        <Textarea id="class-rejection-reason" value={reason} maxLength={2000} disabled={busy} onChange={(event) => setReason(event.target.value)} /></div>}
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</Button>
                        <Button disabled={locked || (confirmation === "reject" && !reason.trim())} onClick={() => void confirmAction()}>{busy ? "Processing..." : "Confirm"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
