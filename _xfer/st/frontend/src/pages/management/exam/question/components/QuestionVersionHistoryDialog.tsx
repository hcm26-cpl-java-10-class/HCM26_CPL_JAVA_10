import { questionVersionApi } from "@/api";
import { ApiErrorState } from "@/components/exam/ApiErrorState";
import { PermissionGate } from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/pages/management/exam/examConfig";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export function QuestionVersionHistoryDialog({ questionId, open, onOpenChange }: {
    questionId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const queryClient = useQueryClient();
    const [selected, setSelected] = useState<number[]>([]);
    const [confirmRestore, setConfirmRestore] = useState<number | null>(null);

    const history = useQuery({
        queryKey: ["question-versions", questionId],
        queryFn: () => questionVersionApi.history(questionId),
        enabled: open,
    });

    const [from, to] = selected.length === 2 ? [Math.min(...selected), Math.max(...selected)] : [null, null];
    const compare = useQuery({
        queryKey: ["question-versions-compare", questionId, from, to],
        queryFn: () => questionVersionApi.compare(questionId, from as number, to as number),
        enabled: open && from != null && to != null,
    });

    const restore = useMutation({
        mutationFn: (version: number) => questionVersionApi.restore(questionId, version),
        onSuccess: async (_d, version) => {
            toast.success(`Restored version ${version}.`);
            setConfirmRestore(null);
            setSelected([]);
            await queryClient.invalidateQueries({ queryKey: ["question-versions", questionId] });
            await queryClient.invalidateQueries({ queryKey: ["question", "detail", questionId] });
        },
        onError: (error) => {
            setConfirmRestore(null);
            toast.error(getErrorMessage(error, "Could not restore this version."));
        },
    });

    const toggle = (version: number) =>
        setSelected((prev) => (prev.includes(version) ? prev.filter((v) => v !== version) : prev.length >= 2 ? [prev[1], version] : [...prev, version]));

    const rows = history.data ?? [];
    const latest = rows[0]?.versionNumber;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Version history</DialogTitle>
                    <DialogDescription>Tick two versions to compare them, or restore an older version. Restoring keeps the current one in the history.</DialogDescription>
                </DialogHeader>

                {history.isError ? (
                    <ApiErrorState error={history.error} onRetry={() => history.refetch()} />
                ) : history.isLoading ? (
                    <Skeleton className="h-40 w-full" />
                ) : rows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No history yet. A version is saved every time this question is edited.</p>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {rows.map((v) => (
                            <li key={v.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                                <input
                                    type="checkbox"
                                    aria-label={`Select version ${v.versionNumber} to compare`}
                                    checked={selected.includes(v.versionNumber)}
                                    onChange={() => toggle(v.versionNumber)}
                                />
                                <span className="font-medium">v{v.versionNumber}</span>
                                {v.versionNumber === latest && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">Current</span>}
                                <span className="text-muted-foreground">{v.note ?? ""}</span>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {v.createdByName ?? "Unknown"} · {new Date(v.createdAt).toLocaleString()}
                                </span>
                                {v.versionNumber !== latest && (
                                    <PermissionGate permission="QUESTION_UPDATE">
                                        {confirmRestore === v.versionNumber ? (
                                            <span className="flex items-center gap-1">
                                                <Button size="sm" disabled={restore.isPending} onClick={() => restore.mutate(v.versionNumber)}>
                                                    {restore.isPending ? "Restoring..." : "Confirm"}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setConfirmRestore(null)}>Cancel</Button>
                                            </span>
                                        ) : (
                                            <Button size="sm" variant="outline" onClick={() => setConfirmRestore(v.versionNumber)}>Restore</Button>
                                        )}
                                    </PermissionGate>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {from != null && to != null && (
                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold">Changes from v{from} to v{to}</h3>
                        {compare.isError ? (
                            <ApiErrorState error={compare.error} onRetry={() => compare.refetch()} />
                        ) : compare.isLoading ? (
                            <Skeleton className="h-24 w-full" />
                        ) : compare.data && compare.data.changes.length === 0 ? (
                            <p className="text-sm text-muted-foreground">These two versions are identical.</p>
                        ) : (
                            compare.data?.changes.map((c) => (
                                <div key={c.field} className="rounded-lg border">
                                    <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-semibold">{c.field}</div>
                                    <div className="grid gap-px bg-border sm:grid-cols-2">
                                        <pre className="whitespace-pre-wrap bg-red-500/5 p-3 text-xs">{c.before || "(empty)"}</pre>
                                        <pre className="whitespace-pre-wrap bg-emerald-500/5 p-3 text-xs">{c.after || "(empty)"}</pre>
                                    </div>
                                </div>
                            ))
                        )}
                    </section>
                )}
            </DialogContent>
        </Dialog>
    );
}
