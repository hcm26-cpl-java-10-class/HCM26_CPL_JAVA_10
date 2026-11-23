import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Eye, Pencil, Plus, Power, Upload } from "lucide-react";
import { trainerApi, type Trainer } from "@/api/features/trainer.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/common/NativeSelect";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { describeApiError } from "@/utils/api-error.utils";
import { TrainerForm } from "./TrainerForm";
import { TrainerImportModal } from "./TrainerImportModal";

export default function TrainerManagementPage() {
    const { hasPermission } = usePermissions();
    const client = useQueryClient();
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [page, setPage] = useState(0);
    const [edit, setEdit] = useState<Trainer | null | undefined>();
    const [detail, setDetail] = useState<Trainer>();
    const [deleting, setDeleting] = useState<Trainer>();
    const [importing, setImporting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const list = useQuery({
        queryKey: ["trainers", "list", search, status, page],
        queryFn: () => trainerApi.list({ search, status, page, size: 20 }),
        enabled: hasPermission("TRAINER_READ"),
        retry: false,
    });

    useEffect(() => {
        if (list.isFetching || !list.data) return;
        const lastValidPage = Math.max(0, list.data.totalPages - 1);
        if (page > lastValidPage) {
            setPage(lastValidPage);
        }
    }, [list.data, list.isFetching, page]);

    const refresh = async () => {
        await Promise.all([
            client.invalidateQueries({ queryKey: ["trainers"] }),
            client.invalidateQueries({ queryKey: ["class-setup", "verified-trainers"] }),
            client.invalidateQueries({ queryKey: ["classes"] }),
        ]);
    };

    const action = async (operation: () => Promise<unknown>, success: string) => {
        setBusy(true);
        setError("");
        setMessage("");
        try {
            await operation();
            await refresh();
            setMessage(success);
            setDeleting(undefined);
        } catch (err) {
            setError(describeApiError(err).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <MainLayout>
            <div className="space-y-5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Trainer Management</h1>
                        <p className="text-sm text-muted-foreground">Manage the approved internal trainer directory.</p>
                    </div>
                    {hasPermission("TRAINER_CREATE") && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" className="gap-1.5" onClick={() => setImporting(true)}>
                                <Upload className="h-4 w-4" />
                                Import Trainers
                            </Button>
                            <Button className="gap-1.5" onClick={() => setEdit(null)}>
                                <Plus className="h-4 w-4" />
                                Add Trainer
                            </Button>
                        </div>
                    )}
                </div>

                {!hasPermission("TRAINER_READ") ? (
                    <ApiErrorState kind="forbidden" error={undefined} resource="trainers" />
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(220px,1fr)_180px]">
                            <Input
                                aria-label="Search Trainers"
                                placeholder="Search code, name, email or specialization"
                                value={search}
                                onChange={e => {
                                    setSearch(e.target.value);
                                    setPage(0);
                                }}
                                maxLength={150}
                            />
                            <NativeSelect
                                aria-label="Filter Trainer Status"
                                value={status}
                                onChange={e => {
                                    setStatus(e.target.value);
                                    setPage(0);
                                }}
                            >
                                <option value="all">All statuses</option>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="INACTIVE">INACTIVE</option>
                            </NativeSelect>
                        </div>

                        {message && (
                            <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                                {message}
                            </p>
                        )}
                        {error && (
                            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {error}
                            </p>
                        )}

                        {list.isPending ? (
                            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                                Loading trainers…
                            </p>
                        ) : list.isError ? (
                            <ApiErrorState error={list.error} resource="trainers" onRetry={() => void list.refetch()} />
                        ) : (
                            <>
                                <div className="rounded-xl border bg-card shadow-xs overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/40">
                                                <TableHead className="w-32">Trainer ID</TableHead>
                                                <TableHead>Full Name</TableHead>
                                                <TableHead>Work Email</TableHead>
                                                <TableHead>Specialization</TableHead>
                                                <TableHead className="w-28">Status</TableHead>
                                                <TableHead className="w-40 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {list.data.content.map(t => (
                                                <TableRow key={t.id} className="hover:bg-muted/30">
                                                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                                                        {t.trainerCode}
                                                    </TableCell>
                                                    <TableCell className="font-medium text-foreground">{t.fullName}</TableCell>
                                                    <TableCell className="text-muted-foreground">{t.email}</TableCell>
                                                    <TableCell className="max-w-[260px] truncate text-muted-foreground" title={t.specialization || undefined}>
                                                        {t.specialization || "—"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={
                                                                t.status === "ACTIVE"
                                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                    : "border-border bg-muted text-muted-foreground"
                                                            }
                                                        >
                                                            {t.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                                disabled={busy}
                                                                aria-label={`View ${t.trainerCode}`}
                                                                title="View details"
                                                                onClick={() => void action(async () => setDetail(await trainerApi.get(t.id)), "")}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                            {hasPermission("TRAINER_UPDATE") && (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                                                        disabled={busy}
                                                                        aria-label={`Edit ${t.trainerCode}`}
                                                                        title="Edit trainer"
                                                                        onClick={() => void action(async () => setEdit(await trainerApi.get(t.id)), "")}
                                                                    >
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className={
                                                                            t.status === "ACTIVE"
                                                                                ? "h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40"
                                                                                : "h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
                                                                        }
                                                                        disabled={busy}
                                                                        aria-label={`${t.status === "ACTIVE" ? "Deactivate" : "Activate"} ${t.trainerCode}`}
                                                                        title={t.status === "ACTIVE" ? "Deactivate trainer" : "Activate trainer"}
                                                                        onClick={() =>
                                                                            void action(
                                                                                () => trainerApi.status(t.id, t.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
                                                                                "Trainer status updated.",
                                                                            )
                                                                        }
                                                                    >
                                                                        <Power className="h-4 w-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {hasPermission("TRAINER_DELETE") && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                                    disabled={busy}
                                                                    aria-label={`Archive ${t.trainerCode}`}
                                                                    title="Archive trainer"
                                                                    onClick={() => {
                                                                        setError("");
                                                                        setDeleting(t);
                                                                    }}
                                                                >
                                                                    <Archive className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {!list.data.content.length && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                                                        No trainers match the current filters.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                                    <span>
                                        {list.data.totalElements} trainers · Page {page + 1} / {Math.max(1, list.data.totalPages)}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page + 1 >= list.data.totalPages}
                                            onClick={() => setPage(page + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                )}

                {edit !== undefined && (
                    <TrainerForm
                        key={edit?.id ?? "new"}
                        trainer={edit ?? undefined}
                        close={() => setEdit(undefined)}
                        saved={async () => {
                            await refresh();
                            setMessage("Trainer saved.");
                        }}
                    />
                )}

                {importing && (
                    <TrainerImportModal
                        close={() => setImporting(false)}
                        saved={async () => {
                            await refresh();
                            setPage(0);
                            setMessage("Trainers imported successfully.");
                        }}
                    />
                )}

                {detail && (
                    <Dialog open onOpenChange={open => { if (!open) setDetail(undefined); }}>
                        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Trainer Details — {detail.trainerCode}</DialogTitle>
                                <DialogDescription className="text-xs">
                                    Approved internal trainer profile and assigned teaching topics.
                                </DialogDescription>
                            </DialogHeader>
                            <dl className="divide-y rounded-lg border text-sm">
                                {[
                                    ["Full Name", detail.fullName],
                                    ["Work Email", detail.email],
                                    ["Specialization", detail.specialization || "—"],
                                    ["Status", detail.status],
                                    ["Teaching Topics", detail.teachingTopics.map(t => `${t.code}@${t.version} — ${t.name}`).join("; ") || "—"],
                                ].map(([label, value]) => (
                                    <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 p-2.5">
                                        <dt className="font-semibold text-muted-foreground">{label}</dt>
                                        <dd className="break-words">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            <DialogFooter>
                                <Button onClick={() => setDetail(undefined)}>Close Details</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}

                {deleting && (
                    <Dialog open onOpenChange={open => { if (!open && !busy) setDeleting(undefined); }}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Archive Trainer {deleting.trainerCode}?</DialogTitle>
                                <DialogDescription className="text-xs">
                                    This preserves the identity. Trainers referenced by classes or teaching assignments cannot be archived.
                                </DialogDescription>
                            </DialogHeader>
                            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                            <DialogFooter>
                                <Button variant="outline" disabled={busy} onClick={() => setDeleting(undefined)}>
                                    Cancel
                                </Button>
                                <Button disabled={busy} onClick={() => void action(() => trainerApi.delete(deleting.id), "Trainer archived.")}>
                                    Confirm Archive
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </MainLayout>
    );
}
