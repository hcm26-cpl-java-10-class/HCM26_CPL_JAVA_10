import { useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import {
  programApi,
  type ProgramImportPreview,
} from "@/api/features/program.api";

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
  onClose: () => void;
  onImported: () => void;
}

const SUPPORTED_EXTENSIONS = /\.(xlsx|xls|csv|txt)$/i;

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            message?: string;
            error?: string;
          };
        };
      }
    ).response;

    const serverMessage =
      response?.data?.message || response?.data?.error;

    if (serverMessage) return serverMessage;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function ProgramImportDialog({
  onClose,
  onImported,
}: ProgramImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] =
    useState<ProgramImportPreview | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] =
    useState(false);

  const rows = preview?.rows ?? [];

  const validRows = rows.filter((row) => row.valid);
  const invalidRows = rows.filter((row) => !row.valid);

  const canImport =
    !!file &&
    !!preview?.canImport &&
    preview.invalidRows === 0 &&
    preview.validRows > 0 &&
    !reading &&
    !saving;

  const readFile = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const selectedFile = input.files?.[0];

    if (!selectedFile) return;

    setFile(null);
    setPreview(null);
    setError("");
    setMessage("");

    try {
      if (!SUPPORTED_EXTENSIONS.test(selectedFile.name)) {
        throw new Error(
          "Định dạng không được hỗ trợ. Hãy chọn XLSX, XLS, CSV hoặc TXT."
        );
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

      setError(
        getErrorMessage(
          cause,
          "Không thể kiểm tra file. Vui lòng kiểm tra lại dữ liệu."
        )
      );
    } finally {
      setReading(false);
      input.value = "";
    }
  };

  const importFile = async () => {
    if (!file || !canImport || saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await programApi.importFile(file);

      setMessage(
        result.message ||
          `Đã nhập thành công ${result.importedPrograms} chương trình.`
      );

      onImported();
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          "Không thể nhập dữ liệu. Vui lòng kiểm tra lại file."
        )
      );
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
      setError(
        getErrorMessage(
          cause,
          "Không thể tải file mẫu. Vui lòng thử lại."
        )
      );
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

  const handleClose = () => {
    if (saving || reading || downloadingTemplate) return;
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            Nhập chương trình đào tạo
          </DialogTitle>

          <DialogDescription>
            Hỗ trợ Excel (.xlsx, .xls), CSV và TXT. Mỗi dòng
            dữ liệu tương ứng với một môn học thuộc chương
            trình. File cần có 7 cột: mã chương trình, tên
            chương trình, phiên bản chương trình, khu vực,
            mã môn học, phiên bản môn học và thứ tự môn học.
            Hãy tải file mẫu để sử dụng đúng cấu trúc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Vui lòng sử dụng đúng cấu trúc file import.
            </p>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              disabled={
                downloadingTemplate || reading || saving
              }
            >
              {downloadingTemplate ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              Tải file mẫu
            </Button>
          </div>

          <div className="rounded-xl border border-dashed bg-muted/20 p-5">
            <label className="flex cursor-pointer flex-col items-center gap-3 text-center">
              <div className="rounded-full bg-primary/10 p-3">
                <FileUp className="size-7 text-primary" />
              </div>

              <div>
                <p className="font-medium">
                  Chọn file dữ liệu
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  XLSX, XLS, CSV hoặc TXT
                </p>
              </div>

              <span className="max-w-full break-all text-sm text-muted-foreground">
                {file?.name || "Chưa chọn file"}
              </span>

              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="block max-w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
                disabled={
                  reading ||
                  saving ||
                  downloadingTemplate
                }
                onChange={readFile}
              />
            </label>

            {file && !reading && !saving && (
              <div className="mt-3 flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFile}
                >
                  <RefreshCw className="mr-2 size-4" />
                  Chọn file khác
                </Button>
              </div>
            )}
          </div>

          {reading && (
            <div
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" />
              Đang gửi file lên hệ thống để kiểm tra dữ liệu…
            </div>
          )}

          {saving && (
            <div
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" />
              Đang nhập toàn bộ chương trình. Vui lòng không đóng cửa sổ…
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {preview && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Tổng số dòng
                  </p>

                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {preview.totalRows}
                  </p>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Dòng hợp lệ
                  </p>

                  <p className="mt-1 text-xl font-semibold text-emerald-600 tabular-nums">
                    {preview.validRows}
                  </p>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Dòng lỗi
                  </p>

                  <p className="mt-1 text-xl font-semibold text-destructive tabular-nums">
                    {preview.invalidRows}
                  </p>
                </div>
              </div>

              {preview.canImport ? (
                <Alert>
                  <CheckCircle2 className="size-4" />
                  <AlertDescription>
                    Dữ liệu hợp lệ. Bạn có thể xác nhận để
                    nhập toàn bộ {preview.validRows} dòng dữ liệu.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    File có dữ liệu chưa hợp lệ. Vui lòng sửa
                    các dòng lỗi trong file nguồn rồi chọn
                    lại file. Hệ thống sẽ không nhập một phần
                    dữ liệu.
                  </AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">
                        Dòng
                      </th>

                      <th className="p-3 text-left">
                        Mã chương trình
                      </th>

                      <th className="p-3 text-left">
                        Phiên bản CT
                      </th>

                      <th className="p-3 text-left">
                        Mã môn học
                      </th>

                      <th className="p-3 text-left">
                        Phiên bản môn
                      </th>

                      <th className="p-3 text-left">
                        Kết quả kiểm tra
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className="border-t align-top"
                      >
                        <td className="p-3 tabular-nums">
                          {row.rowNumber}
                        </td>

                        <td className="p-3 font-mono text-xs">
                          {row.programCode || "—"}
                        </td>

                        <td className="p-3">
                          {row.programVersion || "—"}
                        </td>

                        <td className="p-3 font-mono text-xs">
                          {row.subjectCode || "—"}
                        </td>

                        <td className="p-3">
                          {row.subjectVersion || "—"}
                        </td>

                        <td className="max-w-[320px] whitespace-normal break-words p-3">
                          {row.valid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="size-4 shrink-0" />
                              Hợp lệ
                            </span>
                          ) : (
                            <span className="inline-flex items-start gap-1 text-destructive">
                              <AlertCircle className="mt-0.5 size-4 shrink-0" />
                              <span>
                                {row.errors?.length
                                  ? row.errors.join("; ")
                                  : "Dữ liệu không hợp lệ"}
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {invalidRows.length > 0 && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Có {invalidRows.length} dòng chưa hợp lệ.
                  Hãy sửa file nguồn và thực hiện kiểm tra lại
                  trước khi nhập.
                </p>
              )}

              {validRows.length > 0 &&
                invalidRows.length === 0 && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Khi xác nhận, toàn bộ dữ liệu sẽ được gửi
                    lên backend để nhập trong một transaction.
                    Nếu xảy ra lỗi, hệ thống sẽ không lưu một
                    phần dữ liệu.
                  </p>
                )}
            </>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={
                saving ||
                reading ||
                downloadingTemplate
              }
            >
              Đóng
            </Button>

            <Button
              type="button"
              onClick={importFile}
              disabled={!canImport}
            >
              {saving && (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              )}

              Xác nhận nhập {preview?.validRows ?? 0} dòng
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}