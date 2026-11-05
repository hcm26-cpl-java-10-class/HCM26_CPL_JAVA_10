import { useState, useRef, type ChangeEvent, type DragEvent } from "react";
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
import { programApi } from "@/api/features/program.api";
import type { ProgramImportPreview } from "@/types/features/content";

interface ProgramImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function ProgramImportDialog({
  open,
  onClose,
  onImported,
}: ProgramImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProgramImportPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setGeneralError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = () => {
    if (isImporting || isPreviewing) return;
    clearFile();
    onClose();
  };

  const validateFile = (selectedFile: File): boolean => {
    const validExts = [".xlsx", ".xls", ".csv", ".txt"];
    const hasValidExt = validExts.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      setGeneralError("Chỉ chấp nhận file Excel (.xlsx, .xls), CSV (.csv) hoặc TXT (.txt)");
      return false;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setGeneralError("Dung lượng file không được vượt quá 50MB");
      return false;
    }

    return true;
  };

  const handleFileProcess = async (selectedFile: File) => {
    if (!validateFile(selectedFile)) return;

    setFile(selectedFile);
    setGeneralError(null);
    setIsPreviewing(true);
    setPreview(null);

    try {
      const previewData = await programApi.previewImport(selectedFile);
      setPreview(previewData);

      if (previewData.invalidRows > 0) {
        toast.warning(
          `File có ${previewData.invalidRows} dòng bị lỗi. Quy tắc Rollback: Cần sửa hết lỗi để được phép Import!`
        );
      } else if (previewData.totalRows === 0) {
        setGeneralError("File rỗng, không tìm thấy dữ liệu dòng nào.");
      } else {
        toast.success(`Xem trước hoàn tất: ${previewData.validRows} dòng hợp lệ.`);
      }
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        "Không thể đọc hoặc kiểm tra file. Vui lòng kiểm tra lại định dạng.";
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
      const blob = await programApi.downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "training-program-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Đã tải xuống file mẫu import chương trình đào tạo");
    } catch (err) {
      toast.error("Không thể tải file mẫu. Vui lòng thử lại.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;

    // Strict Rollback constraint: all-or-nothing
    if (!preview.canImport || preview.invalidRows > 0) {
      toast.error(
        "Chặn Import: File có dòng chứa lỗi. Hệ thống áp dụng Rollback toàn bộ, bạn cần sửa lại tất cả các lỗi trước khi import."
      );
      return;
    }

    try {
      setIsImporting(true);
      const res = await programApi.importFile(file);
      toast.success(
        res.message || `Import thành công ${res.importedPrograms || preview.validRows} chương trình đào tạo!`
      );
      handleClose();
      onImported();
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ||
        "Quá trình import thất bại. Toàn bộ thay đổi đã được rollback.";
      toast.error(errMsg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">Import Training Programs</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Upload Excel/CSV file to import data in bulk
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
                Download Excel template to see data format
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
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                Excel, CSV or TXT files (.xlsx, .xls, .csv, .txt) up to 50MB
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
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
                  title="Chạy lại kiểm tra Preview"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isPreviewing ? "animate-spin" : ""}`} />
                  Xem lại Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={isImporting || isPreviewing}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
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
                  <p className="text-xs font-medium">Đang phân tích và kiểm tra dữ liệu file (Preview)...</p>
                </div>
              )}

              {/* PREVIEW CONTENT */}
              {preview && !isPreviewing && (
                <div className="space-y-3">
                  {/* Metric Counters */}
                  <div className="grid grid-cols-3 gap-3 text-center text-xs">
                    <div className="rounded-xl border bg-muted/30 p-2.5">
                      <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">
                        Tổng số dòng
                      </div>
                      <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5 font-mono">
                        {preview.totalRows}
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-500/10 p-2.5 text-emerald-700 dark:text-emerald-400">
                      <div className="uppercase text-[10px] font-semibold tracking-wide">
                        Hợp lệ
                      </div>
                      <div className="text-xl font-bold mt-0.5 font-mono">
                        {preview.validRows}
                      </div>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-500/10 p-2.5 text-rose-700 dark:text-rose-400">
                      <div className="uppercase text-[10px] font-semibold tracking-wide">
                        Lỗi (Cần sửa)
                      </div>
                      <div className="text-xl font-bold mt-0.5 font-mono">
                        {preview.invalidRows}
                      </div>
                    </div>
                  </div>

                  {/* Rollback Constraint Banner */}
                  {preview.invalidRows > 0 ? (
                    <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5 shadow-sm">
                      <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-800 dark:text-red-200 text-sm">
                          Quy tắc Rollback an toàn (All-or-Nothing)
                        </p>
                        <p className="mt-1 text-red-700 dark:text-red-300 leading-relaxed">
                          Phát hiện <strong>{preview.invalidRows}</strong> dòng có lỗi. Để đảm bảo dữ liệu không bị sai lệch, hệ thống <strong>tuyệt đối không cho phép import</strong> khi còn bất kỳ dòng nào bị lỗi. Vui lòng xem chi tiết lỗi bên dưới, sửa lại file và tải lên lại.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span>
                        Tất cả <strong>{preview.validRows}</strong> dòng đều hợp lệ! Bạn có thể nhấn <strong>Import</strong> để lưu vào hệ thống.
                      </span>
                    </div>
                  )}

                  {/* Clean Non-Overlapping Preview Table */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-900">
                    <div className="max-h-64 overflow-x-auto overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        {/* Solid Opaque Sticky Header - Không bị đè chữ hay xuyên thấu */}
                        <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold border-b border-gray-300 dark:border-gray-700 shadow-sm">
                          <tr>
                            <th className="p-2.5 w-14 min-w-[56px] text-center bg-gray-100 dark:bg-gray-800">Dòng</th>
                            <th className="p-2.5 w-24 min-w-[96px] bg-gray-100 dark:bg-gray-800">Trạng thái</th>
                            <th className="p-2.5 w-32 min-w-[120px] bg-gray-100 dark:bg-gray-800">Mã CT</th>
                            <th className="p-2.5 w-24 min-w-[90px] bg-gray-100 dark:bg-gray-800">Version CT</th>
                            <th className="p-2.5 w-32 min-w-[120px] bg-gray-100 dark:bg-gray-800">Mã Môn</th>
                            <th className="p-2.5 w-24 min-w-[90px] bg-gray-100 dark:bg-gray-800">Version Môn</th>
                            <th className="p-2.5 min-w-[220px] bg-gray-100 dark:bg-gray-800">Lỗi chi tiết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                          {preview.rows.map((row) => (
                            <tr
                              key={row.rowNumber}
                              className={`transition-colors ${
                                row.valid
                                  ? "hover:bg-gray-50/80 dark:hover:bg-gray-800/50"
                                  : "bg-red-50/80 dark:bg-red-950/40 text-red-900 dark:text-red-200"
                              }`}
                            >
                              <td className="p-2.5 text-center font-mono font-semibold text-muted-foreground">
                                {row.rowNumber}
                              </td>
                              <td className="p-2.5">
                                {row.valid ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                    <CheckCircle2 className="h-3 w-3" /> Hợp lệ
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                    <AlertCircle className="h-3 w-3" /> Có lỗi
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-mono font-semibold text-gray-900 dark:text-gray-100">
                                {row.programCode || <span className="text-red-500 italic">Trống</span>}
                              </td>
                              <td className="p-2.5 font-mono">
                                {row.programVersion ? `v${row.programVersion}` : <span className="text-red-500 italic">Trống</span>}
                              </td>
                              <td className="p-2.5 font-mono font-semibold text-purple-700 dark:text-purple-400">
                                {row.subjectCode || <span className="text-red-500 italic">Trống</span>}
                              </td>
                              <td className="p-2.5 font-mono">
                                {row.subjectVersion ? `v${row.subjectVersion}` : <span className="text-red-500 italic">Trống</span>}
                              </td>
                              <td className="p-2.5 text-red-600 dark:text-red-400 text-[11px] leading-tight">
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
                            </tr>
                          ))}
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
            Close
          </Button>

          <Button
            type="button"
            onClick={handleImport}
            disabled={
              !file ||
              !preview ||
              !preview.canImport ||
              preview.invalidRows > 0 ||
              preview.totalRows === 0 ||
              isImporting ||
              isPreviewing
            }
            className={`text-white transition-all rounded-lg font-medium ${
              preview?.canImport && preview?.invalidRows === 0
                ? "bg-purple-600 hover:bg-purple-700 shadow"
                : "bg-gray-400 cursor-not-allowed opacity-60"
            }`}
            title={
              preview?.invalidRows && preview.invalidRows > 0
                ? "Không thể import vì file có dòng bị lỗi (Quy tắc Rollback toàn bộ)"
                : "Import dữ liệu hợp lệ vào hệ thống"
            }
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang Import...
              </>
            ) : (
              "Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
