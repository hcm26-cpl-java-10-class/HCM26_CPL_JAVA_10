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
    Table,
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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle>Import Trainees from Excel</DialogTitle>
                    <DialogDescription>
                        Upload an Excel (.xlsx) file to validate and batch-import trainees into this class.
                        Supports flexible date formats (DD/MM/YYYY, YYYY-MM-DD, or Excel Date cells).
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                        <div>
                            <h3 className="text-sm font-semibold">1. Download Template</h3>
                            <p className="text-xs text-muted-foreground">
                                Columns: Student ID*, Full Name*, Personal Email, DOB, Gender.
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

                            {!preview && !issues.length && (
                                <p className="text-sm text-muted-foreground">
                                    Server verification is required before import.
                                </p>
                            )}

                            <div className="max-h-80 overflow-auto rounded-md border">
                                <Table aria-label="Trainee import preview">
                                    <TableHeader>
                                        <TableRow>
                                            {[
                                                "Row",
                                                "Validation Status",
                                                "Student ID",
                                                "Full Name",
                                                "Personal Email",
                                                "DOB",
                                                "Gender",
                                                "Error Details",
                                            ].map((header) => (
                                                <TableHead key={header}>{header}</TableHead>
                                            ))}
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
                                                    <TableCell className="font-medium">{row.rowNumber}</TableCell>
                                                    <TableCell>
                                                        {rowErrors.length ? (
                                                            <Badge variant="destructive">Invalid</Badge>
                                                        ) : isRowValid ? (
                                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                                Valid
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary">Unverified</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-semibold">
                                                        {row.studentId || "—"}
                                                    </TableCell>
                                                    <TableCell>{row.fullName || "—"}</TableCell>
                                                    <TableCell>{row.personalEmail || "—"}</TableCell>
                                                    <TableCell>{row.dob || "—"}</TableCell>
                                                    <TableCell>{row.gender || "—"}</TableCell>
                                                    <TableCell className="min-w-56 text-xs text-destructive">
                                                        {rowErrors.join("; ")}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
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
