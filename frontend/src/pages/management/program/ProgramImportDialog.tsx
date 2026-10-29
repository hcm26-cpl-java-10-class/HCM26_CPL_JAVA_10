import { useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import {
  programApi,
  type TrainingProgramRequest,
} from "@/api/features/program.api";
import { subjectApi } from "@/api/features/subject.api";
import type { SubjectDTO } from "@/types";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImportRow {
  rowNumber: number;
  code: string;
  name: string;
  version: string;
  region: string;
  request?: TrainingProgramRequest;
  error?: string;
  imported?: boolean;
}

interface ProgramImportDialogProps {
  onClose: () => void;
  onImported: () => void;
}

type ImportFormat = "xlsx" | "xls" | "csv" | "txt";

const SUPPORTED_EXTENSIONS = /\.(xlsx|xls|csv|txt)$/i;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getCell(
  row: Record<string, unknown>,
  aliases: string[]
): string {
  const normalizedAliases = aliases.map(normalizeHeader);
  const key = Object.keys(row).find((name) =>
    normalizedAliases.includes(normalizeHeader(name))
  );

  return key ? String(row[key] ?? "").trim() : "";
}

function getFormat(fileName: string): ImportFormat | null {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (
    extension === "xlsx" ||
    extension === "xls" ||
    extension === "csv" ||
    extension === "txt"
  ) {
    return extension;
  }

  return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function ProgramImportDialog({
  onClose,
  onImported,
}: ProgramImportDialogProps) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  const validRows = rows.filter(
    (row) => row.request && !row.error && !row.imported
  );

  const invalidRows = rows.filter((row) => row.error);

  const importedCount = rows.filter((row) => row.imported).length;

  const canImport =
    validRows.length > 0 && !saving && !reading;

  const readFile = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setRows([]);
    setError("");
    setMessage("");

    setReading(true);

    try {
      const format = getFormat(file.name);

      if (!format || !SUPPORTED_EXTENSIONS.test(file.name)) {
        throw new Error(
          "Định dạng không được hỗ trợ. Hãy chọn XLSX, XLS, CSV hoặc TXT."
        );
      }

      if (file.size === 0) {
        throw new Error("File đang trống.");
      }

      const buffer = await file.arrayBuffer();

      let workbook: XLSX.WorkBook;

      if (format === "xlsx" || format === "xls") {
        workbook = XLSX.read(buffer, {
          type: "array",
          cellDates: false,
        });
      } else {
        const text = new TextDecoder("utf-8").decode(buffer);

        if (!text.trim()) {
          throw new Error("File không chứa dữ liệu.");
        }

        workbook = XLSX.read(text, {
          type: "string",
          raw: false,
        });
      }

      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("Không tìm thấy sheet dữ liệu trong file.");
      }

      const sheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json<
        Record<string, unknown>
      >(sheet, {
        defval: "",
        raw: false,
        blankrows: false,
      });

      if (!data.length) {
        throw new Error(
          "Không tìm thấy dữ liệu. Hãy kiểm tra dòng tiêu đề và nội dung file."
        );
      }

      const subjects: SubjectDTO[] =
        await subjectApi.getActiveSubjects();

      const subjectByCode = new Map(
        subjects
          .filter(
            (subject) =>
              subject.id !== undefined &&
              subject.id !== null &&
              subject.code
          )
          .map((subject) => [
            normalizeHeader(subject.code),
            subject,
          ])
      );

      const seenProgramVersions = new Set<string>();

      const parsed: ImportRow[] = data.map((item, index) => {
        const code = getCell(item, [
          "code",
          "program code",
          "programCode",
          "ma chuong trinh",
          "ma ct",
          "mact",
        ]);

        const name = getCell(item, [
          "name",
          "program name",
          "programName",
          "ten chuong trinh",
          "ten ct",
          "tenct",
        ]);

        const version = getCell(item, [
          "version",
          "program version",
          "phien ban",
          "phienban",
        ]);

        const region = getCell(item, [
          "region",
          "khu vuc",
          "khuvuc",
        ]);

        const subjectCodesText = getCell(item, [
          "subject codes",
          "subjectCodes",
          "subject code",
          "subjectCode",
          "ma mon hoc",
          "ma cac mon hoc",
          "mon hoc",
          "monhoc",
          "subjects",
        ]);

        const problems: string[] = [];

        if (!code) problems.push("Thiếu mã chương trình");
        if (!name) problems.push("Thiếu tên chương trình");
        if (!version) problems.push("Thiếu phiên bản");

        if (!subjectCodesText) {
          problems.push("Thiếu mã môn học");
        }

        const codes = subjectCodesText
          .split(/[;,|]/)
          .map((value) => value.trim())
          .filter(Boolean);

        const normalizedCodes = codes.map(normalizeHeader);

        if (
          normalizedCodes.length !==
          new Set(normalizedCodes).size
        ) {
          problems.push("Mã môn học bị trùng");
        }

        const selectedSubjects = codes.map((subjectCode) =>
          subjectByCode.get(normalizeHeader(subjectCode))
        );

        if (
          codes.length > 0 &&
          selectedSubjects.some((subject) => !subject)
        ) {
          problems.push(
            "Có mã môn học không tồn tại hoặc không hoạt động"
          );
        }

        const programVersionKey = [
          normalizeHeader(code),
          normalizeHeader(version),
        ].join("::");

        if (code && version) {
          if (seenProgramVersions.has(programVersionKey)) {
            problems.push(
              "Mã chương trình và phiên bản bị trùng trong file"
            );
          } else {
            seenProgramVersions.add(programVersionKey);
          }
        }

        if (problems.length) {
          return {
            rowNumber: index + 2,
            code,
            name,
            version,
            region,
            error: problems.join("; "),
          };
        }

        return {
          rowNumber: index + 2,
          code,
          name,
          version,
          region,
          request: {
            code,
            name,
            version,
            region: region || undefined,
            subjects: selectedSubjects.map(
              (subject, subjectIndex) => ({
                subjectId: subject!.id!,
                orderIndex: subjectIndex + 1,
              })
            ),
          },
        };
      });

      setRows(parsed);

      const validCount = parsed.filter(
        (row) => row.request && !row.error
      ).length;

      const invalidCount = parsed.filter(
        (row) => row.error
      ).length;

      setMessage(
        `Đọc thành công ${parsed.length} dòng: ${validCount} dòng hợp lệ, ${invalidCount} dòng lỗi.`
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          "Không thể đọc file. Vui lòng kiểm tra lại dữ liệu."
        )
      );
    } finally {
      setReading(false);
      input.value = "";
    }
  };

  const importRows = async () => {
    if (!validRows.length || saving || reading) return;

    setSaving(true);
    setError("");
    setMessage("");

    let success = 0;

    const failedByRow = new Map<number, string>();

    try {
      for (const row of validRows) {
        try {
          await programApi.create(row.request!);
          success++;
        } catch (cause) {
          failedByRow.set(
            row.rowNumber,
            getErrorMessage(
              cause,
              "Không lưu được. Có thể mã và phiên bản đã tồn tại hoặc dữ liệu không hợp lệ."
            )
          );
        }
      }

      setRows((current) =>
        current.map((row) => {
          const failure = failedByRow.get(row.rowNumber);

          if (failure) {
            return {
              ...row,
              error: failure,
              imported: false,
            };
          }

          if (
            row.request &&
            !row.error &&
            validRows.some(
              (candidate) =>
                candidate.rowNumber === row.rowNumber
            )
          ) {
            return {
              ...row,
              imported: true,
            };
          }

          return row;
        })
      );

      const failureCount = failedByRow.size;

      setMessage(
        `Hoàn tất nhập dữ liệu: thành công ${success} chương trình, thất bại ${failureCount} dòng.`
      );

      if (success > 0) {
        onImported();
      }
    } catch (cause) {
      setError(
        getErrorMessage(cause, "Có lỗi xảy ra khi nhập dữ liệu.")
      );
    } finally {
      setSaving(false);
    }
  };

  const resetFile = () => {
    if (saving || reading) return;

    setFileName("");
    setRows([]);
    setError("");
    setMessage("");
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving && !reading) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            Nhập chương trình đào tạo
          </DialogTitle>

          <DialogDescription>
            Hỗ trợ Excel (.xlsx, .xls), CSV và TXT. Dữ liệu cần
            có mã chương trình, tên chương trình, phiên bản và
            mã môn học. Các mã môn học có thể phân cách bằng
            dấu phẩy, chấm phẩy hoặc dấu |.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                {fileName || "Chưa chọn file"}
              </span>

              <input
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="block max-w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
                disabled={reading || saving}
                onChange={readFile}
              />
            </label>

            {fileName && !reading && !saving && (
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
              Đang đọc file và kiểm tra mã môn học…
            </div>
          )}

          {saving && (
            <div
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <LoaderCircle className="size-4 animate-spin" />
              Đang lưu chương trình. Vui lòng không đóng cửa sổ…
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

          {rows.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Tổng số dòng
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {rows.length}
                  </p>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Hợp lệ còn lại
                  </p>
                  <p className="mt-1 text-xl font-semibold text-emerald-600 tabular-nums">
                    {validRows.length}
                  </p>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Dòng lỗi
                  </p>
                  <p className="mt-1 text-xl font-semibold text-destructive tabular-nums">
                    {invalidRows.length}
                  </p>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Đã nhập
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {importedCount}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">
                        Dòng
                      </th>
                      <th className="p-3 text-left">
                        Mã chương trình
                      </th>
                      <th className="p-3 text-left">
                        Tên chương trình
                      </th>
                      <th className="p-3 text-left">
                        Phiên bản
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
                          {row.code || "—"}
                        </td>

                        <td className="max-w-[240px] whitespace-normal break-words p-3">
                          {row.name || "—"}
                        </td>

                        <td className="p-3">
                          {row.version || "—"}
                        </td>

                        <td className="max-w-[300px] whitespace-normal break-words p-3">
                          {row.imported ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="size-4 shrink-0" />
                              Đã nhập thành công
                            </span>
                          ) : row.error ? (
                            <span className="inline-flex items-start gap-1 text-destructive">
                              <AlertCircle className="mt-0.5 size-4 shrink-0" />
                              {row.error}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="size-4 shrink-0" />
                              Hợp lệ
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
                  Những dòng có lỗi sẽ không được gửi để tạo
                  chương trình. Hãy sửa file nguồn và chọn lại
                  file nếu muốn nhập những dòng đó.
                </p>
              )}
            </>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving || reading}
            >
              Đóng
            </Button>

            <Button
              type="button"
              onClick={importRows}
              disabled={!canImport}
            >
              {saving && (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              )}
              Nhập {validRows.length} dòng hợp lệ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
