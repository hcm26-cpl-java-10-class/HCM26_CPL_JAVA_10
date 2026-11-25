import * as XLSX from "xlsx";
import axios from "@/api/axios";
import { courseData, courseError, validateCourse, type BackendCourse, type CourseWrite } from "./course-data";

export interface ImportRow { row: number; course?: CourseWrite; error?: string }
export interface ImportPreview { bundle?: ArrayBuffer; updateExisting?: boolean; rows: ImportRow[]; warnings: string[] }
export interface ImportResult { updated?: number; imported: number; skipped: number; failed: number; unattempted: number; rows: { row: number; name: string; status: string; message?: string }[]; warnings: string[] }
const aliases: Record<string, keyof CourseWrite> = {
  "Name": "name", "Course Name": "name", "name": "name", "courseName": "name",
  "Instructor": "instructor", "instructor": "instructor", "Description": "description", "description": "description",
  "Thumbnail URL": "thumbnailUrl", "Thumbnail": "thumbnailUrl", "thumbnailUrl": "thumbnailUrl",
  "Category Codes": "category", "CategoryCodes": "category", "Category": "category", "category": "category",
  "Level": "courseLevel", "courseLevel": "courseLevel", "Status": "publicationStatus", "publicationStatus": "publicationStatus",
  "Instructor Email": "instructorEmail", "InstructorEmail": "instructorEmail", "instructorEmail": "instructorEmail",
  "Active": "isActive", "isActive": "isActive",
};
const readOnly = new Set(["ID", "id", "Created At", "createdAt", "Updated At", "updatedAt"]);
const nameKey = (name: string) => name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
function active(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value === "boolean") return value;
  if (["true", "1", "active", "yes"].includes(String(value).trim().toLowerCase())) return true;
  if (["false", "0", "inactive", "no"].includes(String(value).trim().toLowerCase())) return false;
  throw new Error("Active must be true/false, 1/0, Active/Inactive, or Yes/No.");
}

export function previewCourseRows(rows: Record<string, unknown>[], firstRow = 2): ImportPreview {
  const warnings = new Set<string>();
  const mapped = rows.map((row, index): ImportRow => {
    const supported: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (aliases[key]) {
        const field = aliases[key];
        if (field in supported && supported[field] !== value) return { row: firstRow + index, error: `Conflicting columns for ${field}.` };
        supported[field] = value;
      } else if (readOnly.has(key)) warnings.add(`${key}: read-only; generated backend values are preserved.`);
      else if (!key.startsWith("__")) warnings.add(`${key}: unsupported and will not be persisted.`);
    }
    try {
      for (const field of ["name", "instructor", "description", "thumbnailUrl", "category", "courseLevel", "publicationStatus", "instructorEmail"]) {
        if (supported[field] != null && typeof supported[field] !== "string") throw new Error(`${field} must be text.`);
      }
      const course = validateCourse({ ...supported, isActive: active(supported.isActive) } as CourseWrite);
      if (supported.isActive === undefined || supported.isActive === "") warnings.add("Missing Active values default to true; this does not set publication status.");
      return { row: firstRow + index, course };
    } catch (error) { return { row: firstRow + index, error: courseError(error) }; }
  });
  return { rows: mapped, warnings: [...warnings] };
}

export function previewCourseWorkbook(buffer: ArrayBuffer): ImportPreview {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.SheetNames.find(name => name.trim().toLowerCase() === "courses");
  if (!sheet) throw new Error("The workbook must contain a Courses sheet.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheet], { defval: "" });
  if (!rows.length) throw new Error("The Courses sheet contains no course records.");
  const preview = previewCourseRows(rows);
  // SheetJS carries actual Excel row positions even when blank rows are omitted.
  preview.rows.forEach((row, i) => { row.row = Number(rows[i].__rowNum__) + 1; });
  if (workbook.SheetNames.includes("Sections") && workbook.SheetNames.includes("Lessons")) {
    preview.bundle = buffer;
    preview.warnings.push("Courses, Sections and Lessons will be linked and persisted by the backend. Existing records are skipped; ReadMe is documentation only.");
  } else for (const name of workbook.SheetNames.filter(name => name !== sheet && name.toLowerCase() !== "readme")) preview.warnings.push(`${name} sheet: not imported without both Sections and Lessons sheets.`);
  return preview;
}

const sameMetadata = (existing: BackendCourse | CourseWrite, incoming: CourseWrite) =>
  ["description", "instructor", "thumbnailUrl", "isActive", "category", "courseLevel", "publicationStatus", "instructorEmail"].every(field => {
    const a = existing[field as keyof CourseWrite]; const b = incoming[field as keyof CourseWrite];
    return (a ?? "") === (b ?? "");
  });

export async function persistCourseImport(preview: ImportPreview, isCurrentSession: () => boolean = () => true): Promise<ImportResult> {
  if (preview.bundle) {
    if (!isCurrentSession()) throw new Error("Your account session changed. Reopen the import.");
    const form = new FormData(); form.append("file", new Blob([preview.bundle]), "course-bundle.xlsx");
    form.append("updateExisting", String(!!preview.updateExisting));
    const { data } = await axios.post("/courses/import-bundle", form, { headers: { "Content-Type": "multipart/form-data" } });
    return { updated:data.updatedCount, imported: data.successCount, skipped: data.skippedCount, failed: data.failureCount, unattempted: 0,
      rows: (data.errors || []).map((error: { rowNumber: number; message: string }) => ({ row: error.rowNumber, name: "", status: "failed", message: error.message })),
      warnings: ["Counts include Course, Section and Lesson records. Existing records are updated only when explicitly enabled; Sections and Lessons are never overwritten."] };
  }
  const result: ImportResult = { imported: 0, skipped: 0, failed: 0, unattempted: 0, rows: [], warnings: preview.warnings };
  // Complete preflight before the first POST; there is no delete/update operation.
  const existing = await courseData.all();
  const byName = new Map<string, (BackendCourse | CourseWrite)[]>();
  for (const course of existing) byName.set(nameKey(course.name), [...(byName.get(nameKey(course.name)) || []), course]);
  let stopped = false;
  for (const row of preview.rows) {
    const name = row.course?.name || "";
    if (row.error || !row.course) { result.failed++; result.rows.push({ row: row.row, name, status: "failed", message: row.error }); continue; }
    if (stopped || !isCurrentSession()) { result.unattempted++; result.rows.push({ row: row.row, name, status: "not attempted", message: "Import stopped; reload and review before retrying." }); continue; }
    const key = nameKey(name);
    const matches = byName.get(key) || [];
    if (matches.length) {
      const duplicate = matches.length === 1 && sameMetadata(matches[0], row.course);
      if (duplicate) result.skipped++; else result.failed++;
      result.rows.push({ row: row.row, name, status: duplicate ? "skipped" : "failed", message: duplicate ? "Already persisted with the same supported fields." : "Conflicting or ambiguous normalized name; existing records were not changed." });
      continue;
    }
    try {
      const created = await courseData.create(row.course);
      result.imported++; byName.set(key, [created]);
      result.rows.push({ row: row.row, name, status: "imported" });
    } catch (error) {
      result.failed++; result.rows.push({ row: row.row, name, status: "failed", message: courseError(error) });
      // Do not blindly retry an uncertain write or continue after lost authorization/network.
      stopped = true;
    }
  }
  return result;
}

export function courseWorkbook(records: BackendCourse[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(records.map(c => ({
    ID: c.id, Name: c.name, Instructor: c.instructor ?? "", Description: c.description ?? "", "Thumbnail URL": c.thumbnailUrl ?? "",
    Active: c.isActive, "Category Codes": c.category ?? "", Level: c.courseLevel ?? "", Status: c.publicationStatus ?? "", "Instructor Email": c.instructorEmail ?? "", "Created At": c.createdAt ?? "",
  })), { header: ["ID", "Name", "Instructor", "Description", "Thumbnail URL", "Active", "Category Codes", "Level", "Status", "Instructor Email", "Created At"] }), "Courses");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Course export limitations"], ["Source: current backend Course records, all pages; no browser-local Course records."],
    ["Category Codes, Level, Status (publication), and Instructor Email are persisted Course metadata. Blank values mean no metadata was supplied."],
    ["Active is a separate boolean and never means Published. IDs and audit dates are read-only."],
    ["Sections and Lessons are not part of this Course export/import."],
  ]), "Readme");
  return workbook;
}
