import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { trainerApi, type TrainerPreview } from "@/api/features/trainer.api";
import { describeApiError } from "@/utils/api-error.utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from "@/components/ui/table";

export function TrainerImportModal({ close, saved }: { close: () => void; saved: () => Promise<void> }) {
    const [file, setFile] = useState<File>();
    const [preview, setPreview] = useState<TrainerPreview>();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const showError = (err: unknown) => {
        const info = describeApiError(err);
        setError([
            info.message,
            ...Object.entries(info.fieldErrors).map(([key, values]) => `${key}: ${values.join(", ")}`),
        ].join(" "));
    };

    const download = async () => {
        setBusy(true);
        setError("");
        try {
            const blob = await trainerApi.template();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "Trainer_Import_Template.xlsx";
            link.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            showError(err);
        } finally {
            setBusy(false);
        }
    };

    const select = async (next?: File) => {
        setFile(next);
        setPreview(undefined);
        setError("");
        if (!next) return;
        setBusy(true);
        try {
            setPreview(await trainerApi.preview(next));
        } catch (err) {
            showError(err);
        } finally {
            setBusy(false);
        }
    };

    const downloadErrorReport = () => {
        if (!preview) return;
        const invalidRows = preview.rows.filter(row => !row.valid);
        if (!invalidRows.length) return;
        const rows = invalidRows.map(row => ({
            "Row": row.rowNumber,
            "Trainer ID*": row.cells[0] ?? "",
            "Full Name*": row.cells[1] ?? "",
            "Work Email*": row.cells[2] ?? "",
            "Specialization": row.cells[3] ?? "",
            "Teaching Topics": row.cells[4] ?? "",
            "Status": row.cells[5] ?? "",
            "Errors": row.errors.join("; "),
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [{ wch: 8 }, { wch: 16 }, { wch: 24 }, { wch: 30 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 44 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Import Errors");
        const today = new Date().toISOString().split("T")[0];
        XLSX.writeFile(wb, `Trainer_Import_Errors_${today}.xlsx`);
    };

    const commit = async () => {
        if (!file || !preview?.canImport || busy) return;
        setBusy(true);
        setError("");
        try {
            await trainerApi.import(file);
            await saved();
            close();
        } catch (err) {
            showError(err);
            setPreview(undefined);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
                <DialogHeader>
                    <DialogTitle>Import Trainers</DialogTitle>
                    <DialogDescription className="text-xs">
                        Code is the unique trainer code (template column "Trainer ID*"). Subjects use CODE@version separated by semicolons. Blank Status defaults to ACTIVE.
                    </DialogDescription>
                </DialogHeader>

                {/* Step 1: Compact template download bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">Step 1: Prepare your Excel file</p>
                            <p className="text-[11px] text-muted-foreground">Download the standard template with required column headers.</p>
                        </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => void download()} disabled={busy}>
                        <Download className="h-3.5 w-3.5" />
                        Download Template
                    </Button>
                </div>

                {/* Step 2: Prominent file upload dropzone */}
                <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">Step 2: Upload Trainer Excel</p>
                    <label
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                            busy
                                ? "cursor-not-allowed border-muted bg-muted/20 opacity-60"
                                : "cursor-pointer border-muted-foreground/30 bg-background hover:border-primary/60 hover:bg-primary/[0.02]"
                        }`}
                    >
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Upload className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-foreground">
                            {file ? file.name : "Click to choose an Excel file (.xlsx, .xls)"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {file
                                ? `${(file.size / 1024).toFixed(1)} KB — click again to choose a different file`
                                : "Maximum 5 MB, up to 500 rows. File will be validated before importing."}
                        </span>
                        <input
                            aria-label="Upload Trainer Excel"
                            type="file"
                            accept=".xlsx,.xls"
                            disabled={busy}
                            className="sr-only"
                            onChange={e => void select(e.target.files?.[0])}
                        />
                    </label>
                </div>

                {busy && (
                    <p role="status" className="text-xs font-medium text-muted-foreground">
                        Processing Trainer file…
                    </p>
                )}

                {error && (
                    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {error}
                    </p>
                )}

                {preview && (
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p
                                role="status"
                                className={`text-xs font-medium ${preview.canImport ? "text-emerald-700" : "text-amber-700"}`}
                            >
                                {preview.validRows}/{preview.totalRows} valid rows. All rows must be valid before import.
                            </p>
                            {!preview.canImport && preview.rows.some(row => !row.valid) && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive"
                                    onClick={downloadErrorReport}
                                    disabled={busy}
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download Error Report
                                </Button>
                            )}
                        </div>
                        <div className="overflow-auto max-h-72 rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        {["Row", "Code", "Full Name", "Work Email", "Specialization", "Subjects", "Status", "Validation"].map(h => (
                                            <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {preview.rows.map(row => (
                                        <TableRow key={row.rowNumber}>
                                            <TableCell className="text-xs">{row.rowNumber}</TableCell>
                                            {row.cells.map((cell, index) => (
                                                <TableCell key={index} className="text-xs">{cell}</TableCell>
                                            ))}
                                            <TableCell className={`text-xs font-medium ${row.valid ? "text-emerald-700" : "text-destructive"}`}>
                                                {row.valid ? "Valid" : row.errors.join("; ")}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}

                <DialogFooter className="border-t pt-3 gap-2">
                    <Button type="button" variant="outline" onClick={close} disabled={busy}>
                        Close
                    </Button>
                    <Button type="button" onClick={() => void commit()} disabled={busy || !preview?.canImport}>
                        Import All Trainers
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
