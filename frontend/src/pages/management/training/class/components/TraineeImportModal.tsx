import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { classEnrollmentApi, classEnrollmentKey, type TraineeImportPreview, type TraineeImportRow } from "@/api/features/class-enrollment.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { describeApiError } from "@/utils/api-error.utils";
import { MAX_TRAINEE_FILE_BYTES, parseTraineeWorkbook, readTraineeFile, traineeTemplate, type TraineeImportIssue } from "@/utils/trainee-import.utils";
import { classReadinessKey } from "@/hooks/useClassInsights";

export function TraineeImportModal({ classId, open, onOpenChange }: { classId: number; open: boolean; onOpenChange: (open: boolean) => void }) {
    const client = useQueryClient();
    const [file, setFile] = useState<File>();
    const [rows, setRows] = useState<TraineeImportRow[]>([]);
    const [issues, setIssues] = useState<TraineeImportIssue[]>([]);
    const [preview, setPreview] = useState<TraineeImportPreview>();
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const reset = () => { setRows([]); setIssues([]); setPreview(undefined); setError(""); };
    const validate = async () => {
        if (!file || pending.current) return;
        pending.current = true; setBusy(true); reset();
        try {
            if (!/\.xlsx$/i.test(file.name) || file.size > MAX_TRAINEE_FILE_BYTES || file.size === 0) throw new Error("Choose a non-empty .xlsx file up to 2 MB.");
            const buffer = await readTraineeFile(file);
            const signature = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
            if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 3 || signature[3] !== 4) throw new Error("The file is not a valid XLSX workbook.");
            const parsed = parseTraineeWorkbook(XLSX.read(buffer, { type: "array" }));
            setRows(parsed.rows); setIssues(parsed.issues);
            if (!parsed.issues.length) setPreview(await classEnrollmentApi.preview(classId, parsed.rows));
        } catch (err) { setError(err instanceof Error && !('response' in err) ? err.message : describeApiError(err, "Could not validate the workbook.").message); }
        finally { pending.current = false; setBusy(false); }
    };
    const confirm = async () => {
        if (!preview?.canImport || issues.length || pending.current) return;
        pending.current = true; setBusy(true); setError("");
        try {
            const result = await classEnrollmentApi.import(classId, rows);
            await Promise.all([
                client.invalidateQueries({ queryKey: classEnrollmentKey(classId) }),
                client.invalidateQueries({ queryKey: ["classes"] }),
                client.invalidateQueries({ queryKey: classReadinessKey(classId) }),
            ]);
            toast.success(`Imported ${result.importedCount} trainees successfully.`);
            onOpenChange(false);
        } catch (err) {
            const failure = describeApiError(err, "Import failed; no trainees were saved.");
            setError(failure.message); setPreview(undefined);
            setIssues(Object.entries(failure.fieldErrors).flatMap(([path, messages]) => {
                const match = path.match(/^rows\[(\d+)\]\.(.+)$/);
                return messages.map(message => ({ rowNumber: match ? Number(match[1]) : undefined, field: match?.[2] ?? path, message }));
            }));
        } finally { pending.current = false; setBusy(false); }
    };
    const localInvalid = new Set(issues.filter(i => i.rowNumber).map(i => i.rowNumber));
    const localDuplicates = new Set(issues.filter(i => i.message.includes("Duplicate")).map(i => i.rowNumber));
    return <Dialog open={open} onOpenChange={value => { if (!pending.current) onOpenChange(value); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
            <DialogHeader><DialogTitle>Import Trainees from Excel</DialogTitle>
                <DialogDescription>Existing master students only. Preview does not save. Confirm imports every row atomically; personal profiles and planned capacity are unchanged.</DialogDescription></DialogHeader>
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><h3 className="text-sm font-semibold">1. Download Template</h3>
                    <p className="text-xs text-muted-foreground">Student ID and Full Name are required. Other columns are optional. Leave National ID blank without USER_READ permission.</p></div>
                    <Button variant="outline" onClick={() => XLSX.writeFile(traineeTemplate(), "Trainee_Import_Template.xlsx")}>Download Template</Button></div>
                <div className="space-y-2"><Label htmlFor="trainee-excel-file">2. Select Excel file (.xlsx, up to 2 MB / 500 rows)</Label>
                    <Input id="trainee-excel-file" type="file" accept=".xlsx" disabled={busy} onChange={event => { reset(); setFile(event.target.files?.[0]); }} />
                    <Button variant="outline" disabled={!file || busy} onClick={() => void validate()}>3. Preview &amp; Validate</Button></div>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {issues.filter(i => !i.rowNumber).map((issue, index) => <p role="alert" key={index} className="text-sm text-destructive">{issue.message}</p>)}
                {!!rows.length && <>
                    <p className="text-sm" aria-live="polite">Total Rows: {rows.length} · Valid Rows: {preview?.validRows ?? rows.length - localInvalid.size} · Invalid Rows: {preview?.invalidRows ?? localInvalid.size} · Duplicate Rows: {preview?.duplicateRows ?? localDuplicates.size}</p>
                    {!preview && !issues.length && <p className="text-sm text-muted-foreground">Server verification is required before import.</p>}
                    <div className="max-h-80 overflow-auto rounded-md border"><Table aria-label="Trainee import preview"><TableHeader><TableRow>
                        {["Row", "Validation Status", "Full Name", "Student ID", "Email", "DOB", "Gender", "Error Details"].map(header => <TableHead key={header}>{header}</TableHead>)}
                    </TableRow></TableHeader><TableBody>{rows.map(row => {
                        const server = preview?.rows.find(r => r.rowNumber === row.rowNumber);
                        const errors = [...issues.filter(i => i.rowNumber === row.rowNumber).map(i => `${i.field}: ${i.message}`),
                            ...Object.entries(server?.errors ?? {}).flatMap(([field, messages]) => messages.map(message => `${field}: ${message}`))];
                        return <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell><TableCell>{errors.length ? "Invalid" : server?.valid ? "Valid" : "Unverified"}</TableCell>
                            <TableCell>{row.fullName}</TableCell><TableCell>{row.studentId}</TableCell><TableCell>{row.personalEmail}</TableCell><TableCell>{row.dob}</TableCell><TableCell>{row.gender}</TableCell>
                            <TableCell className="min-w-48 text-destructive">{errors.join("; ")}</TableCell></TableRow>;
                    })}</TableBody></Table></div>
                </>}
                {busy && <p role="status">Validating or importing trainees…</p>}
            </div>
            <DialogFooter><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button disabled={!preview?.canImport || issues.length > 0 || busy} onClick={() => void confirm()}>4. Confirm Import</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}
