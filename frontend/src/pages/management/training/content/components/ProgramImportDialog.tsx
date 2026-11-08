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
import { programApi } from "@/api/features/program.api";
import type { ProgramImportPreview, ProgramImportPreviewRow } from "@/types/features/content";

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
  const [rows, setRows] = useState<ProgramImportPreviewRow[]>([]);
  const [originalRows, setOriginalRows] = useState<ProgramImportPreviewRow[]>([]);
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
    setRows([]);
    setOriginalRows([]);

    try {
      const previewData: ProgramImportPreview = await programApi.previewImport(selectedFile);
      const parsedRows = previewData.rows || [];
      setRows(parsedRows);
      setOriginalRows(JSON.parse(JSON.stringify(parsedRows)));

      if (previewData.invalidRows > 0) {
        toast.warning(
          `File có ${previewData.invalidRows} dòng bị lỗi. Quy tắc Rollback: Cần sửa hết lỗi trực tiếp trên bảng hoặc xóa dòng lỗi để được phép Import!`
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

  // Re-validate all rows client-side whenever edited
  const revalidateRows = (currentRows: ProgramImportPreviewRow[]): ProgramImportPreviewRow[] => {
    return currentRows.map((row) => {
      const errors: string[] = [];
      const pCode = (row.programCode || "").trim();
      const pName = (row.programName || "").trim();
      const pVersion = (row.programVersion || "").trim();
      const sCode = (row.subjectCode || "").trim();
      const sVersion = (row.subjectVersion || "").trim();
      const order = Number(row.orderIndex);

      if (!pCode) errors.push("Thiếu programCode");
      if (!pName) errors.push("Thiếu programName");
      if (!pVersion) errors.push("Thiếu programVersion");
      if (!sCode) errors.push("Thiếu subjectCode");
      if (!sVersion) errors.push("Thiếu subjectVersion");

      if (row.orderIndex == null || isNaN(order) || order < 1) {
        errors.push("orderIndex phải là số nguyên dương");
      }

      // Preserve backend errors if values haven't changed
      if (row.errors) {
        for (const e of row.errors) {
          if (
            e.includes("đã tồn tại") ||
            e.includes("không tồn tại") ||
            e.includes("INACTIVE") ||
            e.includes("trùng trong chương trình")
          ) {
            const orig = originalRows.find((o) => o.rowNumber === row.rowNumber);
            if (
              orig &&
              orig.programCode === row.programCode &&
              orig.subjectCode === row.subjectCode &&
              orig.subjectVersion === row.subjectVersion
            ) {
              errors.push(e);
            }
          }
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
    field: keyof ProgramImportPreviewRow,
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
    toast.info("Đã xóa 1 dòng dữ liệu khỏi danh sách xem trước.");
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const newRowNumber = prev.length > 0 ? Math.max(...prev.map((r) => r.rowNumber)) + 1 : 1;
      const newRow: ProgramImportPreviewRow = {
        rowNumber: newRowNumber,
        programCode: "",
        programName: "",
        programVersion: "1.0",
        region: "HCM",
        subjectCode: "",
        subjectVersion: "1.0",
        orderIndex: prev.length + 1,
        valid: false,
        errors: ["Thiếu programCode", "Thiếu programName", "Thiếu subjectCode"],
      };
      return revalidateRows([...prev, newRow]);
    });
  };

  const handleResetRows = () => {
    if (originalRows.length > 0) {
      setRows(JSON.parse(JSON.stringify(originalRows)));
      toast.info("Đã khôi phục dữ liệu ban đầu từ file.");
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
        "Chặn Import: Còn dòng chứa lỗi. Hệ thống áp dụng quy tắc Rollback toàn bộ (All-or-Nothing), bạn cần sửa hoặc xóa hết dòng lỗi trước khi Import."
      );
      return;
    }

    try {
      setIsImporting(true);
      const payload = rows.map((r) => ({
        number: r.rowNumber,
        programCode: r.programCode.trim(),
        programName: (r.programName || r.programCode).trim(),
        programVersion: r.programVersion.trim(),
        region: r.region?.trim() || null,
        subjectCode: r.subjectCode.trim(),
        subjectVersion: r.subjectVersion.trim(),
        orderIndex: Number(r.orderIndex),
      }));

      const res = await programApi.commitImport(payload);
      toast.success(
        res.message || `Import thành công! Đã lưu ${res.importedPrograms || validRows} chương trình.`
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
      <DialogContent className="sm:max-w-5xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">Import Training Programs</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Tải lên file Excel/CSV hoặc xem trước, chỉnh sửa trực tiếp các dòng/cột trước khi lưu
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
                Tải file mẫu Excel chuẩn định dạng cho chương trình đào tạo
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate || isImporting}
              className="h-9 w-9 p-0 border-gray-300 rounded-lg shrink-0 hover:bg-muted"
              title="Tải file mẫu"
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
                Nhấp để chọn file hoặc kéo thả file vào đây
              </p>
              <p className="text-xs text-muted-foreground">
                Hỗ trợ định dạng Excel (.xlsx, .xls), CSV (.csv) hoặc TXT (.txt) tối đa 50MB
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
                  title="Tải lại file từ đầu"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isPreviewing ? "animate-spin" : ""}`} />
                  Tải lại
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFile}
                  disabled={isImporting || isPreviewing}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                  title="Đổi file khác"
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
              {rows.length > 0 && !isPreviewing && (
                <div className="space-y-3">
                  {/* Metric Counters & Actions Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="grid grid-cols-3 gap-2 flex-1 text-center text-xs">
                      <div className="rounded-xl border bg-muted/30 p-2">
                        <div className="text-muted-foreground uppercase text-[10px] font-semibold tracking-wide">
                          Tổng số dòng
                        </div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5 font-mono">
                          {totalRows}
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-200 bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-400">
                        <div className="uppercase text-[10px] font-semibold tracking-wide">
                          Hợp lệ
                        </div>
                        <div className="text-lg font-bold mt-0.5 font-mono">
                          {validRows}
                        </div>
                      </div>
                      <div className="rounded-xl border border-rose-200 bg-rose-500/10 p-2 text-rose-700 dark:text-rose-400">
                        <div className="uppercase text-[10px] font-semibold tracking-wide">
                          Lỗi (Cần sửa)
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
                        Thêm dòng
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetRows}
                        className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        title="Khôi phục dữ liệu ban đầu từ file"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Khôi phục
                      </Button>
                    </div>
                  </div>

                  {/* Rollback Constraint Banner */}
                  {invalidRows > 0 ? (
                    <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5 shadow-sm">
                      <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-red-800 dark:text-red-200 text-sm">
                          Quy tắc Rollback an toàn (All-or-Nothing)
                        </p>
                        <p className="mt-1 text-red-700 dark:text-red-300 leading-relaxed">
                          Phát hiện <strong>{invalidRows}</strong> dòng có lỗi. Để đảm bảo dữ liệu không bị sai lệch, hệ thống <strong>tuyệt đối không cho phép import</strong> khi còn bất kỳ dòng nào bị lỗi. Bạn có thể <strong>sửa trực tiếp các ô lỗi</strong> trên bảng bên dưới hoặc xóa dòng lỗi để đưa số lỗi về 0.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span>
                        Tất cả <strong>{validRows}</strong> dòng đều hợp lệ! Bạn có thể nhấn <strong>Import</strong> để lưu vào hệ thống.
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
                            <th className="p-2 w-20 bg-gray-100 dark:bg-gray-800">Trạng thái</th>
                            <th className="p-2 w-32 min-w-[120px] bg-gray-100 dark:bg-gray-800">Mã CT *</th>
                            <th className="p-2 w-44 min-w-[160px] bg-gray-100 dark:bg-gray-800">Tên CT *</th>
                            <th className="p-2 w-20 min-w-[70px] bg-gray-100 dark:bg-gray-800">Version *</th>
                            <th className="p-2 w-24 min-w-[80px] bg-gray-100 dark:bg-gray-800">Khu vực</th>
                            <th className="p-2 w-28 min-w-[110px] bg-gray-100 dark:bg-gray-800">Mã môn *</th>
                            <th className="p-2 w-20 min-w-[70px] bg-gray-100 dark:bg-gray-800">Ver môn *</th>
                            <th className="p-2 w-20 min-w-[70px] bg-gray-100 dark:bg-gray-800">Thứ tự *</th>
                            <th className="p-2 min-w-[200px] bg-gray-100 dark:bg-gray-800">Lỗi chi tiết</th>
                            <th className="p-2 w-10 text-center bg-gray-100 dark:bg-gray-800">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                          {rows.map((row, idx) => {
                            const isRowInvalid = !row.valid;
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
                                      <CheckCircle2 className="h-3 w-3" /> Hợp lệ
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                      <AlertCircle className="h-3 w-3" /> Có lỗi
                                    </span>
                                  )}
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    value={row.programCode || ""}
                                    onChange={(e) => handleCellChange(idx, "programCode", e.target.value)}
                                    placeholder="JAVA_BACKEND..."
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                                      !row.programCode?.trim()
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    value={row.programName || ""}
                                    onChange={(e) => handleCellChange(idx, "programName", e.target.value)}
                                    placeholder="Java Backend Specialist..."
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                                      !row.programName?.trim()
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    value={row.programVersion || ""}
                                    onChange={(e) => handleCellChange(idx, "programVersion", e.target.value)}
                                    placeholder="1.0"
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                                      !row.programVersion?.trim()
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    value={row.region || ""}
                                    onChange={(e) => handleCellChange(idx, "region", e.target.value)}
                                    placeholder="HCM / HN..."
                                    className="w-full px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    value={row.subjectCode || ""}
                                    onChange={(e) => handleCellChange(idx, "subjectCode", e.target.value)}
                                    placeholder="L1_AL_PSE..."
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                                      !row.subjectCode?.trim()
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="text"
                                    value={row.subjectVersion || ""}
                                    onChange={(e) => handleCellChange(idx, "subjectVersion", e.target.value)}
                                    placeholder="1.0"
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors ${
                                      !row.subjectVersion?.trim()
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
                                </td>
                                <td className="p-1">
                                  <input
                                    type="number"
                                    min="1"
                                    value={row.orderIndex ?? ""}
                                    onChange={(e) => handleCellChange(idx, "orderIndex", e.target.value ? Number(e.target.value) : "")}
                                    placeholder="1, 2..."
                                    className={`w-full px-2 py-1 text-xs rounded border transition-colors text-right ${
                                      row.orderIndex == null || Number(row.orderIndex) < 1
                                        ? "border-red-400 bg-red-50 text-red-900 focus:ring-1 focus:ring-red-500"
                                        : "border-gray-200 dark:border-gray-700 bg-transparent focus:border-purple-500"
                                    }`}
                                  />
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
                                    title="Xóa dòng này"
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
            Đóng
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
                ? "Không thể import vì còn dòng bị lỗi (Quy tắc Rollback toàn bộ)"
                : "Import dữ liệu hợp lệ vào hệ thống"
            }
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang Import...
              </>
            ) : (
              `Import (${validRows} dòng)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
