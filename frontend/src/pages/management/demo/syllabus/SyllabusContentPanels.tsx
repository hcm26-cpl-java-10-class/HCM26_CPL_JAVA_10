import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

import {
    syllabusApi,
    type SyllabusClo,
} from "@/api/features/demo/syllabus.api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import SyllabusCoveragePanel from "./SyllabusCoveragePanel";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { usePermissions } from "@/hooks/usePermissions";

function errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | {
            message?: string;
            errors?: Record<string, string[]>;
        }
            | undefined;

        const fieldError = data?.errors &&
            Object.values(data.errors).flat()[0];

        if (typeof fieldError === "string") {
            return fieldError;
        }

        if (typeof data?.message === "string") {
            return data.message;
        }

        if (error.response?.status === 403) {
            return "You do not have permission to perform this action.";
        }

        if (error.response?.status === 404) {
            return "The requested record was not found.";
        }
    }

    return "Operation failed. Please try again.";
}

function clean(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}

// ==========================================
// CLO MANAGEMENT
// ==========================================

export function CloPanel({
                             syllabusId,
                             readOnly = false,
                         }: {
    syllabusId: number;
    readOnly?: boolean;
}) {
    const qc = useQueryClient();
    const { hasPermission } = usePermissions();

    const canCreate = !readOnly && hasPermission("SYLLABUS_CREATE");
    const canEdit = !readOnly && hasPermission("SYLLABUS_UPDATE");
    const canDelete = !readOnly && hasPermission("SYLLABUS_DELETE");

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<SyllabusClo | null>(null);
    const [details, setDetails] = useState("");
    const [detailsError, setDetailsError] = useState("");
    const [deleting, setDeleting] = useState<SyllabusClo | null>(null);
    const [busy, setBusy] = useState(false);
    const [mappingOpen, setMappingOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkDetails, setBulkDetails] = useState<string[]>(["", "", ""]);
    const [bulkError, setBulkError] = useState("");

    const query = useQuery({
        queryKey: ["syllabus-clos", syllabusId],
        queryFn: () => syllabusApi.listClos(syllabusId),
        enabled: Number.isSafeInteger(syllabusId) && syllabusId > 0,
    });

    const coverageQuery = useQuery({
        queryKey: ["syllabus-coverage", syllabusId],
        queryFn: () => syllabusApi.coverage(syllabusId),
        enabled: Number.isSafeInteger(syllabusId) && syllabusId > 0,
    });
    const coverage = coverageQuery.data;
    const coveredCloById = new Map((coverage?.clos ?? []).map((clo) => [clo.id, clo]));
    const clos = query.data ?? [];

    async function refresh() {
        await Promise.all([
            qc.invalidateQueries({ queryKey: ["syllabus-clos", syllabusId] }),
            qc.invalidateQueries({ queryKey: ["syllabus-progress", syllabusId] }),
            qc.invalidateQueries({ queryKey: ["syllabus-coverage", syllabusId] }),
            qc.invalidateQueries({ queryKey: ["syllabuses"] }),
        ]);
    }

    function openCreate() {
        if (readOnly) return;
        setEditing(null);
        setDetails("");
        setDetailsError("");
        setOpen(true);
    }

    function openEdit(item: SyllabusClo) {
        if (readOnly) return;
        setEditing(item);
        setDetails(item.details);
        setDetailsError("");
        setOpen(true);
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy || readOnly) return;

        const value = clean(details);

        if (
            value.length < 10 ||
            value.length > 2000 ||
            !/\p{L}/u.test(value)
        ) {
            setDetailsError(
                "CLO Details must contain letters (10-2000 characters)."
            );
            return;
        }

        const duplicate = clos.some(
            (item) =>
                item.id !== editing?.id &&
                clean(item.details).toLowerCase() === value.toLowerCase()
        );

        if (duplicate) {
            setDetailsError("This CLO already exists.");
            return;
        }

        setBusy(true);

        try {
            if (editing) {
                await syllabusApi.updateClo(
                    syllabusId,
                    editing.id,
                    value
                );
            } else {
                await syllabusApi.createClo(syllabusId, value);
            }

            await refresh();
            setOpen(false);
            toast.success("CLO saved successfully.");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function saveBulk(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || !canCreate) return;
        if (bulkDetails.length < 1 || bulkDetails.length > 20) {
            setBulkError("Enter between 1 and 20 CLOs.");
            return;
        }
        const normalized = bulkDetails.map(clean);
        for (let index = 0; index < normalized.length; index++) {
            const value = normalized[index];
            if (value.length < 10 || value.length > 2000 || !/\p{L}/u.test(value)) {
                setBulkError(`CLO ${index + 1}: use 10–2000 characters including letters.`);
                return;
            }
        }
        const used = new Set(clos.map((clo) => clean(clo.details).toLocaleLowerCase("vi")));
        for (let index = 0; index < normalized.length; index++) {
            const key = normalized[index].toLocaleLowerCase("vi");
            if (used.has(key)) {
                setBulkError(`CLO ${index + 1}: duplicate details, either existing or in this form.`);
                return;
            }
            used.add(key);
        }
        setBusy(true);
        try {
            await syllabusApi.bulkCreateClos(syllabusId, normalized);
            await refresh();
            setBulkDetails(["", "", ""]);
            setBulkError("");
            setBulkOpen(false);
            toast.success(`${normalized.length} CLOs created successfully.`);
        } catch (error) { setBulkError(errorMessage(error)); }
        finally { setBusy(false); }
    }

    async function remove() {
        if (!deleting || busy || readOnly) return;

        setBusy(true);

        try {
            await syllabusApi.deleteClo(syllabusId, deleting.id);
            await refresh();

            setDeleting(null);
            toast.success("CLO deleted successfully.");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="w-full space-y-4 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold">Course Learning Outcomes</h2>
                    <p className="text-sm text-muted-foreground">
                        {clos.length} CLO(s)
                    </p>
                </div>

                {canCreate && <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" type="button" disabled={busy} onClick={() => { setBulkOpen((v) => !v); setBulkError(""); }}>
                        Add Multiple CLOs
                    </Button>
                    <Button onClick={openCreate} disabled={busy} size="sm"><Plus className="size-4" /> Add CLO</Button>
                </div>}
            </div>

            {bulkOpen && canCreate && <form onSubmit={(event) => void saveBulk(event)} className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div>
                    <p className="text-sm font-medium">Create Multiple CLOs</p>
                    <p className="mt-1 text-xs text-muted-foreground">Enter one learning outcome per row (1–20). CLO codes and order are generated automatically. All entries are saved together or none are saved.</p>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {bulkDetails.map((value, index) => <div key={index} className="flex items-start gap-2">
                        <label className="w-12 shrink-0 pt-2 text-xs text-muted-foreground" htmlFor={`bulk-clo-${syllabusId}-${index}`}>#{index + 1}</label>
                        <textarea id={`bulk-clo-${syllabusId}-${index}`} value={value} rows={2} maxLength={2000}
                            className="min-h-16 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm"
                            disabled={busy} aria-invalid={!!bulkError}
                            placeholder="Describe the learning outcome (10–2000 characters)"
                            onChange={(event) => { setBulkDetails((rows) => rows.map((row, i) => i === index ? event.target.value : row)); setBulkError(""); }}/>
                        <Button type="button" variant="ghost" size="icon-sm" title="Remove row" aria-label={`Remove CLO row ${index + 1}`}
                            disabled={busy || bulkDetails.length === 1} onClick={() => { setBulkDetails((rows) => rows.filter((_, i) => i !== index)); setBulkError(""); }}>
                            <Trash2 className="size-3.5"/>
                        </Button>
                    </div>)}
                </div>
                {bulkError && <p role="alert" className="text-xs text-destructive">{bulkError}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={busy || bulkDetails.length >= 20}
                        onClick={() => setBulkDetails((rows) => [...rows, ""])}><Plus className="size-3.5"/> Add row</Button>
                    <div className="flex gap-2">
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setBulkOpen(false)}>Cancel</Button>
                        <Button type="submit" size="sm" disabled={busy}>{busy ? "Creating..." : `Create ${bulkDetails.length} CLOs`}</Button>
                    </div>
                </div>
            </form>}

            {coverage && (
                <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                        {[
                            { label: "Total CLOs", value: String(coverage.totalClos) },
                            { label: "CLO Coverage", value: `${coverage.coveragePercent}%` },
                            { label: "Unlinked Topics", value: String(coverage.unlinkedTopics) },
                        ].map((item) => (
                            <div key={item.label} className="rounded-lg border bg-muted/20 p-3">
                                <p className="text-xs text-muted-foreground">{item.label}</p>
                                <p className="mt-1 text-xl font-semibold">{item.value}</p>
                            </div>
                        ))}
                    </div>
                    <Progress value={coverage.coveragePercent} aria-label="CLO coverage percentage" />
                </div>
            )}
            {coverageQuery.isError && (
                <div role="alert" className="flex items-center gap-2 text-sm text-muted-foreground">
                    Could not load CLO coverage.
                    <Button size="sm" variant="outline" onClick={() => void coverageQuery.refetch()}>Retry</Button>
                </div>
            )}

            {query.isPending ? (
                <p className="text-sm text-muted-foreground">Loading CLOs...</p>
            ) : query.isError ? (
                <div className="space-y-2">
                    <p className="text-sm text-destructive">
                        Could not load CLOs.
                    </p>

                    <Button
                        variant="outline"
                        onClick={() => void query.refetch()}
                    >
                        Retry
                    </Button>
                </div>
            ) : clos.length === 0 ? (
                <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No CLOs yet.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b text-left">
                            <th className="w-24 p-3">CLO</th>
                            <th className="p-3">CLO Details</th>
                            <th className="w-28 p-3">Topics</th>
                            <th className="w-32 p-3">Coverage</th>
                            {(canEdit || canDelete) && (
                                <th className="w-40 p-3 text-right">Actions</th>
                            )}
                        </tr>
                        </thead>

                        <tbody>
                        {clos.map((clo) => (
                            <tr key={clo.id} className="border-b last:border-0">
                                <td className="p-3 align-top font-semibold">
                                    {clo.code}
                                </td>

                                <td className="whitespace-pre-wrap p-3 align-top">
                                    {clo.details}
                                </td>

                                <td className="p-3 align-top">
                                    {coverage ? (
                                        <Button
                                            type="button" variant="ghost" size="sm"
                                            className="h-auto px-1 text-xs"
                                            onClick={() => setMappingOpen(true)}
                                            title="Show Topic–CLO mapping"
                                        >
                                            {coveredCloById.get(clo.id)?.topicCount ?? 0} topics
                                        </Button>
                                    ) : <span className="text-xs text-muted-foreground">—</span>}
                                </td>
                                <td className="p-3 align-top">
                                    {coverage ? (
                                        <Badge variant="outline">
                                            {(coveredCloById.get(clo.id)?.topicCount ?? 0) > 0
                                                ? "Covered" : "Not covered"}
                                        </Badge>
                                    ) : <span className="text-xs text-muted-foreground">—</span>}
                                </td>

                                {(canEdit || canDelete) && (
                                    <td className="p-3 align-top">
                                        <div className="flex justify-end gap-2">
                                            {canEdit && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openEdit(clo)}
                                                >
                                                    <Pencil className="size-4" />
                                                    Edit
                                                </Button>
                                            )}

                                            {canDelete && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => setDeleting(clo)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            {coverage && coverage.totalClos > 0 && coverage.coveredClos < coverage.totalClos && (
                <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Needs attention:</span>{" "}
                    {coverage.clos.filter((clo) => clo.topicCount === 0).map((clo) => clo.code).join(", ")}
                    {" — no supporting Topic assigned yet."}
                </div>
            )}

            <SyllabusCoveragePanel
                syllabusId={syllabusId}
                readOnly={readOnly}
                expanded={mappingOpen}
                onExpandedChange={setMappingOpen}
            />

            <Modal
                open={open && !readOnly}
                title={editing ? `Edit ${editing.code}` : "Create CLO"}
                size="lg"
                onClose={() => {
                    if (!busy) setOpen(false);
                }}
            >
                <form noValidate onSubmit={(event) => void save(event)} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="clo-details" className="text-sm font-medium">
                            CLO Details *
                        </label>

                        <textarea
                            id="clo-details"
                            className="min-h-32 w-full rounded-md border bg-background p-3 text-sm"
                            value={details}
                            maxLength={2000}
                            required
                            disabled={busy}
                            placeholder="Describe the expected learning outcome"
                            aria-invalid={Boolean(detailsError)}
                            onChange={(event) => {
                                setDetails(event.target.value);
                                setDetailsError("");
                            }}
                        />

                        {detailsError && (
                            <p role="alert" className="text-xs text-destructive">
                                {detailsError}
                            </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            {details.trim().length}/2000 characters · CLO code is generated automatically.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>

                        <Button type="submit" disabled={busy}>
                            {busy ? "Saving..." : "Save CLO"}
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={!!deleting && !readOnly}
                title="Delete CLO?"
                description={`Delete ${deleting?.code ?? "this CLO"}?`}
                loading={busy}
                onCancel={() => {
                    if (!busy) setDeleting(null);
                }}
                onConfirm={() => void remove()}
            />
        </section>
    );
}
