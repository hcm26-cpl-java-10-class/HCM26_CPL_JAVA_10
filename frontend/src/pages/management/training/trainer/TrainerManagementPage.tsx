import { useState } from "react";
import { Archive, Eye, MoreHorizontal, Pencil, Plus, Power, Search, Upload, Users } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
    return <MainLayout><div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div className="flex items-start gap-3">
            <div className="rounded-xl border bg-primary/5 p-3 text-primary"><Users className="size-6" aria-hidden="true" /></div>
            <div><h1 className="text-2xl font-bold tracking-tight">Trainer Management</h1>
                <p className="mt-1 text-sm text-muted-foreground">Manage the approved internal trainer directory.</p></div></div>
            {hasPermission("TRAINER_CREATE") && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setImporting(true)}><Upload className="size-4" aria-hidden="true" />Import Trainers</Button><Button onClick={() => setEdit(null)}><Plus className="size-4" aria-hidden="true" />Add Trainer</Button></div>}</div>
        {!hasPermission("TRAINER_READ") ? <ApiErrorState kind="forbidden" error={undefined} resource="trainers" /> : <>
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1"><label htmlFor="trainer-search" className="mb-2 block text-sm font-medium">Search trainers</label>
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Input id="trainer-search" className="pl-9" aria-label="Search Trainers" placeholder="Code, name, email or specialization" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} maxLength={150} /></div></div>
                <div className="w-full sm:w-44"><label htmlFor="trainer-status" className="mb-2 block text-sm font-medium">Status</label>
                    <NativeSelect id="trainer-status" className="w-full" aria-label="Filter Trainer Status" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="all">All statuses</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></NativeSelect></div></div>
            {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>}{error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
            {list.isPending ? <p role="status">Loading trainers…</p> : list.isError ? <ApiErrorState error={list.error} resource="trainers" onRetry={() => void list.refetch()} /> : <>
                <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b px-4 py-4"><h2 className="font-semibold">Trainer directory</h2><Badge variant="secondary">{list.data.totalElements} trainers</Badge></div>
                    <Table className="min-w-[660px] table-fixed" aria-label="Trainer directory">
                        <colgroup><col className="w-[14%]" /><col className="w-[21%]" /><col className="w-[27%]" /><col className="w-[16%]" /><col className="w-[12%]" /><col className="w-[10%]" /></colgroup>
                        <TableHeader className="bg-muted/40"><TableRow>{["Trainer ID", "Full Name", "Work Email", "Specialization", "Status", "Actions"].map(h => <TableHead scope="col" className={`px-3 text-xs font-semibold ${h === "Actions" ? "text-right" : ""}`} key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                        <TableBody>{list.data.content.map(t => <TableRow key={t.id}>
                            <TableCell className="whitespace-normal break-words px-3 py-4 font-mono text-xs font-medium">{t.trainerCode}</TableCell>
                            <TableCell className="whitespace-normal break-words px-3 py-4 font-medium">{t.fullName}</TableCell>
                            <TableCell className="whitespace-normal break-all px-3 py-4 text-muted-foreground" title={t.email}>{t.email}</TableCell>
                            <TableCell className="whitespace-normal break-words px-3 py-4 text-muted-foreground">{t.specialization || "—"}</TableCell>
                            <TableCell className="px-3 py-4"><Badge variant="outline" className={t.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground"}>{t.status}</Badge></TableCell>
                            <TableCell className="px-3 py-4 text-right"><DropdownMenu><DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-9 rounded-lg focus-visible:ring-2" disabled={busy} aria-label={`Actions for ${t.trainerCode}`}><MoreHorizontal className="size-5" aria-hidden="true" /></Button>
                            </DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel className="break-all text-xs text-muted-foreground">{t.trainerCode}</DropdownMenuLabel><DropdownMenuSeparator />
                                <DropdownMenuItem disabled={busy} aria-label={`View ${t.trainerCode}`} onSelect={() => void action(async () => setDetail(await trainerApi.get(t.id)), "")}><Eye aria-hidden="true" />View</DropdownMenuItem>
                                {hasPermission("TRAINER_UPDATE") && <><DropdownMenuItem disabled={busy} aria-label={`Edit ${t.trainerCode}`} onSelect={() => void action(async () => setEdit(await trainerApi.get(t.id)), "")}><Pencil aria-hidden="true" />Edit</DropdownMenuItem>
                                    <DropdownMenuItem disabled={busy} aria-label={`${t.status === "ACTIVE" ? "Deactivate" : "Activate"} ${t.trainerCode}`} onSelect={() => void action(() => trainerApi.status(t.id, t.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"), "Trainer status updated.")}><Power aria-hidden="true" />{t.status === "ACTIVE" ? "Deactivate" : "Activate"}</DropdownMenuItem></>}
                                {hasPermission("TRAINER_DELETE") && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" disabled={busy} aria-label={`Archive ${t.trainerCode}`} onSelect={() => { setError(""); setDeleting(t); }}><Archive aria-hidden="true" />Archive</DropdownMenuItem></>}
                            </DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}
                            {!list.data.content.length && <TableRow><TableCell colSpan={6} className="h-40 whitespace-normal text-center text-muted-foreground">No trainers match the current filters.</TableCell></TableRow>}</TableBody></Table>
                    <div className="flex flex-col gap-3 border-t px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-muted-foreground">{list.data.totalElements} trainers · Page {page + 1} / {Math.max(1, list.data.totalPages)}</span>
                        <nav aria-label="Trainer pagination" className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page + 1 >= list.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button></nav></div></div></>}
        </>}
        {edit !== undefined && <TrainerForm key={edit?.id ?? "new"} trainer={edit ?? undefined} close={() => setEdit(undefined)} saved={async () => { await refresh(); setMessage("Trainer saved."); }} />}
        {importing && <TrainerImportModal close={() => setImporting(false)} saved={async () => { await refresh(); setPage(0); setMessage("Trainers imported successfully."); }} />}
        {detail && <Dialog open onOpenChange={open => { if (!open) setDetail(undefined); }}><DialogContent><DialogHeader><DialogTitle>Trainer Details — {detail.trainerCode}</DialogTitle></DialogHeader>
            <dl className="space-y-3 text-sm">{[["Full Name", detail.fullName], ["Work Email", detail.email], ["Specialization", detail.specialization || "—"], ["Status", detail.status], ["Teaching Topics", detail.teachingTopics.map(t => `${t.code}@${t.version} — ${t.name}`).join("; ") || "—"]].map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="break-words text-muted-foreground">{value}</dd></div>)}</dl>
            <DialogFooter><Button onClick={() => setDetail(undefined)}>Close Details</Button></DialogFooter></DialogContent></Dialog>}
        {deleting && <Dialog open onOpenChange={open => { if (!open && !busy) setDeleting(undefined); }}><DialogContent><DialogHeader><DialogTitle>Archive Trainer {deleting.trainerCode}?</DialogTitle></DialogHeader>
            <p>This preserves the identity. Trainers referenced by classes or teaching assignments cannot be archived.</p>{error && <p role="alert">{error}</p>}
            <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDeleting(undefined)}>Cancel</Button><Button disabled={busy} onClick={() => void action(() => trainerApi.delete(deleting.id), "Trainer archived.")}>Confirm Archive</Button></DialogFooter></DialogContent></Dialog>}
    </div></MainLayout>;
}
