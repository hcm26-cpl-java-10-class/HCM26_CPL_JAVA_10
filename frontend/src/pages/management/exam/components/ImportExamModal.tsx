import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { examApi } from "@/api";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import type { ImportResult } from "@/types";

interface ImportExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ImportExamModal({ open, onOpenChange, onSuccess }: ImportExamModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<"xlsx" | "csv" | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async (format: "xlsx" | "csv") => {
    try {
      setDownloadingFormat(format);
      const blob = await examApi.downloadExamTemplate(format);
      downloadBlob(blob, `assessments-template.${format}`);
      toast.success(`Downloaded ${format.toUpperCase()} template`);
    } catch {
      toast.error("Failed to download template");
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleFileSelect = (selected?: File) => {
    if (!selected) return;
    const name = selected.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      toast.error("Please upload an Excel (.xlsx/.xls) or CSV (.csv) file");
      return;
    }
    setFile(selected);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file || loading) return;

    try {
      setLoading(true);
      const res = await examApi.importExams(file);
      setResult(res);

      const total = res.totalCount ?? (res.successCount + res.failureCount);

      if (res.successCount > 0) {
        toast.success(`Successfully imported ${res.successCount}/${total} assessment(s)`);
        onSuccess();
      }

      if (res.failureCount > 0) {
        toast.error(`Import rolled back: ${res.failureCount}/${total} record(s) contain errors. No assessments were saved.`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to process import file");
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const totalRecords = result ? (result.totalCount ?? (result.successCount + result.failureCount)) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAll();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-5 text-primary" />
            Import Assessments
          </DialogTitle>
          <DialogDescription>
            Bulk import assessments and exams using a CSV or Microsoft Excel file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Step 1: Download template */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Step 1: Download sample format template</span>
              <span className="text-[11px] font-normal text-muted-foreground">Required columns included</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownloadTemplate("xlsx")}
              >
                {downloadingFormat === "xlsx" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="size-3.5 text-emerald-500" />
                )}
                Excel Template (.xlsx)
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={downloadingFormat !== null}
                onClick={() => handleDownloadTemplate("csv")}
              >
                {downloadingFormat === "csv" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FileText className="size-3.5 text-blue-500" />
                )}
                CSV Template (.csv)
              </Button>
            </div>
          </div>

          {/* Step 2: Upload file */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Step 2: Choose your file to upload</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />

            <div
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                file
                  ? "border-primary/60 bg-primary/5"
                  : "border-border/80 hover:border-primary/50 hover:bg-muted/20"
              }`}
            >
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                <Upload className="size-5" />
              </div>
              {file ? (
                <div className="text-center">
                  <p className="font-semibold text-sm text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024).toFixed(1)} KB · Click to replace file
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-medium text-sm text-foreground">Click to select file or drag & drop</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Supports .xlsx, .xls, and .csv files</p>
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Result Summary (if any) */}
          {result && (
            <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Import Results</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tập tin: <span className="font-medium text-foreground">{file?.name}</span>
                  </p>
                </div>
                {result.failureCount > 0 ? (
                  <Badge variant="destructive" className="text-xs font-semibold">
                    Rolled back (0 saved)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30 bg-emerald-500/10 font-semibold">
                    All {result.successCount} Valid
                  </Badge>
                )}
              </div>

              {/* 3 Stats Cards: Total, Success, Failed */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-border/80 bg-muted/40 p-3">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                    <ListChecks className="size-3.5 text-primary" />
                    <span>Total Rows</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{totalRecords}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Tổng số dòng</p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">
                    <CheckCircle2 className="size-3.5" />
                    <span>Success</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {result.successCount}
                  </p>
                  <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Thành công</p>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium mb-1">
                    <XCircle className="size-3.5" />
                    <span>Failed</span>
                  </div>
                  <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                    {result.failureCount}
                  </p>
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">Bị lỗi</p>
                </div>
              </div>

              {result.failureCount > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-800 dark:text-amber-200">
                      Cơ chế Rollback (All-or-Nothing):
                    </p>
                    <p className="leading-relaxed">
                      Phát hiện có dòng bị lỗi trong file ({result.failureCount}/{totalRecords} dòng lỗi). Toàn bộ quá trình import đã được hoàn tác, <strong>chưa có đề thi nào được lưu</strong> vào cơ sở dữ liệu. Vui lòng kiểm tra các lỗi bên dưới, chỉnh sửa lại file và tải lên lại.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Details */}
              {result.errors && result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-rose-500">
                    Chi tiết lỗi ({result.errors.length} dòng):
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {result.errors.map((err, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-600 dark:text-rose-300"
                      >
                        <Badge
                          variant="outline"
                          className="font-mono text-[11px] font-bold border-rose-500/30 text-rose-600 bg-rose-500/10 shrink-0"
                        >
                          Dòng #{err.rowNumber}
                        </Badge>
                        <span className="flex-1 mt-0.5 leading-relaxed">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {result ? "Close" : "Cancel"}
          </Button>

          {!result ? (
            <Button onClick={handleImport} disabled={!file || loading} className="gap-2">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {loading ? "Importing..." : "Start Import"}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={resetAll}
              className="gap-2"
            >
              Import Another File
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
