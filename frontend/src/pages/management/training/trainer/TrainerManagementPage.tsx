import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Archive, Download, Eye, Pencil, Plus, Power, Upload } from "lucide-react";
import { trainerApi, type Trainer } from "@/api/features/trainer.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/common/NativeSelect";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
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
    const [topicId, setTopicId] = useState("");
    const [page, setPage] = useState(0);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [edit, setEdit] = useState<Trainer | null | undefined>();
    const [detail, setDetail] = useState<Trainer>();
    const [deleting, setDeleting] = useState<Trainer>();
    const [importing, setImporting] = useState(false);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const canUpdate = hasPermission("TRAINER_UPDATE");

    const topics = useQuery({
        queryKey: ["trainers", "topics"],
        queryFn: trainerApi.topics,
        enabled: hasPermission("TRAINER_READ"),
        retry: false,
    });

    const listParams = {
        search,
        status,
        ...(topicId ? { topicId: Number(topicId) } : {}),
        page,
        size: 20,
    };

    const list = useQuery({
        queryKey: ["trainers", "list", search, status, topicId, page],
        queryFn: () => trainerApi.list(listParams),
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

    const visibleIds = list.data?.content.map(t => t.id) ?? [];
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

    const toggleSelectAll = () => {
        if (allVisibleSelected) {
            setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
    };

    const toggleSelectOne = (id: number) => {
        setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
    };

    const refresh = async () => {
        await Promise.all([
            client.invalidateQueries({ queryKey: ["trainers"] }),
            client.invalidateQueries({ queryKey: ["class-setup", "verified-trainers"] }),
            client.invalidateQueries({ queryKey: ["classes"] }),
        ]);
    };

    const handleExportExcel = async () => {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            const exportFilter = { search, status, ...(topicId ? { topicId: Number(topicId) } : {}), size: 100 };
            const first = await trainerApi.list({ ...exportFilter, page: 0 });
            const allRows: Trainer[] = [...first.content];
            for (let p = 1; p < first.totalPages; p += 1) {
                const next = await trainerApi.list({ ...exportFilter, page: p });
                allRows.push(...next.content);
            }
            const exportRows = allRows.map(t => ({
                "Trainer ID*": t.trainerCode,
                "Full Name*": t.fullName,
                "Work Email*": t.email,
                "Specialization": t.specialization ?? "",
                "Teaching Topics": t.teachingTopics.map(topic => `${topic.code}@${topic.version}`).join(";"),
                "Status": t.status,
            }));
            const ws = XLSX.utils.json_to_sheet(exportRows);
            ws["!cols"] = [{ wch: 16 }, { wch: 24 }, { wch: 32 }, { wch: 24 }, { wch: 32 }, { wch: 12 }];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Trainers");
            const today = new Date().toISOString().split("T")[0];
            XLSX.writeFile(wb, `Trainers_${today}.xlsx`);
            setMessage(`Exported ${allRows.length} trainers to Excel.`);
        } catch (err) {
            setError(describeApiError(err).message);
        } finally {
            setBusy(false);
        }
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
        <MainLayout dense mainClassName="overflow-y-hidden">
            <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 pt-1 pb-2">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Trainer Management</h1>
                        <p className="text-sm text-muted-foreground">Manage the approved internal trainer directory.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasPermission("TRAINER_READ") && (
                            <Button
                                variant="outline"
                                className="gap-1.5"
                                disabled={busy || !list.data?.totalElements}
                                title="Export trainers to Excel"
                                onClick={() => void handleExportExcel()}
                            >
                                <Download className="h-4 w-4 text-emerald-600" />
                                Export
                            </Button>
                        )}
                        {hasPermission("TRAINER_CREATE") && (
                            <>
                                <Button
                                    variant="outline"
                                    className="gap-1.5"
                                    disabled={busy}
                                    title="Import trainers from Excel"
                                    onClick={() => setImporting(true)}
                                >
                                    <Upload className="h-4 w-4 text-blue-600" />
                                    Import
                                </Button>
                                <Button className="gap-1.5" disabled={busy} onClick={() => setEdit(null)}>
                                    <Plus className="h-4 w-4" />
                                    Add Trainer
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {!hasPermission("TRAINER_READ") ? (
                    <ApiErrorState kind="forbidden" error={undefined} resource="trainers" />
                ) : (
                    <>
                        <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(220px,1fr)_220px_160px]">
                            <Input
                                aria-label="Search Trainers"
                                placeholder="Search code, name, email or specialization"
                                value={search}
                                onChange={e => {
                                    setSearch(e.target.value);
                                    setPage(0);
                                    setSelectedIds([]);
                                }}
                                maxLength={150}
                            />
                            <NativeSelect
                                aria-label="Filter Trainer Subject"
                                value={topicId}
                                onChange={e => {
                                    setTopicId(e.target.value);
                                    setPage(0);
                                    setSelectedIds([]);
                                }}
                            >
                                <option value="">All subjects</option>
                                {(topics.data ?? []).map(topic => (
                                    <option key={topic.id} value={String(topic.id)}>
                                        {topic.code}@{topic.version} — {topic.name}
                                    </option>
                                ))}
                            </NativeSelect>
                            <NativeSelect
                                aria-label="Filter Trainer Status"
                                value={status}
                                onChange={e => {
                                    setStatus(e.target.value);
                                    setPage(0);
                                    setSelectedIds([]);
                                }}
                            >
                                <option value="all">All statuses</option>
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="INACTIVE">INACTIVE</option>
                            </NativeSelect>
                        </div>

                        {canUpdate && selectedIds.length > 0 && (
                            <div
                                role="region"
                                aria-label="Bulk trainer actions"
                                className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm"
                            >
                                <span className="font-medium text-foreground">
                                    {selectedIds.length} trainer{selectedIds.length > 1 ? "s" : ""} selected
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() =>
                                            void action(async () => {
                                                await trainerApi.bulkStatus(selectedIds, "ACTIVE");
                                                setSelectedIds([]);
                                            }, `Activated ${selectedIds.length} trainer(s).`)
                                        }
                                    >
                                        Activate Selected
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() =>
                                            void action(async () => {
                                                await trainerApi.bulkStatus(selectedIds, "INACTIVE");
                                                setSelectedIds([]);
                                            }, `Deactivated ${selectedIds.length} trainer(s).`)
                                        }
                                    >
                                        Deactivate Selected
                                    </Button>
                                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelectedIds([])}>
                                        Clear
                                    </Button>
                                </div>
                            </div>
                        )}

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
                                <div className="flex-1 min-h-0 w-full min-w-0 rounded-xl border bg-card shadow-xs overflow-y-auto overflow-x-auto">
                                    <table data-slot="table" aria-label="Trainer directory" className="w-full table-fixed caption-bottom text-sm">
                                        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs">
                                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                                                {canUpdate && (
                                                    <TableHead className="w-8 pl-2.5 pr-1">
                                                        <input
                                                            type="checkbox"
                                                            aria-label="Select all trainers on this page"
                                                            className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer align-middle"
                                                            checked={allVisibleSelected}
                                                            disabled={busy || visibleIds.length === 0}
                                                            onChange={toggleSelectAll}
                                                        />
                                                    </TableHead>
                                                )}
                                                <TableHead className="w-[84px] px-2">Code</TableHead>
                                                <TableHead className="w-[18%] px-2">Full Name</TableHead>
                                                <TableHead className="w-[23%] px-2">Work Email</TableHead>
                                                <TableHead className="px-2">Specialization</TableHead>
                                                <TableHead className="w-[108px] px-2">Workload</TableHead>
                                                <TableHead className="w-[82px] px-2">Status</TableHead>
                                                <TableHead className="w-[120px] pl-1 pr-2 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {list.data.content.map(t => {
                                                const weeklySessions = t.workload?.weeklySessions ?? 0;
                                                const activeClasses = t.workload?.activeClasses ?? 0;
                                                return (
                                                <TableRow key={t.id} className="hover:bg-muted/30">
                                                    {canUpdate && (
                                                        <TableCell className="pl-2.5 pr-1">
                                                            <input
                                                                type="checkbox"
                                                                aria-label={`Select ${t.trainerCode}`}
                                                                className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer align-middle"
                                                                checked={selectedIds.includes(t.id)}
                                                                disabled={busy}
                                                                onChange={() => toggleSelectOne(t.id)}
                                                            />
                                                        </TableCell>
                                                    )}
                                                    <TableCell className="px-2 font-mono text-xs font-semibold text-foreground truncate" title={t.trainerCode}>
                                                        {t.trainerCode}
                                                    </TableCell>
                                                    <TableCell className="px-2 truncate font-medium text-foreground" title={t.fullName}>
                                                        {t.fullName}
                                                    </TableCell>
                                                    <TableCell className="px-2 truncate text-muted-foreground" title={t.email}>
                                                        {t.email}
                                                    </TableCell>
                                                    <TableCell className="px-2 truncate text-muted-foreground" title={t.specialization || undefined}>
                                                        {t.specialization || "—"}
                                                    </TableCell>
                                                    <TableCell className="px-2 whitespace-nowrap">
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <Badge
                                                                variant="outline"
                                                                className={`px-1.5 py-0 text-[11px] ${
                                                                    weeklySessions >= 10
                                                                        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                                                        : weeklySessions > 0
                                                                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                                                            : "border-border bg-muted/50 text-muted-foreground"
                                                                }`}
                                                                title={`${weeklySessions} scheduled session(s) this week, ${activeClasses} assigned class(es)`}
                                                            >
                                                                {weeklySessions} / wk
                                                            </Badge>
                                                            {activeClasses > 0 && (
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    · {activeClasses} cls
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="px-2 whitespace-nowrap">
                                                        <Badge
                                                            variant="outline"
                                                            className={`px-1.5 py-0 text-[11px] ${
                                                                t.status === "ACTIVE"
                                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                                                    : "border-border bg-muted text-muted-foreground"
                                                            }`}
                                                        >
                                                            {t.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="pl-1 pr-2 whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-0">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-primary"
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
                                                                        className="h-7 w-7 text-muted-foreground hover:text-blue-600"
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
                                                                                ? "h-7 w-7 text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:hover:bg-amber-950/40"
                                                                                : "h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
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
                                                                    className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
                                                );
                                            })}
                                            {!list.data.content.length && (
                                                <TableRow>
                                                    <TableCell colSpan={canUpdate ? 8 : 7} className="py-8 text-center text-muted-foreground">
                                                        No trainers match the current filters.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </table>
                                </div>

                                <div className="flex shrink-0 flex-wrap items-center justify-start gap-4 text-sm text-muted-foreground">
                                    <nav aria-label="Trainer pagination" className="flex items-center gap-2">
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
                                    </nav>
                                    <span>
                                        {list.data.totalElements} trainers · Page {page + 1} / {Math.max(1, list.data.totalPages)}
                                    </span>
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

                {detail && (() => {
                    const taughtByKey = new Map<string, string[]>();
                    (detail.teachingHistory ?? []).forEach(item => {
                        const key = `${item.subjectCode}@${item.subjectVersion}`.toLowerCase();
                        const label = item.classCode || item.className || "Assigned";
                        const existing = taughtByKey.get(key) ?? [];
                        if (!existing.includes(label)) existing.push(label);
                        taughtByKey.set(key, existing);
                    });

                    const mergedSubjects: Array<{ key: string; label: string; classes: string[] }> = [];
                    const seen = new Set<string>();
                    detail.teachingTopics.forEach(t => {
                        const key = `${t.code}@${t.version}`.toLowerCase();
                        seen.add(key);
                        mergedSubjects.push({
                            key,
                            label: `${t.code}@${t.version} — ${t.name}`,
                            classes: taughtByKey.get(key) ?? [],
                        });
                    });
                    (detail.teachingHistory ?? []).forEach(item => {
                        const key = `${item.subjectCode}@${item.subjectVersion}`.toLowerCase();
                        if (!seen.has(key)) {
                            seen.add(key);
                            mergedSubjects.push({
                                key,
                                label: `${item.subjectCode}@${item.subjectVersion} — ${item.subjectName}`,
                                classes: taughtByKey.get(key) ?? [],
                            });
                        }
                    });

                    return (
                        <Dialog open onOpenChange={open => { if (!open) setDetail(undefined); }}>
                            <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Trainer Details — {detail.trainerCode}</DialogTitle>
                                    <DialogDescription className="text-xs">
                                        Approved internal trainer profile and teaching subjects.
                                    </DialogDescription>
                                </DialogHeader>
                                <dl className="divide-y rounded-lg border text-sm">
                                    {[
                                        ["Full Name", detail.fullName],
                                        ["Work Email", detail.email],
                                        ["Specialization", detail.specialization || "—"],
                                        ["Status", detail.status],
                                        [
                                            "Workload",
                                            `${detail.workload?.weeklySessions ?? 0} scheduled session(s) this week · ${detail.workload?.activeClasses ?? 0} assigned class(es)`,
                                        ],
                                    ].map(([label, value]) => (
                                        <div key={label} className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 p-2.5">
                                            <dt className="font-semibold text-muted-foreground">{label}</dt>
                                            <dd className="break-words">{value}</dd>
                                        </div>
                                    ))}

                                    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 p-2.5">
                                        <dt className="font-semibold text-muted-foreground">Subjects</dt>
                                        <dd>
                                            {mergedSubjects.length === 0 ? (
                                                <span className="text-muted-foreground">No subjects assigned.</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {mergedSubjects.map(subject => (
                                                        <Badge key={subject.key} variant="secondary" className="font-normal text-xs gap-1">
                                                            <span>{subject.label}</span>
                                                            {subject.classes.length > 0 && (
                                                                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                                                    · Taught ({subject.classes.join(", ")})
                                                                </span>
                                                            )}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </dd>
                                    </div>
                                </dl>
                                <DialogFooter>
                                    <Button onClick={() => setDetail(undefined)}>Close Details</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    );
                })()}

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
