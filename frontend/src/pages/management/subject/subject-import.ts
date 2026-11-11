import type { ImportResult } from "@/types";
import type { SubjectImportInputRow, SubjectImportPreview } from "@/types/features/subject";

export function importDrafts(preview: SubjectImportPreview): SubjectImportInputRow[] {
  return preview.rows.map((row) => ({ rowNumber: row.rowNumber, values: { ...row.values } }));
}

export function editImportCell(rows: SubjectImportInputRow[], rowNumber: number, column: string, value: string): SubjectImportInputRow[] {
  return rows.map((row) => row.rowNumber === rowNumber ? { ...row, values: { ...row.values, [column]: value } } : row);
}

/** Never retry rows already saved by a previous partial import. */
export function failedImportDrafts(rows: SubjectImportInputRow[], result: ImportResult): SubjectImportInputRow[] {
  const failed = new Set(result.errors.map((error) => error.rowNumber));
  return rows.filter((row) => failed.has(row.rowNumber)).map((row) => ({ ...row, values: { ...row.values } }));
}
