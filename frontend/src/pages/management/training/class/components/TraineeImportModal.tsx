import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
    classEnrollmentApi,
    classEnrollmentKey,
    type TraineeImportPreview,
    type TraineeImportRow,
} from "@/api/features/class-enrollment.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { describeApiError } from "@/utils/api-error.utils";
import {
    MAX_TRAINEE_FILE_BYTES,
    parseTraineeWorkbook,
    readTraineeFile,
    traineeTemplate,
    type TraineeImportIssue,
} from "@/utils/trainee-import.utils";
import { classReadinessKey } from "@/hooks/useClassInsights";

export function TraineeImportModal({
    classId,
    open,
    onOpenChange,
}: {
    classId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const client = useQueryClient();
    const [file, setFile] = useState<File>();
    const [rows, setRows] = useState<TraineeImportRow[]>([]);
    const [issues, setIssues] = useState<TraineeImportIssue[]>([]);
    const [preview, setPreview] = useState<TraineeImportPreview>();
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setRows([]);
        setIssues([]);
        setPreview(undefined);
        setError("");
    };

    const validate = async () => {
        if (!file || pending.current) return;
        pending.current = true;
        setBusy(true);
        reset();
        try {
            if (!/\.xlsx$/i.test(file.name) || file.size > MAX_TRAINEE_FILE_BYTES || file.size === 0) {
                throw new Error("Choose a non-empty .xlsx file up to 2 MB.");
            }
            const buffer = await readTraineeFile(file);
            const signature = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
            if (
                signature[0] !== 0x50 ||
                signature[1] !== 0x4b ||
                signature[2] !== 3 ||
                signature[3] !== 4
            ) {
                throw new Error("The file is not a valid XLSX workbook.");
            }
            const parsed = parseTraineeWorkbook(XLSX.read(buffer, { type: "array" }));
            setRows(parsed.rows);
            setIssues(parsed.issues);
            if (!parsed.issues.length) {
                setPreview(await classEnrollmentApi.preview(classId, parsed.rows));
            }
        } catch (err) {
            setError(
                err instanceof Error && !("response" in err)
                    ? err.message
                    : describeApiError(err, "Could not validate the workbook.").message,
            );
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };

    const confirm = async () => {
        if (!preview?.canImport || issues.length || pending.current) return;
        pending.current = true;
        setBusy(true);
        setError("");
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
            setError(failure.message);
            setPreview(undefined);
            setIssues(
                Object.entries(failure.fieldErrors).flatMap(([path, messages]) => {
                    const match = path.match(/^rows\[(\d+)\]\.(.+)$/);
                    return messages.map((message) => ({
                        rowNumber: match ? Number(match[1]) : undefined,
                        field: match?.[2] ?? path,
                        message,
                    }));
                }),
            );
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };

    const localInvalid = new Set(issues.filter((i) => i.rowNumber).map((i) => i.rowNumber));
    const localDuplicates = new Set(
        issues.filter((i) => i.message.includes("Duplicate")).map((i) => i.rowNumber),
    );
    const validCount = preview?.validRows ?? rows.length - localInvalid.size;
    const invalidCount = preview?.invalidRows ?? localInvalid.size;
    const duplicateCount = preview?.duplicateRows ?? localDuplicates.size;

    return (
        <Dialog
            open={open}
            onOpenChange={(value) => {
                if (!pending.current) onOpenChange(value);
            }}
        >
            <DialogContent className="max-h-[90vh] w-[92vw] max-w-[1150px] grid-cols-1 overflow-x-hidden overflow-y-auto p-6 sm:max-w-[1150px]">
                <DialogHeader className="min-w-0 pr-8">
                    <DialogTitle>Import Trainees from Excel</DialogTitle>
                    <DialogDescription className="whitespace-normal break-words text-sm leading-relaxed">
                        Upload an Excel (.xlsx) file to validate and batch-import trainees into this class.
                        Strict All-or-Nothing strategy: all rows must be 100% valid before any changes are committed.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                        <div>
                            <h3 className="text-sm font-semibold">1. Download Template</h3>
                            <p className="text-xs text-muted-foreground">
                                Columns: Student ID*, Full Name*, Personal Email, DOB, Gender, Status.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => XLSX.writeFile(traineeTemplate(), "Trainee_Import_Template.xlsx")}
                        >
                            Download Template
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="trainee-excel-file">
                            2. Select Excel file (.xlsx, up to 2 MB / 500 rows)
                        </Label>
                        <input
                            ref={fileInputRef}
                            id="trainee-excel-file"
                            type="file"
                            accept=".xlsx"
                            className="sr-only"
                            disabled={busy}
                            onChange={(event) => {
                                reset();
                                setFile(event.target.files?.[0]);
                            }}
                        />
                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className="flex h-9 w-full max-w-md items-center gap-2.5 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => fileInputRef.current?.click()}
                                    className=" shrink-0 cursor-pointer rounded bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Choose File
                                </button>
                                <span className="truncate text-sm text-muted-foreground">
                                    {file ? file.name : "No file chosen"}
                                </span>
                            </div>
                            <Button
                                variant="outline"
                                disabled={!file || busy}
                                onClick={() => void validate()}
                            >
                                3. Preview &amp; Validate
                            </Button>
                        </div>
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        >
                            {error}
                        </p>
                    )}

                    {issues
                        .filter((i) => !i.rowNumber)
                        .map((issue, index) => (
                            <p
                                role="alert"
                                key={index}
                                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                            >
                                {issue.message}
                            </p>
                        ))}

                    {!!rows.length && (
                        <>
                            <div className="flex flex-wrap items-center gap-3 text-sm" aria-live="polite">
                                <span className="font-medium">
                                    Total Rows: {rows.length} · Valid Rows: {validCount} · Invalid Rows: {invalidCount} · Duplicate Rows: {duplicateCount}
                                </span>
                            </div>

                            {(issues.length > 0 || (preview && !preview.canImport)) && (
                                <div
                                    role="alert"
                                    className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
                                >
                                    <span className="font-semibold">All-or-Nothing Policy: </span>
                                    Import cannot proceed because one or more rows contain errors. Please fix all errors in the Excel file and upload again.
                                </div>
                            )}

                            {preview?.canImport && issues.length === 0 && (
                                <div
                                    role="status"
                                    className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300"
                                >
                                    <span className="font-semibold">Ready to Import: </span>
                                    All {rows.length} rows passed validation and are ready to be committed atomically.
                                </div>
                            )}

                            {!preview && !issues.length && (
                                <p className="text-sm text-muted-foreground">
                                    Server verification is required before import.
                                </p>
                            )}

                            <div className="max-h-[340px] w-full overflow-x-hidden overflow-y-auto rounded-md border">
                                <table
                                    aria-label="Trainee import preview"
                                    className="w-full table-fixed caption-bottom border-collapse text-xs"
                                >
                                    <TableHeader className="sticky top-0 z-10 bg-muted/95 shadow-[inset_0_-1px_0_var(--border)] backdrop-blur-xs">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="h-auto w-[48px] px-2 py-2.5 text-center font-semibold whitespace-normal">Row</TableHead>
                                            <TableHead className="h-auto w-[96px] px-2 py-2.5 font-semibold whitespace-normal leading-tight">Validation Status</TableHead>
                                            <TableHead className="h-auto w-[96px] px-2 py-2.5 font-semibold whitespace-normal">Student ID</TableHead>
                                            <TableHead className="h-auto w-[15%] px-2 py-2.5 font-semibold whitespace-normal">Full Name</TableHead>
                                            <TableHead className="h-auto w-[21%] px-2 py-2.5 font-semibold whitespace-normal">Personal Email</TableHead>
                                            <TableHead className="h-auto w-[92px] px-2 py-2.5 font-semibold whitespace-normal">DOB</TableHead>
                                            <TableHead className="h-auto w-[68px] px-2 py-2.5 font-semibold whitespace-normal">Gender</TableHead>
                                            <TableHead className="h-auto w-[78px] px-2 py-2.5 font-semibold whitespace-normal">Status</TableHead>
                                            <TableHead className="h-auto px-2 py-2.5 font-semibold whitespace-normal">Error Details</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((row) => {
                                            const server = preview?.rows.find(
                                                (r) => r.rowNumber === row.rowNumber,
                                            );
                                            const rowErrors = [
                                                ...issues
                                                    .filter((i) => i.rowNumber === row.rowNumber)
                                                    .map((i) => `${i.field}: ${i.message}`),
                                                ...Object.entries(server?.errors ?? {}).flatMap(
                                                    ([field, messages]) =>
                                                        messages.map((message) => `${field}: ${message}`),
                                                ),
                                            ];
                                            const isRowValid = rowErrors.length === 0 && Boolean(server?.valid);

                                            return (
                                                <TableRow
                                                    key={row.rowNumber}
                                                    className={rowErrors.length ? "bg-destructive/5" : undefined}
                                                >
                                                    <TableCell className="px-2 py-2 text-center font-medium whitespace-normal">
                                                        {row.rowNumber}
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 whitespace-normal">
                                                        {rowErrors.length ? (
                                                            <Badge variant="destructive" className="px-1.5 py-0.5 text-[11px]">Invalid</Badge>
                                                        ) : isRowValid ? (
                                                            <Badge className="bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                                Valid
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="px-1.5 py-0.5 text-[11px]">Unverified</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 font-mono text-xs font-semibold whitespace-normal break-words">
                                                        {row.studentId || "—"}
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 whitespace-normal break-words [overflow-wrap:anywhere]">
                                                        {row.fullName || "—"}
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 whitespace-normal break-words [overflow-wrap:anywhere]">
                                                        {row.personalEmail || "—"}
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 whitespace-normal">
                                                        {row.dob || "—"}
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 whitespace-normal">
                                                        {row.gender || "—"}
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 whitespace-normal">
                                                        <Badge
                                                            variant={row.status === "Inactive" ? "secondary" : row.status === "Dropped" ? "destructive" : "outline"}
                                                            className="px-1.5 py-0.5 text-[11px]"
                                                        >
                                                            {row.status || "Active"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="px-2 py-2 text-xs text-destructive whitespace-normal break-words [overflow-wrap:anywhere]">
                                                        {rowErrors.join("; ")}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </table>
                            </div>
                        </>
                    )}

                    {busy && (
                        <p role="status" className="text-sm text-muted-foreground">
                            Validating or importing trainees…
                        </p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-[#283593] text-white hover:bg-[#1a237e] dark:bg-blue-600 dark:hover:bg-blue-500"
                        disabled={!preview?.canImport || issues.length > 0 || busy}
                        onClick={() => void confirm()}
                    >
                        4. Confirm Import
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
