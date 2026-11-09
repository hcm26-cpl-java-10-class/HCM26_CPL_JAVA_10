import * as XLSX from "xlsx";
import type { TraineeImportRow } from "@/api/features/class-enrollment.api";

export const TRAINEE_IMPORT_HEADERS = ["Student ID*", "Full Name*", "Personal Email", "DOB", "Gender"];
export const MAX_TRAINEE_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_TRAINEE_IMPORT_ROWS = 500;

export interface TraineeImportIssue {
    rowNumber?: number;
    field: string;
    message: string;
}

const HEADER_ALIASES: Record<"studentId" | "fullName" | "personalEmail" | "dob" | "gender", readonly string[]> = {
    studentId: ["student id", "fpt student id", "student code", "code", "fpt account", "ma sinh vien", "mã sinh viên", "ma hoc vien", "mã học viên"],
    fullName: ["full name", "fullname", "name", "student name", "ho va ten", "họ và tên", "ho ten", "họ tên"],
    personalEmail: ["personal email", "email", "mail", "e-mail"],
    dob: ["dob", "date of birth", "birth date", "birthdate", "ngay sinh", "ngày sinh"],
    gender: ["gender", "sex", "gioi tinh", "giới tính"],
};

const IGNORED_LEGACY_HEADERS = new Set(["national id", "cccd", "cmnd", "status", "trạng thái", "trang thai", "no", "no."]);

const MONTH_MAP: Record<string, number> = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
};

const normalizeHeader = (value: unknown): string =>
    String(value ?? "")
        .normalize("NFC")
        .replace(/\*/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

const cleanText = (value: unknown): string =>
    String(value ?? "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const pad2 = (n: number): string => String(n).padStart(2, "0");

function buildValidIsoDate(year: number, month: number, day: number): string | null {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const iso = `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
    const date = new Date(`${iso}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
    return iso;
}

/**
 * Parses Excel date serial numbers, JS Date objects, and common text date formats:
 * - YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
 * - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - DD-MMM-YYYY, DD MMM YYYY (e.g. 23-Aug-2004)
 * Returns normalized YYYY-MM-DD if valid, raw trimmed string if unparseable, or "" if empty.
 */
export function parseFlexibleDob(value: unknown, date1904 = false): { iso: string; valid: boolean } {
    if (value === null || value === undefined || value === "") {
        return { iso: "", valid: true };
    }

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return { iso: "Invalid Date", valid: false };
        const iso = buildValidIsoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
        return iso ? { iso, valid: true } : { iso: cleanText(value), valid: false };
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        const parsed = XLSX.SSF.parse_date_code(value, { date1904 });
        if (parsed) {
            const iso = buildValidIsoDate(parsed.y, parsed.m, parsed.d);
            if (iso) return { iso, valid: true };
        }
        return { iso: String(value), valid: false };
    }

    const raw = cleanText(value);
    if (!raw) return { iso: "", valid: true };

    // Numeric string representing Excel serial date (e.g. "38222")
    if (/^\d{5}$/.test(raw)) {
        const serial = Number(raw);
        const parsed = XLSX.SSF.parse_date_code(serial, { date1904 });
        if (parsed) {
            const iso = buildValidIsoDate(parsed.y, parsed.m, parsed.d);
            if (iso) return { iso, valid: true };
        }
    }

    // 1. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
    const ymdMatch = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(raw);
    if (ymdMatch) {
        const iso = buildValidIsoDate(Number(ymdMatch[1]), Number(ymdMatch[2]), Number(ymdMatch[3]));
        return iso ? { iso, valid: true } : { iso: raw, valid: false };
    }

    // 2. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(raw);
    if (dmyMatch) {
        const first = Number(dmyMatch[1]);
        const second = Number(dmyMatch[2]);
        const year = Number(dmyMatch[3]);
        // Prefer DD/MM/YYYY; if second > 12 and first <= 12, fallback to MM/DD/YYYY
        const iso =
            buildValidIsoDate(year, second, first) ??
            (first <= 12 && second > 12 ? buildValidIsoDate(year, first, second) : null);
        return iso ? { iso, valid: true } : { iso: raw, valid: false };
    }

    // 3. DD-MMM-YYYY or DD MMM YYYY (e.g. 23-Aug-2004)
    const dMonYMatch = /^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/](\d{4})$/.exec(raw);
    if (dMonYMatch) {
        const day = Number(dMonYMatch[1]);
        const month = MONTH_MAP[dMonYMatch[2].toLowerCase()];
        const year = Number(dMonYMatch[3]);
        if (month) {
            const iso = buildValidIsoDate(year, month, day);
            if (iso) return { iso, valid: true };
        }
        return { iso: raw, valid: false };
    }

    return { iso: raw, valid: false };
}

export function normalizeImportedGender(raw: string): { value: string; valid: boolean } {
    const cleaned = cleanText(raw);
    if (!cleaned) return { value: "", valid: true };
    const lower = cleaned.toLowerCase();
    if (lower === "male" || lower === "m" || lower === "nam") return { value: "Male", valid: true };
    if (lower === "female" || lower === "f" || lower === "nữ" || lower === "nu") return { value: "Female", valid: true };
    if (lower === "other" || lower === "khác" || lower === "khac") return { value: "Other", valid: true };
    return { value: cleaned, valid: false };
}

export function traineeTemplate(): XLSX.WorkBook {
    const book = XLSX.utils.book_new();
    const sampleRows = [
        TRAINEE_IMPORT_HEADERS,
        ["SE180101", "John Doe", "john.doe@example.com", "23/08/2004", "Male"],
        ["SS180102", "Jane Smith", "jane.smith@example.com", "2004-01-28", "Female"],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(sampleRows);
    sheet["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 30 }, { wch: 18 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(book, sheet, "Trainees");
    XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.aoa_to_sheet([
            ["Column", "Requirement & Format"],
            ["Student ID*", "Required. 2–64 letters, digits, underscores or hyphens (e.g. SE180101)."],
            ["Full Name*", "Required. Maximum 100 characters."],
            ["Personal Email", "Optional. Valid email format (e.g. student@gmail.com)."],
            ["DOB", "Optional. Supports DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD-MMM-YYYY, or Excel Date cell."],
            ["Gender", "Optional. Male, Female, or Other (case-insensitive)."],
            ["Limits", "XLSX only, up to 2 MB and 500 rows per import."],
        ]),
        "Instructions",
    );
    return book;
}

function resolveColumnField(normalizedHeader: string): keyof typeof HEADER_ALIASES | "ignored" | null {
    if (!normalizedHeader) return null;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
        [keyof typeof HEADER_ALIASES, readonly string[]]
    >) {
        if (aliases.includes(normalizedHeader)) return field;
    }
    if (IGNORED_LEGACY_HEADERS.has(normalizedHeader)) return "ignored";
    return null;
}

export function parseTraineeWorkbook(book: XLSX.WorkBook): {
    rows: TraineeImportRow[];
    issues: TraineeImportIssue[];
} {
    const issues: TraineeImportIssue[] = [];
    const rows: TraineeImportRow[] = [];
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet?.["!ref"]) {
        return { rows, issues: [{ field: "file", message: "The workbook is empty." }] };
    }

    const range = XLSX.utils.decode_range(sheet["!ref"]);
    if (range.e.r - range.s.r > MAX_TRAINEE_IMPORT_ROWS || range.e.c > 25) {
        return {
            rows,
            issues: [{ field: "file", message: "Use at most 500 data rows and the template columns only." }],
        };
    }

    const cells = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: "",
        blankrows: true,
    });
    const rawHeaders = (cells[0] ?? []).map(normalizeHeader);

    const fieldToColIndex = new Map<keyof typeof HEADER_ALIASES, number>();
    rawHeaders.forEach((header, colIdx) => {
        if (!header) return;
        const resolved = resolveColumnField(header);
        if (!resolved) {
            issues.push({
                field: "header",
                message: `Unknown column "${String((cells[0] ?? [])[colIdx] ?? header)}"; use the downloaded template.`,
            });
            return;
        }
        if (resolved === "ignored") return;
        if (fieldToColIndex.has(resolved)) {
            issues.push({ field: "header", message: `Duplicate column header for ${resolved}.` });
            return;
        }
        fieldToColIndex.set(resolved, colIdx);
    });

    if (!fieldToColIndex.has("studentId")) {
        issues.push({ field: "header", message: "Missing required column: Student ID." });
    }
    if (!fieldToColIndex.has("fullName")) {
        issues.push({ field: "header", message: "Missing required column: Full Name." });
    }

    const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    const date1904 = !!book.Workbook?.WBProps?.date1904;
    const seenStudentIds = new Map<string, number[]>();

    cells.slice(1).forEach((values, index) => {
        if (values.every((v) => !cleanText(v))) return;

        const rowNumber = range.s.r + index + 2;
        const getCell = (field: keyof typeof HEADER_ALIASES): unknown => {
            const col = fieldToColIndex.get(field);
            return col !== undefined ? values[col] : "";
        };

        const studentId = cleanText(getCell("studentId")).toUpperCase();
        const fullName = cleanText(getCell("fullName"));
        const personalEmail = cleanText(getCell("personalEmail"));
        const parsedDob = parseFlexibleDob(getCell("dob"), date1904);
        const parsedGender = normalizeImportedGender(cleanText(getCell("gender")));

        const row: TraineeImportRow = {
            rowNumber,
            studentId,
            fullName,
            personalEmail,
            dob: parsedDob.iso,
            gender: parsedGender.value,
        };

        const addIssue = (field: string, message: string) => issues.push({ rowNumber, field, message });

        if (!studentId || !/^[A-Z0-9_-]{2,64}$/.test(studentId)) {
            addIssue(
                "studentId",
                "Student ID is required (2–64 letters, digits, underscores or hyphens).",
            );
        }
        if (!fullName || fullName.length > 100) {
            addIssue("fullName", "Full Name is required (maximum 100 characters).");
        }
        if (
            personalEmail &&
            (personalEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail))
        ) {
            addIssue("personalEmail", "Invalid email address.");
        }
        if (!parsedDob.valid || (parsedDob.iso && parsedDob.iso > todayIso)) {
            addIssue(
                "dob",
                "Use a valid past DOB (supports DD/MM/YYYY, YYYY-MM-DD, or Excel date cell).",
            );
        }
        if (!parsedGender.valid) {
            addIssue("gender", "Gender must be Male, Female or Other.");
        }

        if (studentId) {
            seenStudentIds.set(studentId, [...(seenStudentIds.get(studentId) ?? []), rowNumber]);
        }
        rows.push(row);
    });

    for (const duplicateRows of seenStudentIds.values()) {
        if (duplicateRows.length > 1) {
            for (const rowNumber of duplicateRows) {
                issues.push({
                    rowNumber,
                    field: "studentId",
                    message: "Duplicate Student ID within the file.",
                });
            }
        }
    }

    if (!rows.length) {
        issues.push({ field: "file", message: "The workbook has no trainee rows." });
    }

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
