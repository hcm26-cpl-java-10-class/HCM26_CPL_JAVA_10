import { departmentApi, userApi } from "@/api";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  createUserImportTemplate,
  parseUserImportFile,
  validateUserImportRows,
  type UserImportRow,
} from "../user-dataio.utils";

interface UserImportModalProps {
  open: boolean;
  isImporting: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (rows: UserImportRow[]) => Promise<void>;
}

async function fetchAllUsers() {
  const firstPage = await userApi.getPage({ page: 0, size: 500 }, undefined, { ids: [] });
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
      userApi.getPage({ page: index + 1, size: 500 }, undefined, { ids: [] }),
    ),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.content ?? page.items ?? []);
}

export function UserImportModal({
  open,
  isImporting,
  onOpenChange,
  onImport,
}: UserImportModalProps) {
  const [rows, setRows] = useState<UserImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const usersQuery = useQuery({
    queryKey: ["user", "import-email-validation"],
    queryFn: fetchAllUsers,
    enabled: open,
  });
  const departmentsQuery = useQuery({
    queryKey: ["department", "options"],
    queryFn: () => departmentApi.getPage({ page: 0, size: 500 }),
    enabled: open,
  });

  const existingEmails = new Set(
    (usersQuery.data ?? [])
      .map((user) => user.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)),
  );
  const departmentCodes = new Set(
    (departmentsQuery.data?.content ?? departmentsQuery.data?.items ?? [])
      .map((department) => department.code?.trim().toLowerCase())
      .filter((code): code is string => Boolean(code)),
  );
  const validatedRows = validateUserImportRows(rows, existingEmails, departmentCodes);
  const validRows = validatedRows.filter((row) => row.errors.length === 0);

  const processFile = async (file?: File) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv" && extension !== "xlsx") {
      setError("Chỉ hỗ trợ file CSV hoặc XLSX.");
      return;
    }

    setIsParsing(true);
    setError("");
    setFileName(file.name);
    try {
      const parsedRows = await parseUserImportFile(file);
      setRows(parsedRows);
    } catch (parseError) {
      setRows([]);
      setError(
        parseError instanceof Error ? parseError.message : "Không thể đọc nội dung file.",
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void processFile(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void processFile(event.dataTransfer.files?.[0]);
  };

  const closeModal = (nextOpen: boolean) => {
    if (isImporting || isParsing) return;
    onOpenChange(nextOpen);
  };

  const handleImport = async () => {
    if (validRows.length === 0 || usersQuery.isError || departmentsQuery.isError) return;
    await onImport(validRows);
  };

  const handleDownloadTemplate = () => {
    downloadBlob(createUserImportTemplate(), "user-import-template.csv");
  };

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Nhập danh sách người dùng từ file</DialogTitle>
          <DialogDescription>
            Tải file mẫu, điền thông tin người dùng rồi tải file CSV hoặc XLSX để xem trước.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-1">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">File mẫu</p>
              <p className="mt-1 text-xs text-slate-500">
                Cột: EmployeeCode, FullName, Email, Role, Department
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadTemplate}
              className="shrink-0 gap-2"
            >
              <Download className="size-4" />
              Tải file mẫu (.csv)
            </Button>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Chọn hoặc kéo thả file CSV hoặc XLSX"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${
              isDragging
                ? "border-orange-500 bg-orange-50"
                : "border-slate-300 bg-white hover:border-orange-400 hover:bg-orange-50/40"
            }`}
          >
            <Upload className="size-7 text-orange-600" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-800">
              Kéo thả file vào đây hoặc bấm để chọn
            </p>
            <p className="text-xs text-slate-500">Hỗ trợ CSV, XLSX</p>
            <Input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {fileName && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FileSpreadsheet className="size-4 text-orange-600" />
              <span>{fileName}</span>
              {isParsing && <span className="text-slate-400">Đang đọc file...</span>}
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          {(usersQuery.isError || departmentsQuery.isError) && (
            <p role="alert" className="text-sm text-red-600">
              Không thể kiểm tra email hoặc phòng ban hiện có. Vui lòng tải lại trang rồi thử lại.
            </p>
          )}

          {validatedRows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Xem trước dữ liệu</h3>
                <p className="text-xs text-slate-600">
                  Hợp lệ: <span className="font-semibold text-emerald-700">{validRows.length}</span>
                  {" · "}
                  Lỗi:{" "}
                  <span className="font-semibold text-red-600">
                    {validatedRows.length - validRows.length}
                  </span>
                </p>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500 shadow-sm">
                    <tr>
                      <th className="px-3 py-2">Mã NV/HV</th>
                      <th className="px-3 py-2">Họ tên</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Vai trò</th>
                      <th className="px-3 py-2">Trạng thái hợp lệ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validatedRows.map((row) => (
                      <tr
                        key={`${row.rowNumber}-${row.email}`}
                        className={row.errors.length ? "bg-red-50/70" : ""}
                      >
                        <td className="px-3 py-2.5">{row.employeeCode || "—"}</td>
                        <td className="px-3 py-2.5">{row.fullName || "—"}</td>
                        <td className="px-3 py-2.5">{row.email || "—"}</td>
                        <td className="px-3 py-2.5">{row.role || "—"}</td>
                        <td className="px-3 py-2.5">
                          {row.errors.length === 0 ? (
                            <span className="font-medium text-emerald-700">Hợp lệ</span>
                          ) : (
                            <ul className="list-inside list-disc text-xs text-red-600">
                              {row.errors.map((rowError) => (
                                <li key={rowError}>{rowError}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                Lưu ý: backend hiện chưa lưu EmployeeCode khi import người dùng; các trường khác sẽ
                được gửi qua luồng import chuẩn.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => closeModal(false)}
            disabled={isImporting || isParsing}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={
              validRows.length === 0 ||
              isImporting ||
              isParsing ||
              usersQuery.isLoading ||
              departmentsQuery.isLoading ||
              usersQuery.isError ||
              departmentsQuery.isError
            }
            className="bg-orange-600 text-white hover:bg-orange-700"
          >
            {isImporting
              ? "Đang nhập..."
              : `Xác nhận nhập ${validRows.length} người dùng`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
