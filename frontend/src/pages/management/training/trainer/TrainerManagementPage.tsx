import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { trainerApi, type Trainer } from "@/api/features/trainer.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/common/NativeSelect";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { describeApiError } from "@/utils/api-error.utils";
import { TrainerForm } from "./TrainerForm";
import { TrainerImportModal } from "./TrainerImportModal";

export default function TrainerManagementPage() {
    const { hasPermission } = usePermissions(); const client = useQueryClient();
    const [search, setSearch] = useState(""); const [status, setStatus] = useState("all"); const [page, setPage] = useState(0);
    const [edit, setEdit] = useState<Trainer | null | undefined>(); const [detail, setDetail] = useState<Trainer>();
    const [deleting, setDeleting] = useState<Trainer>(); const [importing, setImporting] = useState(false);
    const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
    const list = useQuery({ queryKey: ["trainers", "list", search, status, page], queryFn: () => trainerApi.list({ search, status, page, size: 20 }),
        enabled: hasPermission("TRAINER_READ"), retry: false });
    const refresh = async () => {
        await Promise.all([client.invalidateQueries({ queryKey: ["trainers"] }), client.invalidateQueries({ queryKey: ["class-setup", "verified-trainers"] }),
            client.invalidateQueries({ queryKey: ["classes"] })]);
    };
    const action = async (operation: () => Promise<unknown>, success: string) => {
        setBusy(true); setError(""); setMessage("");
        try { await operation(); await refresh(); setMessage(success); setDeleting(undefined); }
        catch (err) { setError(describeApiError(err).message); } finally { setBusy(false); }
    };
    return <MainLayout><div className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Trainer Management</h1>
            <p className="text-sm text-muted-foreground">Manage the approved internal trainer directory.</p></div>
            {hasPermission("TRAINER_CREATE") && <div className="flex gap-2"><Button variant="outline" onClick={() => setImporting(true)}>Import Trainers</Button><Button onClick={() => setEdit(null)}>Add Trainer</Button></div>}</div>
        {!hasPermission("TRAINER_READ") ? <ApiErrorState kind="forbidden" error={undefined} resource="trainers" /> : <>
            <div className="flex gap-3"><Input aria-label="Search Trainers" placeholder="Search code, name, email or specialization" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} maxLength={150} />
                <NativeSelect aria-label="Filter Trainer Status" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="all">All statuses</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></NativeSelect></div>
            {message && <p role="status">{message}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}
            {list.isPending ? <p role="status">Loading trainers…</p> : list.isError ? <ApiErrorState error={list.error} resource="trainers" onRetry={() => void list.refetch()} /> : <>
                <div className="rounded-lg border overflow-auto"><Table><TableHeader><TableRow>{["Trainer ID", "Full Name", "Work Email", "Specialization", "Status", "Actions"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>{list.data.content.map(t => <TableRow key={t.id}><TableCell>{t.trainerCode}</TableCell><TableCell>{t.fullName}</TableCell><TableCell>{t.email}</TableCell><TableCell>{t.specialization || "—"}</TableCell><TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                        <TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={busy} onClick={() => void action(async () => setDetail(await trainerApi.get(t.id)), "")}>View {t.trainerCode}</Button>
                            {hasPermission("TRAINER_UPDATE") && <><Button variant="ghost" size="sm" disabled={busy} onClick={() => void action(async () => setEdit(await trainerApi.get(t.id)), "")}>Edit {t.trainerCode}</Button>
                                <Button variant="outline" size="sm" disabled={busy} onClick={() => void action(() => trainerApi.status(t.id, t.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), "Trainer status updated.")}>{t.status === "ACTIVE" ? "Deactivate" : "Activate"} {t.trainerCode}</Button></>}
                            {hasPermission("TRAINER_DELETE") && <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setError(""); setDeleting(t); }}>Archive {t.trainerCode}</Button>}</div></TableCell></TableRow>)}
                        {!list.data.content.length && <TableRow><TableCell colSpan={6}>No trainers match the current filters.</TableCell></TableRow>}</TableBody></Table></div>
                <div className="flex items-center gap-3 text-sm"><span>{list.data.totalElements} trainers · Page {page + 1} / {Math.max(1, list.data.totalPages)}</span>
                    <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" disabled={page + 1 >= list.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></>}
        </>}
        {edit !== undefined && <TrainerForm key={edit?.id ?? "new"} trainer={edit ?? undefined} close={() => setEdit(undefined)} saved={async () => { await refresh(); setMessage("Trainer saved."); }} />}
        {importing && <TrainerImportModal close={() => setImporting(false)} saved={async () => { await refresh(); setPage(0); setMessage("Trainers imported successfully."); }} />}
        {detail && <Dialog open onOpenChange={open => { if (!open) setDetail(undefined); }}><DialogContent><DialogHeader><DialogTitle>Trainer Details — {detail.trainerCode}</DialogTitle></DialogHeader>
            <dl className="space-y-2 text-sm">{[["Full Name", detail.fullName], ["Work Email", detail.email], ["Specialization", detail.specialization || "—"], ["Status", detail.status], ["Teaching Topics", detail.teachingTopics.map(t => `${t.code}@${t.version} — ${t.name}`).join("; ") || "—"]].map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd>{value}</dd></div>)}</dl>
            <DialogFooter><Button onClick={() => setDetail(undefined)}>Close Details</Button></DialogFooter></DialogContent></Dialog>}
        {deleting && <Dialog open onOpenChange={open => { if (!open && !busy) setDeleting(undefined); }}><DialogContent><DialogHeader><DialogTitle>Archive Trainer {deleting.trainerCode}?</DialogTitle></DialogHeader>
            <p>This preserves the identity. Trainers referenced by classes or teaching assignments cannot be archived.</p>{error && <p role="alert">{error}</p>}
            <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleting(undefined)}>Cancel</Button><Button disabled={busy} onClick={() => void action(() => trainerApi.delete(deleting.id), "Trainer archived.")}>Confirm Archive</Button></DialogFooter></DialogContent></Dialog>}
    </div></MainLayout>;
}
