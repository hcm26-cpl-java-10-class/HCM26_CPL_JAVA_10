
import { useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { AlertCircle, CheckCircle2, FileUp, LoaderCircle } from "lucide-react";
import { programApi, type TrainingProgramRequest } from "@/api/features/program.api";
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
  request?: TrainingProgramRequest;
  error?: string;
}

interface ProgramImportDialogProps {
  onClose: () => void;
  onImported: () => void;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getCell(
  row: Record<string, unknown>,
  aliases: string[]
): string {
  const key = Object.keys(row).find((name) =>
    aliases.includes(normalizeHeader(name))
  );
  return key ? String(row[key] ?? "").trim() : "";
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

  const validRows = rows.filter((row) => row.request && !row.error);
  const invalidRows = rows.filter((row) => row.error);
  const canImport = validRows.length > 0 && !saving && !reading;

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setRows([]);
    setError("");
    setMessage("");
    setReading(true);

    try {
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        throw new Error("Vui lòng chọn file Excel .xlsx hoặc .xls.");
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("File không có sheet dữ liệu.");
      }

      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        sheet,
        { defval: "" }
      );

      if (!data.length) {
        throw new Error("Sheet không có dữ liệu.");
      }

      const subjects: SubjectDTO[] = await subjectApi.getActiveSubjects();
      const subjectByCode = new Map(
        subjects
          .filter((subject) => subject.id !== undefined)
          .map((subject) => [normalizeHeader(subject.code), subject])
      );

      const parsed: ImportRow[] = data.map((item, index) => {
        const code = getCell(item, ["mac huongtrinh", "code", "programcode", "mact"]);
        const name = getCell(item, ["tenchuongtrinh", "name", "programname", "tenct"]);
        const version = getCell(item, ["phienban", "version"]);
        const region = getCell(item, ["khuvuc", "region"]);
        const subjectCodesText = getCell(item, [
          "macmonhoc",
          "subjectcodes",
          "subjectcode",
          "monhoc",
        ]);

        const problems: string[] = [];

        if (!code) problems.push("Thiếu mã chương trình");
        if (!name) problems.push("Thiếu tên chương trình");
        if (!version) problems.push("Thiếu phiên bản");
        if (!subjectCodesText) problems.push("Thiếu mã môn học");

        const codes = subjectCodesText
          .split(/[;,]/)
          .map((value) => value.trim())
          .filter(Boolean);

        if (codes.length && codes.length !== new Set(codes.map(normalizeHeader)).size) {
          problems.push("Mã môn học bị trùng");
        }

        const selectedSubjects = codes.map((subjectCode) =>
          subjectByCode.get(normalizeHeader(subjectCode))
        );

        if (selectedSubjects.some((subject) => !subject)) {
          problems.push("Có mã môn học không tồn tại hoặc không hoạt động");
        }

        if (problems.length) {
          return {
            rowNumber: index + 2,
            error: problems.join("; "),
          };
        }

        return {
          rowNumber: index + 2,
          request: {
            code,
            name,
            version,
            region: region || undefined,
            subjects: selectedSubjects.map((subject, subjectIndex) => ({
              subjectId: subject!.id!,
              orderIndex: subjectIndex + 1,
            })),
          },
        };
      });

      setRows(parsed);
      setMessage(
        `Đọc ${parsed.length} dòng: ${parsed.length - parsed.filter((r) => r.error).length} dòng hợp lệ, ${parsed.filter((r) => r.error).length} dòng lỗi.`
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể đọc file. Vui lòng kiểm tra định dạng."
      );
    } finally {
      setReading(false);
      event.target.value = "";
    }
  };

  const importRows = async () => {
    if (!validRows.length) return;

    setSaving(true);
    setError("");

    let success = 0;
    const failed: ImportRow[] = [];

    try {
      for (const row of validRows) {
        try {
          await programApi.create(row.request!);
          success++;
        } catch {
          failed.push({
            ...row,
            error: "Backend từ chối lưu. Có thể mã + phiên bản đã tồn tại hoặc dữ liệu không hợp lệ.",
          });
        }
      }

      setRows((current) =>
        current.map((row) => {
          const failure = failed.find(
            (item) => item.rowNumber === row.rowNumber
          );
          return failure ? { ...row, error: failure.error } : row;
        })
      );

      setMessage(
        `Đã tạo thành công ${success} chương trình; ${failed.length} dòng không lưu được.`
      );

      if (success > 0) onImported();
    } catch {
      setError("Có lỗi khi nhập dữ liệu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nhập chương trình từ Excel</DialogTitle>
          <DialogDescription>
            Chọn file .xlsx hoặc .xls. Mỗi dòng là một chương trình; cột
            Mã môn học chứa các mã môn được phân cách bằng dấu chấm phẩy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed p-5">
            <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
              <FileUp className="size-8 text-muted-foreground" />
              <span className="font-medium">Chọn file Excel</span>
              <span className="text-xs text-muted-foreground">
                {fileName || "Chưa chọn file"}
              </span>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="mt-2 block max-w-full text-sm"
                disabled={reading || saving}
                onChange={readFile}
              />
            </label>
          </div>

          {reading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Đang đọc và kiểm tra file…
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert>
              <CheckCircle2 />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Dòng Excel</th>
                    <th className="p-2 text-left">Mã chương trình</th>
                    <th className="p-2 text-left">Tên chương trình</th>
                    <th className="p-2 text-left">Kết quả kiểm tra</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rowNumber} className="border-t">
                      <td className="p-2">{row.rowNumber}</td>
                      <td className="p-2">
                        {row.request?.code ?? "—"}
                      </td>
                      <td className="p-2">
                        {row.request?.name ?? "—"}
                      </td>
                      <td className="p-2">
                        {row.error ? (
                          <span className="text-destructive">{row.error}</span>
                        ) : (
                          <span className="text-emerald-600">Hợp lệ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invalidRows.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Các dòng lỗi sẽ không được gửi để tạo chương trình.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving || reading}
            >
              Đóng
            </Button>
            <Button
              onClick={importRows}
              disabled={!canImport}
            >
              {saving && <LoaderCircle className="animate-spin" />}
              Nhập {validRows.length} dòng hợp lệ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
