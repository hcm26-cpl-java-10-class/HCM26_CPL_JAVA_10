import { useState, useRef, useMemo, type ChangeEvent, type DragEvent } from "react";
import {
  Download,
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  RefreshCw,
  Trash2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { topicApi } from "@/api/features/topic.api";
import type { TopicImportPreview, TopicImportPreviewRow } from "@/types/features/content";

interface TopicImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function TopicImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: TopicImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<TopicImportPreviewRow[]>([]);
  const [originalRows, setOriginalRows] = useState<TopicImportPreviewRow[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearFile = () => {
    setFile(null);
    setRows([]);
    setOriginalRows([]);
    setGeneralError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (isImporting || isPreviewing) return;
    clearFile();
    onOpenChange(false);
  };

  const validateFile = (selectedFile: File): boolean => {
    const validExts = [".xlsx", ".xls", ".csv"];
    const hasValidExt = validExts.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      setGeneralError("Only Excel (.xlsx, .xls) and CSV (.csv) files are supported");
      return false;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setGeneralError("File size cannot exceed 50MB");
      return false;
    }

    return true;
  };

  const handleFileProcess = async (selectedFile: File) => {
    if (!validateFile(selectedFile)) return;

    setFile(selectedFile);
    setGeneralError(null);
    setIsPreviewing(true);
    setRows([]);
    setOriginalRows([]);

    try {
      const previewData: TopicImportPreview = await topicApi.previewImport(selectedFile);
      const parsedRows = previewData.rows || [];
      const validatedRows = revalidateRows(parsedRows, parsedRows);
      setRows(validatedRows);
      setOriginalRows(JSON.parse(JSON.stringify(validatedRows)));

      const invalidCount = validatedRows.filter((r) => !r.valid).length;
      if (invalidCount > 0) {
        toast.warning(
          `File has ${invalidCount} invalid row(s). Strict Rollback: All errors must be fixed before import!`
        );
      } else if (validatedRows.length === 0) {
        setGeneralError("The uploaded file contains no data rows.");
      } else {
        toast.success(`Preview ready: ${validatedRows.length} valid row(s).`);
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        "Failed to read or parse file. Please verify file format.";
      setGeneralError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      handleFileProcess(selected);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isImporting || isPreviewing) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isImporting || isPreviewing) return;

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileProcess(droppedFile);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      const blob = await topicApi.downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "topic-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Topic import template downloaded");
    } catch (err) {
      toast.error("Failed to download template. Please try again.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Comprehensive client-side re-validation
  const revalidateRows = (
    currentRows: TopicImportPreviewRow[],
    baseOriginal: TopicImportPreviewRow[] = originalRows
  ): TopicImportPreviewRow[] => {
    const seenKeys = new Map<string, number>();

    return currentRows.map((row, idx) => {
      const errors: string[] = [];
      const code = (row.code || "").trim();
      const name = (row.name || "").trim();
      const version = (row.version || "").trim();
      const techGroup = (row.technicalGroup || "").trim();
      const rawDuration = row.durationHours;

      // 1. Topic Code validation
      if (!code) {
        errors.push("Topic Code is required");
      } else if (code.length > 50) {
        errors.push("Topic Code cannot exceed 50 characters");
      }

      // 2. Topic Name validation
      if (!name) {
        errors.push("Topic Name is required");
      } else if (name.length > 255) {
        errors.push("Topic Name cannot exceed 255 characters");
      }

      // 3. Version validation
      if (!version) {
        errors.push("Version is required");
      } else if (version.length > 20) {
        errors.push("Version cannot exceed 20 characters");
      }

      // 4. Technical Group validation (must be text, cannot be purely numeric, max 100 chars)
      if (techGroup) {
        if (/^[0-9]+(\.[0-9]+)?$/.test(techGroup)) {
          errors.push("Technical Group must be text (cannot be only numbers)");
        } else if (techGroup.length > 100) {
          errors.push("Technical Group cannot exceed 100 characters");
        }
      }

      // 5. Duration validation (positive integer > 0, <= 1000, no negative numbers)
      if (rawDuration === undefined || rawDuration === null || String(rawDuration).trim() === "") {
        errors.push("Duration (Hours) is required");
      } else {
        const num = Number(rawDuration);
        if (isNaN(num)) {
          errors.push("Duration must be a valid number");
        } else if (num <= 0) {
          errors.push("Duration must be a positive integer greater than 0 (no negative numbers)");
        } else if (!Number.isInteger(num)) {
          errors.push("Duration must be an integer number of hours");
        } else if (num > 1000) {
          errors.push("Duration cannot exceed 1000 hours");
        }
      }

      // 6. Description length
      if (row.description && row.description.length > 1000) {
        errors.push("Description cannot exceed 1000 characters");
      }

      // 7. Duplicate check within preview table
      if (code && version) {
        const key = `${code.toUpperCase()}#${version.toUpperCase()}`;
        if (seenKeys.has(key)) {
          errors.push(`Duplicate Code '${code}' and Version '${version}' with row #${seenKeys.get(key)}`);
        } else {
          seenKeys.set(key, row.rowNumber || idx + 1);
        }
      }

      // 8. Preserve existing database duplicate error if code & version were not changed
      if (row.errors && row.errors.some((e) => e.toLowerCase().includes("already exists"))) {
        const orig = baseOriginal.find((o) => o.rowNumber === row.rowNumber);
        if (orig && orig.code === row.code && orig.version === row.version) {
          errors.push(`Topic with Code '${code}' and Version '${version}' already exists in system.`);
        }
      }

      const distinctErrors = Array.from(new Set(errors));
      return {
        ...row,
        valid: distinctErrors.length === 0,
        errors: distinctErrors,
      };
    });
  };

  const handleCellChange = (
    index: number,
    field: keyof TopicImportPreviewRow,
    value: any
  ) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return revalidateRows(next);
    });
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return revalidateRows(next);
    });
    toast.info("Deleted 1 row from preview list.");
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const newRowNumber = prev.length > 0 ? Math.max(...prev.map((r) => r.rowNumber)) + 1 : 1;
      const newRow: TopicImportPreviewRow = {
        rowNumber: newRowNumber,
        code: "",
        name: "",
        version: "1.0",
        technicalGroup: "",
        durationHours: 20,
        description: "",
        status: "ACTIVE",
        valid: false,
        errors: ["Topic Code is required", "Topic Name is required"],
      };
      return revalidateRows([...prev, newRow]);
    });
  };

  const handleResetRows = () => {
    if (originalRows.length > 0) {
      setRows(JSON.parse(JSON.stringify(originalRows)));
      toast.info("Restored original file data.");
    }
  };

  // Metrics
  const totalRows = rows.length;
  const invalidRows = useMemo(() => rows.filter((r) => !r.valid).length, [rows]);
  const validRows = totalRows - invalidRows;
  const canImport = totalRows > 0 && invalidRows === 0;

  const handleImport = async () => {
    if (!canImport) {
      toast.error(
        "Import Blocked: Errors detected. Strict Rollback policy requires 100% valid rows before importing."
      );
      return;
    }

    try {
      setIsImporting(true);
      const payload = rows.map((r) => ({
        code: r.code.trim(),
        name: r.name.trim(),
        version: r.version.trim(),
        technicalGroup: r.technicalGroup?.trim() || undefined,
        durationHours: Number(r.durationHours),
        description: r.description?.trim() || undefined,
        status: (r.status as any) || "ACTIVE",
      }));

      const res = await topicApi.commitImport(payload);
      toast.success(
        `Import successful! Added ${res.successCount || validRows} topic(s) to system.`
      );
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        "Import failed. All changes have been rolled back.";
      toast.error(errMsg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">Import Topics</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Upload an Excel or CSV file to bulk import topics, or preview and edit data inline before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Card 1: Download Template */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Download Template
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Download standard Excel template with sample data format
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate || isImporting}
              className="h-9 w-9 p-0 border-gray-300 rounded-lg shrink-0 hover:bg-muted"
              title="Download Template"
            >
              {downloadingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <Download className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              )}
            </Button>
          </div>

          {/* Card 2: Dropzone / File Upload */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                flex flex-col items-center justify-center
                border-2 border-dashed rounded-xl p-8 text-center gap-2
                transition-colors cursor-pointer min-h-[170px]
                ${
                  isDragging
                    ? "border-purple-600 bg-purple-50/50 dark:bg-purple-950/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-purple-400 hover:bg-muted/10"
                }
              `}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted/60 mb-1">
                <Upload className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Click to upload or drag and drop file here
              </p>
              <p className="text-xs text-muted-foreground">
                Supports Excel (.xlsx, .xls) and CSV (.csv) up to 50MB
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={isPreviewing || isImporting}
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected File Box */}
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-muted/30">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg text-purple-700 dark:text-purple-300">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-gray-900 dark:text-gray-100">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFileProcess(file)}
                  disabled={isPreviewing || isImporting}
                  className="h-8 gap-1.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                  title="Reload and re-parse file"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isPreviewing ? "animate-spin" : ""}`} />
                  Reload
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={isImporting || isPreviewing}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* General error if any */}
              {generalError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{generalError}</span>
                </div>
              )}

              {/* Preview Loading */}
              {isPreviewing && (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground border rounded-xl bg-muted/10">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  <p className="text-xs font-medium">Analyzing file data & checking validations (Preview)...</p>
                </div>
              )}

              {/* PREVIEW CONTENT */}
              {rows.length > 0 && !isPreviewing && (
                <div className="space-y-3">
                  {/* Metric Counters & Actions Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="grid grid-cols-3 gap-2 flex-1 text-center text-xs">
                      <div className="rounded-xl border bg-muted/30 p-2">
                        <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">
                          TOTAL ROWS
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5 font-mono">
                          {totalRows}
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-400">
                        <div className="uppercase text-[10px] font-semibold tracking-wide">
                          VALID
                        </div>
                        <div className="text-lg font-bold mt-0.5 font-mono">
                          {validRows}
                        </div>
                      </div>
                      <div className="rounded-xl border border-rose-200 bg-rose-500/10 p-2 text-rose-700 dark:text-rose-400">
                        <div className="uppercase text-[10px] font-semibold tracking-wide">
                          INVALID (NEEDS FIX)
                        </div>
                        <div className="text-lg font-bold mt-0.5 font-mono">
                          {invalidRows}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddRow}
                        className="h-8 gap-1 text-xs"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Row
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetRows}
                        className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Reset to original file data"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                      </Button>
                    </div>
                  </div>

                  {/* Rollback Constraint Banner */}
                  {invalidRows > 0 ? (
                    <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5 shadow-sm">
                      <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-800 dark:text-red-200 text-sm">
                          Strict Rollback Policy (All-or-Nothing)
                        </p>
                        <p className="mt-1 text-red-700 dark:text-red-300 leading-relaxed">
                          Detected <strong>{invalidRows}</strong> invalid row(s). To protect database integrity, <strong>import is strictly blocked</strong> while any errors remain. You can <strong>edit cells directly</strong> in the table below or delete invalid rows to enable Import.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span>
                        All <strong>{validRows}</strong> row(s) are valid! You can now click <strong>Import</strong> to save them to the database.
                      </span>
                    </div>
                  )}

                  {/* Clean Interactive Editable Preview Table */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-900">
                    <div className="max-h-72 overflow-x-auto overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-300 dark:border-gray-700 shadow-sm">
                          <tr>
                            <th className="p-2 w-10 text-center bg-gray-100 dark:bg-gray-800">#</th>
                            <th className="p-2 w-20 bg-gray-100 dark:bg-gray-800">Status</th>
                            <th className="p-2 w-32 min-w-[120px] bg-gray-100 dark:bg-gray-800">Topic Code *</th>
                            <th className="p-2 w-48 min-w-[170px] bg-gray-100 dark:bg-gray-800">Topic Name *</th>
                            <th className="p-2 w-20 min-w-[70px] bg-gray-100 dark:bg-gray-800">Version *</th>
                            <th className="p-2 w-28 min-w-[100px] bg-gray-100 dark:bg-gray-800">Technical Group</th>
                            <th className="p-2 w-24 min-w-[80px] bg-gray-100 dark:bg-gray-800">Duration (h) *</th>
                            <th className="p-2 w-24 min-w-[90px] bg-gray-100 dark:bg-gray-800">Status</th>
                            <th className="p-2 min-w-[200px] bg-gray-100 dark:bg-gray-800">Error Details</th>
                            <th className="p-2 w-10 text-center bg-gray-100 dark:bg-gray-800">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                          {rows.map((row, idx) => {
                            const isRowInvalid = !row.valid;
                            const tg = (row.technicalGroup || "").trim();
                            const isTgNumeric = tg && /^[0-9]+(\.[0-9]+)?$/.test(tg);
                            const numDuration = Number(row.durationHours);
                            const isDurationInvalid =
                              row.durationHours == null ||
                              String(row.durationHours).trim() === "" ||
                              isNaN(numDuration) ||
                              numDuration <= 0 ||
                              !Number.isInteger(numDuration) ||
                              numDuration > 1000;

                            return (
                              <tr
                                key={idx}
                                className={`transition-colors ${
                                  isRowInvalid
                                    ? "bg-red-50/70 dark:bg-red-950/30"
                                    : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                                }`}
                              >
                                <td className="p-2 text-center font-mono font-semibold text-muted-foreground">
                                  {idx + 1}
                                </td>
                                <td className="p-2">
                                  {row.valid ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                      <CheckCircle2 className="h-3 w-3" /> Valid
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                      <AlertCircle className="h-3 w-3" /> Invalid
                                    </span>
                                  )}
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    maxLength={50}
                                    value={row.code || ""}
                                    onChange={(e) => handleCellChange(idx, "code", e.target.value)}
                                    placeholder="Topic Code..."
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                                      !row.code?.trim() || row.code.trim().length > 50
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    maxLength={255}
                                    value={row.name || ""}
                                    onChange={(e) => handleCellChange(idx, "name", e.target.value)}
                                    placeholder="Topic Name..."
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                                      !row.name?.trim() || row.name.trim().length > 255
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    maxLength={20}
                                    value={row.version || ""}
                                    onChange={(e) => handleCellChange(idx, "version", e.target.value)}
                                    placeholder="1.0"
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                                      !row.version?.trim() || row.version.trim().length > 20
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    maxLength={100}
                                    value={row.technicalGroup || ""}
                                    onChange={(e) => handleCellChange(idx, "technicalGroup", e.target.value)}
                                    placeholder="e.g. Java, Frontend..."
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                                      isTgNumeric || (row.technicalGroup && row.technicalGroup.length > 100)
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    min="1"
                                    max="1000"
                                    value={row.durationHours ?? ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleCellChange(idx, "durationHours", val === "" ? "" : Number(val));
                                    }}
                                    placeholder="Hours"
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors text-right ${
                                      isDurationInvalid
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <select
                                    value={row.status || "ACTIVE"}
                                    onChange={(e) => handleCellChange(idx, "status", e.target.value)}
                                    className="w-full px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                  >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="INACTIVE">INACTIVE</option>
                                  </select>
                                </td>
                                <td className="p-2 text-red-600 dark:text-red-400 text-[11px] leading-tight">
                                  {row.errors && row.errors.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-0.5">
                                      {row.errors.map((err, eIdx) => (
                                        <li key={eIdx}>{err}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="p-1 text-center">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteRow(idx)}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                                    title="Delete row"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t mt-2 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
            className="rounded-lg text-sm"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleImport}
            disabled={!canImport || isImporting || isPreviewing}
            className={`text-white transition-all rounded-lg font-medium ${
              canImport
                ? "bg-purple-600 hover:bg-purple-700 shadow"
                : "bg-gray-400 cursor-not-allowed opacity-60"
            }`}
            title={
              invalidRows > 0
                ? "Cannot import: Invalid rows exist (Strict Rollback Policy)"
                : "Import valid data to system"
            }
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              `Import (${validRows} row${validRows === 1 ? "" : "s"})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
