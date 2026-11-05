import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { ChevronDown, Link2, Pencil } from "lucide-react";

import { syllabusApi, type SyllabusTopicCoverage } from "@/api/features/demo/syllabus.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { usePermissions } from "@/hooks/usePermissions";

type Props = {
    syllabusId: number;
    readOnly: boolean;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
};

function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const body = error.response?.data as {
            message?: string;
            errors?: Record<string, string[]>;
        } | undefined;
        const field = Object.values(body?.errors ?? {}).flat()[0];
        if (typeof field === "string") return field;
        if (body?.message) return body.message;
        if (error.response?.status === 403) return "You do not have permission to edit this Syllabus.";
    }
    return "Unable to update CLO coverage.";
}

/** Topic-CLO mapping is part of the same card as CLO Management. */
export default function SyllabusCoveragePanel({
    syllabusId,
    readOnly,
    expanded,
    onExpandedChange,
}: Props) {
    const qc = useQueryClient();
    const { hasPermission } = usePermissions();
    const canEdit = !readOnly && hasPermission("SYLLABUS_UPDATE");
    const [editing, setEditing] = useState<SyllabusTopicCoverage | null>(null);
    const [selected, setSelected] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);

    const query = useQuery({
        queryKey: ["syllabus-coverage", syllabusId],
        queryFn: () => syllabusApi.coverage(syllabusId),
        enabled: Number.isSafeInteger(syllabusId) && syllabusId > 0,
    });
    const report = query.data;

    function openEdit(topic: SyllabusTopicCoverage) {
        if (!canEdit) return;
        setEditing(topic);
        setSelected([...topic.cloIds]);
    }

    async function save() {
        if (!editing || busy || !canEdit) return;
        setBusy(true);
        try {
            await syllabusApi.setTopicClos(syllabusId, editing.id, selected);
            await qc.invalidateQueries({ queryKey: ["syllabus-coverage", syllabusId] });
            await qc.invalidateQueries({ queryKey: ["student-syllabus-detail", syllabusId] });
            setEditing(null);
            toast.success("Topic learning outcomes updated.");
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-3 border-t pt-4">
            <Button
                type="button"
                variant="ghost"
                className="flex w-full items-center justify-between px-2 text-left"
                aria-expanded={expanded}
                aria-controls="syllabus-topic-clo-mapping"
                onClick={() => onExpandedChange(!expanded)}
            >
                <span className="flex items-center gap-2 font-semibold">Topic – CLO Mapping</span>
                <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </Button>

            {expanded && (
                <div id="syllabus-topic-clo-mapping" className="space-y-3">
                    {query.isPending && (
                        <p className="text-sm text-muted-foreground">Loading Topic–CLO mapping...</p>
                    )}
                    {query.isError && (
                        <div role="alert" className="flex items-center gap-2 text-sm">
                            Could not load Topic–CLO mapping.
                            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button>
                        </div>
                    )}
                    {report && (report.topics.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Add Sections and Topics to assign CLOs.</p>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="border-b bg-muted/30 text-left">
                                    <tr>
                                        <th scope="col" className="p-3 font-semibold">Topic</th>
                                        <th scope="col" className="p-3 font-semibold">Linked CLOs</th>
                                        {canEdit && <th scope="col" className="p-3 text-right font-semibold">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {report.topics.map((topic) => (
                                        <tr key={topic.id}>
                                            <td className="p-3 font-medium">{topic.title}</td>
                                            <td className="p-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {topic.cloIds.length ? topic.cloIds.map((id) => {
                                                        const clo = report.clos.find((candidate) => candidate.id === id);
                                                        return clo ? <Badge key={id} variant="outline">{clo.code}</Badge> : null;
                                                    }) : <span className="text-muted-foreground">Not linked</span>}
                                                </div>
                                            </td>
                                            {canEdit && (
                                                <td className="p-3 text-right">
                                                    <Button variant="outline" size="sm" onClick={() => openEdit(topic)}>
                                                        <Pencil className="size-3.5" /> Assign CLOs
                                                    </Button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                        <Link2 className="mr-1 inline size-3" />
                        Coverage is based on manually assigned Topic–CLO links. It does not change
                        Completion Progress or Publish requirements.
                    </p>
                </div>
            )}

            <Modal open={Boolean(editing)} onClose={() => !busy && setEditing(null)} title="Assign CLOs to Topic">
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground break-words">
                        Topic: <span className="font-medium text-foreground">{editing?.title}</span>
                    </p>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3">
                        {report?.clos.length ? report.clos.map((clo) => (
                            <label key={clo.id} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/30">
                                <Checkbox
                                    checked={selected.includes(clo.id)}
                                    disabled={busy}
                                    aria-label={`Link ${clo.code} to ${editing?.title ?? "Topic"}`}
                                    onCheckedChange={(checked) => setSelected((previous) =>
                                        checked === true
                                            ? [...new Set([...previous, clo.id])]
                                            : previous.filter((id) => id !== clo.id)
                                    )}
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold">{clo.code}</span>
                                    <span className="block text-xs text-muted-foreground break-words">{clo.details}</span>
                                </span>
                            </label>
                        )) : <p className="text-sm text-muted-foreground">Create a CLO first.</p>}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
                        <Button disabled={busy || !report?.clos.length} onClick={() => void save()}>
                            {busy ? "Saving..." : "Save mapping"}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
