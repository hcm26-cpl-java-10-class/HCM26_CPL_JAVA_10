import { useState } from "react";
import { trainerApi, type TrainerPreview } from "@/api/features/trainer.api";
import { describeApiError } from "@/utils/api-error.utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";

export function TrainerImportModal({ close, saved }: { close: () => void; saved: () => Promise<void> }) {
    const [file, setFile] = useState<File>(); const [preview, setPreview] = useState<TrainerPreview>();
    const [busy, setBusy] = useState(false); const [error, setError] = useState("");
    const showError = (err: unknown) => { const info = describeApiError(err); setError([info.message,
        ...Object.entries(info.fieldErrors).map(([key, values]) => `${key}: ${values.join(", ")}`)].join(" ")); };
    const download = async () => {
        setBusy(true); setError("");
        try { const blob = await trainerApi.template(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
            link.href = url; link.download = "Trainer_Import_Template.xlsx"; link.click(); URL.revokeObjectURL(url);
        } catch (err) { showError(err); } finally { setBusy(false); }
    };
    const select = async (next?: File) => {
        setFile(next); setPreview(undefined); setError(""); if (!next) return;
        setBusy(true); try { setPreview(await trainerApi.preview(next)); } catch (err) { showError(err); } finally { setBusy(false); }
    };
    const commit = async () => {
        if (!file || !preview?.canImport || busy) return;
        setBusy(true); setError("");
        try { await trainerApi.import(file); await saved(); close(); }
        catch (err) { showError(err); setPreview(undefined); } finally { setBusy(false); }
    };
    return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}><DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Import Trainers</DialogTitle></DialogHeader>
        <p className="text-sm">Trainer ID is the unique trainer code, not a database ID. Teaching Topics use CODE@version separated by semicolons. Blank Status defaults to ACTIVE.</p>
        <Button variant="outline" onClick={() => void download()} disabled={busy}>Download Template</Button>
        <label className="space-y-1 text-sm">Upload Trainer Excel (.xlsx, .xls; maximum 5 MB, 500 rows)
            <input aria-label="Upload Trainer Excel" type="file" accept=".xlsx,.xls" disabled={busy} onChange={e => void select(e.target.files?.[0])} /></label>
        {busy && <p role="status">Processing Trainer file…</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {preview && <><p role="status">{preview.validRows}/{preview.totalRows} valid rows. All rows must be valid before import.</p>
            <div className="overflow-auto max-h-80"><Table><TableHeader><TableRow>{["Row", "Trainer ID", "Full Name", "Work Email", "Specialization", "Teaching Topics", "Status", "Validation"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{preview.rows.map(row => <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell>{row.cells.map((cell, index) => <TableCell key={index}>{cell}</TableCell>)}
                    <TableCell className={row.valid ? "text-green-700" : "text-red-700"}>{row.valid ? "Valid" : row.errors.join("; ")}</TableCell></TableRow>)}</TableBody></Table></div></>}
        <DialogFooter><Button variant="outline" onClick={close} disabled={busy}>Close</Button><Button onClick={() => void commit()} disabled={busy || !preview?.canImport}>Import All Trainers</Button></DialogFooter>
    </DialogContent></Dialog>;
}
