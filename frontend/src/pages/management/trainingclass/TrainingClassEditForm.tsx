import { useEffect, useState } from "react";
import axios from "axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { EntitySchema } from "@/types";
import {
    createTrainingClassDraft, getTrainingClass, getTrainingClassRevisions,
    getTrainingClassCreateOptions,
    type TrainingClassResponse, type TrainingClassRevisionResponse,
} from "@/api/features/schedule/training-class.api";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormFieldRenderer } from "@/components/datatable/modal/form/FormFieldRenderer";
import { validateTrainingClassForm, changeTrainingClassField } from "./training-class-form";

interface Props {
    open: boolean;
    onClose: (open: boolean) => void;
    schema: EntitySchema;
    initial: TrainingClassResponse;
    onSubmit: (data: Record<string, unknown>) => void;
    onClearErrors: () => void;
    fieldErrors?: Record<string, string[]>;
    isSubmitting?: boolean;
}

export default function TrainingClassEditForm({
    open, onClose, schema, initial, onSubmit, onClearErrors,
    fieldErrors = {}, isSubmitting = false,
}: Props) {
    const qc = useQueryClient();
    const [baseline, setBaseline] = useState(initial);
    const [draft, setDraft] = useState<TrainingClassRevisionResponse | null>(null);
    const [form, setForm] = useState<Record<string, unknown>>({});
    const [localErrors, setLocalErrors] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const errors = { ...fieldErrors, ...localErrors };
    const mutable = baseline.isActive && ["PLANNING", "ONGOING"].includes(baseline.status);
    const editable = mutable && draft?.status === "DRAFT";
    const busy = isSubmitting || loading;
    const optionsQuery = useQuery({ queryKey: ["training-class-create-options"], queryFn: getTrainingClassCreateOptions, enabled: open });
    const locations = optionsQuery.data?.locations ?? [];
    const fields = schema.fields.filter((field) => field.editable !== false
        && field.type !== "dynamic" && !field.dynamicChild)
        .map((field) => field.name === "location" ? { ...field, type: "select" as const,
            disabled: !form.site || !optionsQuery.isSuccess,
            helpText: form.site ? "Choose a location at the selected site." : "Select a site first.",
            options: locations.filter((location) => location.site === form.site) } : field);

    function install(root: TrainingClassResponse, pending: TrainingClassRevisionResponse | null) {
        setBaseline(root);
        setDraft(pending);
        setForm({ ...root, ...(pending ?? {}), id: root.id });
        setLocalErrors({});
        setError("");
    }

    useEffect(() => {
        if (!open) return;
        let active = true;
        setLoading(true);
        setBaseline(initial);
        setDraft(null);
        setForm({});
        setLocalErrors({});
        setError("");
        Promise.all([getTrainingClass(String(initial.id)), getTrainingClassRevisions(initial.id)])
            .then(([root, revisions]) => {
                if (active) install(root, revisions.find((revision) => revision.id === root.pendingRevisionId) ?? null);
            })
            .catch(() => { if (active) setError("Unable to load the draft. Close this form and try again."); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [initial.id, open]);

    async function loadLatest(create = false) {
        setLoading(true);
        setError("");
        try {
            const root = create ? await createTrainingClassDraft(baseline) : await getTrainingClass(String(initial.id));
            const revisions = await getTrainingClassRevisions(root.id);
            install(root, revisions.find((revision) => revision.id === root.pendingRevisionId) ?? null);
            if (create) void qc.invalidateQueries({ queryKey: ["training-class"] });
            onClearErrors();
        } catch (err) {
            setError(axios.isAxiosError(err) ? err.response?.data?.message ?? "Unable to load the draft." : "Unable to load the draft.");
            if (axios.isAxiosError(err) && err.response?.data?.errors) setLocalErrors(err.response.data.errors);
        } finally {
            setLoading(false);
        }
    }

    function save() {
        if (busy || !editable || !draft) return;
        const validation = validateTrainingClassForm(form, { locations, classStatus: baseline.status, originalStartDate: baseline.startDate });
        setLocalErrors(validation);
        if (Object.keys(validation).length) return;
        onSubmit({ ...form, version: baseline.version, revisionId: draft.id, revisionVersion: draft.version });
    }

    return (
        <Sheet open={open} onOpenChange={(next) => { if (!busy) onClose(next); }}>
            <SheetContent side="right" className="w-full sm:max-w-xl" showCloseButton={!busy}>
                <SheetHeader className="border-b">
                    <SheetTitle>{draft ? `Edit Draft v${draft.revisionNo}` : "Create a Class Draft"}</SheetTitle>
                    <SheetDescription>
                        Changes are saved as a draft and take effect only after approval.
                        {baseline.currentRevisionNo ? ` Active v${baseline.currentRevisionNo} stays in use.` : " This class has no approved revision yet."}
                    </SheetDescription>
                    <div className="flex gap-2 pt-2">
                        <Badge variant="secondary">Class: {baseline.status}</Badge>
                        {draft && <Badge variant="outline">Revision: {draft.status.replace(/_/g, " ")}</Badge>}
                    </div>
                </SheetHeader>
                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
                    {loading && <p role="status">Loading draft...</p>}
                    {optionsQuery.isError && <p role="alert" className="text-sm text-destructive">Unable to load locations. Close this form and try again.</p>}
                    {baseline.status === "ONGOING" && <p className="text-sm text-muted-foreground">Start date is fixed because this class is already Ongoing. Site, location and end date can be proposed in this draft.</p>}
                    {!loading && !draft && mutable && !error && (
                        <div className="space-y-3 rounded-md border bg-muted/30 p-4">
                            <p className="text-sm">Create a new draft from the current class information.</p>
                            <Button type="button" onClick={() => void loadLatest(true)}>Create Draft v{baseline.lastIssuedRevisionNo + 1}</Button>
                        </div>
                    )}
                    {!mutable && <p role="alert" className="text-sm text-destructive">This class can no longer be edited.</p>}
                    {draft?.status === "UNDER_REVIEW" && <p role="status" className="text-sm">This revision is under review and is read only.</p>}
                    {!loading && draft && fields.map((field) => {
                        const locked = !editable || ["code", "programVersionId"].includes(field.name)
                            || (field.name === "startDate" && baseline.status === "ONGOING");
                        if (locked) {
                            const value = form[field.name];
                            const label = field.options?.find((option) => String(option.value) === String(value))?.label;
                            return (
                                <div key={field.name} className="grid gap-2">
                                    <Label htmlFor={`locked-${field.name}`}>{field.label} <span className="text-xs text-muted-foreground">(read only)</span></Label>
                                    <Input id={`locked-${field.name}`} readOnly value={label ?? String(value ?? "")} className="bg-muted/40" />
                                </div>
                            );
                        }
                        return (
                            <fieldset key={field.name} disabled={busy}>
                                <FormFieldRenderer field={field} value={form[field.name] ?? ""}
                                    errorClass={errors[field.name]?.length ? "border-destructive" : ""}
                                    fieldErrors={errors[field.name]}
                                    onChange={(name, value) => {
                                        setForm((previous) => changeTrainingClassField(previous, name, value, locations));
                                        setLocalErrors((previous) => { const next = { ...previous }; delete next[name]; return next; });
                                    }} />
                            </fieldset>
                        );
                    })}
                    {errors.version && (
                        <div role="alert" className="space-y-2 rounded-md border border-destructive/30 p-3">
                            <p className="text-sm text-destructive">{errors.version.join(" ")}</p>
                            <Button type="button" variant="outline" disabled={busy} onClick={() => void loadLatest()}>Reload latest (discard edits)</Button>
                        </div>
                    )}
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                </div>
                <SheetFooter className="border-t sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" disabled={busy} onClick={() => onClose(false)}>Cancel</Button>
                    <Button type="button" disabled={busy || !editable || !!errors.version || !optionsQuery.isSuccess} onClick={save}>
                        {isSubmitting ? "Saving..." : "Save draft"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
