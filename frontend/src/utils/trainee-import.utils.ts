import * as XLSX from "xlsx";
import type { TraineeImportRow } from "@/api/features/class-enrollment.api";
import { excelDate, isIsoDate } from "./class-import.utils";

export const TRAINEE_IMPORT_HEADERS = ["FPT Student ID*", "Full Name*", "Personal Email", "National ID", "DOB", "Gender"];
export const MAX_TRAINEE_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_TRAINEE_IMPORT_ROWS = 500;
export interface TraineeImportIssue { rowNumber?: number; field: string; message: string }
const normalize = (value: unknown) => String(value ?? "").replace(/\*/g, "").trim().toLowerCase();
const text = (value: unknown) => String(value ?? "").trim();
const fields = ["studentId", "fullName", "personalEmail", "nationalId", "dob", "gender"] as const;

export function traineeTemplate(): XLSX.WorkBook {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([TRAINEE_IMPORT_HEADERS]);
    sheet["!cols"] = TRAINEE_IMPORT_HEADERS.map(() => ({ wch: 25 }));
    XLSX.utils.book_append_sheet(book, sheet, "Trainees");
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
        ["Required", "FPT Student ID and Full Name must match an existing active master student."],
        ["Optional", "Email, National ID, DOB and Gender verify existing profile values; they never update a profile."],
        ["National ID", "Leave blank unless you have USER_READ permission."],
        ["DOB", "YYYY-MM-DD or a valid Excel date cell."], ["Gender", "Male, Female or Other; blank is allowed."],
        ["Limits", "XLSX only, at most 2 MB and 500 rows. Atomic: every row must be valid."],
    ]), "Instructions");
    return book;
}

export function parseTraineeWorkbook(book: XLSX.WorkBook): { rows: TraineeImportRow[]; issues: TraineeImportIssue[] } {
    const issues: TraineeImportIssue[] = [];
    const rows: TraineeImportRow[] = [];
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet?.["!ref"]) return { rows, issues: [{ field: "file", message: "The workbook is empty." }] };
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    if (range.e.r - range.s.r > MAX_TRAINEE_IMPORT_ROWS || range.e.c > 20)
        return { rows, issues: [{ field: "file", message: "Use at most 500 data rows and the template columns only." }] };
    const cells = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: true });
    const headers = (cells[0] ?? []).map(normalize);
    for (const label of ["fpt student id", "full name"]) {
        if (!headers.includes(label)) issues.push({ field: "header", message: `Missing required column: ${label}.` });
    }
    const accepted = TRAINEE_IMPORT_HEADERS.map(normalize);
    headers.forEach((header, i) => {
        if (header && !accepted.includes(header)) issues.push({ field: "header", message: "Unknown column; use the downloaded template." });
        if (header && headers.indexOf(header) !== i) issues.push({ field: "header", message: "Duplicate column header." });
    });
    const codes = new Map<string, number[]>();
    cells.slice(1).forEach((values, index) => {
        if (values.every(v => !text(v))) return;
        const rowNumber = range.s.r + index + 2;
        const value = (field: number) => values[headers.indexOf(accepted[field])];
        const row: TraineeImportRow = { rowNumber, studentId: text(value(0)).toUpperCase(), fullName: text(value(1)),
            personalEmail: text(value(2)), nationalId: text(value(3)),
            dob: excelDate(value(4), !!book.Workbook?.WBProps?.date1904), gender: text(value(5)) };
        const issue = (field: string, message: string) => issues.push({ rowNumber, field, message });
        headers.forEach((header, col) => {
            if (header && sheet[XLSX.utils.encode_cell({ r: range.s.r + index + 1, c: range.s.c + col })]?.f)
                issue(fields[accepted.indexOf(header)] ?? "row", "Formula cells are not accepted.");
        });
        if (!/^[A-Z0-9_-]{2,64}$/.test(row.studentId)) issue("studentId", "FPT Student ID is required (2–64 letters, digits, underscores or hyphens).");
        if (!row.fullName || row.fullName.length > 100) issue("fullName", "Full Name is required (maximum 100 characters).");
        if (row.personalEmail && (row.personalEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.personalEmail))) issue("personalEmail", "Invalid email address.");
        if (row.nationalId && !/^\d{9,12}$/.test(row.nationalId)) issue("nationalId", "National ID must contain 9–12 digits if supplied.");
        if (row.dob && (!isIsoDate(row.dob) || row.dob > new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }))) issue("dob", "Use a valid past DOB in YYYY-MM-DD format or an Excel date cell.");
        if (row.gender && !["male", "female", "other"].includes(row.gender.toLowerCase())) issue("gender", "Gender must be Male, Female or Other.");
        codes.set(row.studentId, [...(codes.get(row.studentId) ?? []), rowNumber]);
        rows.push(row);
    });
    for (const duplicates of codes.values()) if (duplicates.length > 1) for (const rowNumber of duplicates)
        issues.push({ rowNumber, field: "studentId", message: "Duplicate Student ID within the file." });
    if (!rows.length) issues.push({ field: "file", message: "The workbook has no trainee rows." });
    return { rows, issues };
}

export function readTraineeFile(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error("The selected file could not be read."));
        reader.readAsArrayBuffer(file);
    });
}
