import { useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { programApi } from "@/api/features/program.api";
import type { ProgramImportPreview } from "@/types/features/content";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ProgramImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

const SUPPORTED_EXTENSIONS = /\.(xlsx|xls|csv|txt)$/i;

function getErrorMessage(error: any, fallback: string): string {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message) return error.message;
  return fallback;
}

export function ProgramImportDialog({
  open,
  onClose,
  onImported,
}: ProgramImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProgramImportPreview | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const rows = preview?.rows ?? [];
  const invalidRows = rows.filter((row) => !row.valid);

  const canImport =
    !!file &&
    !!preview?.canImport &&
    preview.invalidRows === 0 &&
    preview.validRows > 0 &&
    !reading &&
    !saving;

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];

    if (!selectedFile) return;

    setFile(null);
    setPreview(null);
    setError("");
    setMessage("");

    try {
      if (!SUPPORTED_EXTENSIONS.test(selectedFile.name)) {
        throw new Error("Định dạng không được hỗ trợ. Hãy chọn XLSX, XLS, CSV hoặc TXT.");
      }

      if (selectedFile.size === 0) {
        throw new Error("File đang trống.");
      }

      setFile(selectedFile);
      setReading(true);

      const result = await programApi.previewImport(selectedFile);
      setPreview(result);

      setMessage(
        `Kiểm tra hoàn tất: ${result.totalRows} dòng, ` +
          `${result.validRows} dòng hợp lệ, ` +
          `${result.invalidRows} dòng có lỗi.`
      );
    } catch (cause) {
      setFile(null);
      setPreview(null);
      setError(getErrorMessage(cause, "Không thể kiểm tra file. Vui lòng kiểm tra lại dữ liệu."));
    } finally {
      setReading(false);
      input.value = "";
    }
  };

  const handleImportFile = async () => {
    if (!file || !canImport || saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await programApi.importFile(file);
      setMessage(result.message || `Đã nhập thành công ${result.importedPrograms} chương trình.`);
      onImported();
      onClose();
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể nhập dữ liệu. Vui lòng kiểm tra lại file."));
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = async () => {
    if (downloadingTemplate || saving || reading) return;

    setDownloadingTemplate(true);
    setError("");

    try {
      const blob = await programApi.downloadImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "training-program-import-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (cause) {
      setError(getErrorMessage(cause, "Không thể tải file mẫu. Vui lòng thử lại."));
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const resetFile = () => {
    if (saving || reading) return;
    setFile(null);
    setPreview(null);
    setError("");
    setMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập danh sách chương trình đào tạo</DialogTitle>
          <DialogDescription>
            Tải lên file Excel, CSV hoặc TXT chứa cấu trúc chương trình đào tạo kèm danh sách môn học.
            Dữ liệu sẽ được kiểm tra trước khi nhập vào hệ thống.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3">
            <div>
              <p className="text-sm font-medium">Chưa có file mẫu chuẩn?</p>
              <p className="text-xs text-muted-foreground">
                Tải file Excel mẫu để đảm bảo đúng định dạng cột: Mã CT, Version CT, Mã môn, Version môn, Thứ tự.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              disabled={downloadingTemplate || saving || reading}
            >
              {downloadingTemplate ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              Tải file mẫu XLSX
            </Button>
          </div>

          <label
            htmlFor="program-file-input"
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            <FileUp className="mb-2 size-8 text-muted-foreground" />
            <span className="text-sm font-medium">Nhấp để chọn file hoặc kéo thả vào đây</span>
            <span className="mt-1 text-xs text-muted-foreground">
              Hỗ trợ: XLSX, XLS, CSV, TXT (tối đa 10MB)
            </span>
            <input
              id="program-file-input"
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={readFile}
              disabled={reading || saving}
            />
          </label>

          {file && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span className="font-mono text-xs font-semibold">{file.name}</span>
              <Button type="button" variant="ghost" size="sm" onClick={resetFile} disabled={saving || reading}>
                <RefreshCw className="mr-1 size-3" /> Chọn file khác
              </Button>
            </div>
          )}

          {reading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Đang phân tích cấu trúc file...
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && !error && (
            <Alert>
              <CheckCircle2 className="size-4 text-emerald-600" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="rounded-lg border bg-muted/30 p-2">
                  <div className="text-muted-foreground uppercase text-[10px]">Tổng số dòng</div>
                  <div className="text-lg font-bold">{preview.totalRows}</div>
                </div>
                <div className="rounded-lg border bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-400">
                  <div className="uppercase text-[10px]">Hợp lệ</div>
                  <div className="text-lg font-bold">{preview.validRows}</div>
                </div>
                <div className="rounded-lg border bg-rose-500/10 p-2 text-rose-700 dark:text-rose-400">
                  <div className="uppercase text-[10px]">Lỗi</div>
                  <div className="text-lg font-bold">{preview.invalidRows}</div>
                </div>
              </div>

              {invalidRows.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    File có dữ liệu chưa hợp lệ. Vui lòng sửa các dòng lỗi trong file nguồn rồi chọn lại file. Hệ thống sẽ không nhập một phần dữ liệu.
                  </AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-lg border max-h-[300px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Dòng</th>
                      <th className="p-2 text-left">Mã CT</th>
                      <th className="p-2 text-left">Version CT</th>
                      <th className="p-2 text-left">Mã Topic</th>
                      <th className="p-2 text-left">Version Topic</th>
                      <th className="p-2 text-left">Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t">
                        <td className="p-2 font-mono">{row.rowNumber}</td>
                        <td className="p-2 font-mono font-semibold">{row.programCode || "—"}</td>
                        <td className="p-2 font-mono">{row.programVersion || "—"}</td>
                        <td className="p-2 font-mono text-primary font-semibold">{row.subjectCode || "—"}</td>
                        <td className="p-2 font-mono">{row.subjectVersion || "—"}</td>
                        <td className="p-2">
                          {row.valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                              <CheckCircle2 className="size-3.5" /> Hợp lệ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive font-medium">
                              <AlertCircle className="size-3.5" />
                              {row.errors?.join("; ") || "Lỗi dữ liệu"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving || reading}>
              Đóng
            </Button>
            <Button type="button" onClick={handleImportFile} disabled={!canImport}>
              {saving && <LoaderCircle className="mr-2 size-4 animate-spin" />}
              Xác nhận nhập ({preview?.validRows ?? 0} dòng hợp lệ)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
