import * as XLSX from "xlsx";
import type { CreateTrainingClassInput } from "@/api/features/cls.api";

export interface ClassImportIssue {
    row?: number;
    field: string;
    message: string;
}

// Accept the template, DTO field names, and the bilingual Class List export headers.
const aliases = {
    code: ["code", "class code", "mã lớp", "mã lớp (class code)"],
    name: ["name", "class name", "tên lớp", "tên lớp (class name)"],
    site: ["site", "khu vực", "khu vực (site)"],
    traineeType: ["traineetype", "trainee type", "đối tượng (trainee type)"],
    program: ["program", "chương trình", "chương trình (program)", "chương trình đào tạo (program)"],
    classAdmin: ["classadmin", "class admin", "quản lý lớp (class admin)"],
    plannedSize: ["plannedsize", "planned size", "sĩ số dự kiến"],
    startDate: ["startdate", "start date", "ngày bắt đầu", "ngày bắt đầu (yyyy-mm-dd)", "ngày bắt đầu (start date)"],
    endDate: ["enddate", "end date", "ngày kết thúc", "ngày kết thúc (yyyy-mm-dd)", "ngày kết thúc (end date)"],
    masterTrainer: ["mastertrainer", "master trainer", "giảng viên chính", "giảng viên chính (master trainer)"],
    status: ["status", "trạng thái", "trạng thái (status)"],
};

const normalizeHeader = (value: unknown) => String(value ?? "").normalize("NFC")
    .replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const text = (value: unknown) => String(value ?? "").trim();
const pad = (value: number) => String(value).padStart(2, "0");

export function isIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function excelDate(value: unknown, date1904 = false): string {
    if (typeof value === "number") {
        const date = XLSX.SSF.parse_date_code(value, { date1904 });
        return date ? `${date.y}-${pad(date.m)}-${pad(date.d)}` : text(value);
    }
    return text(value);
}

export function parseClassWorkbook(workbook: XLSX.WorkBook) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = sheet ? XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: true }) : [];
    const header = rows[0]?.map(normalizeHeader) ?? [];
    const data: CreateTrainingClassInput[] = [];
    const rowNumbers: number[] = [];
    const errors: ClassImportIssue[] = [];
    const codes = new Map<string, number>();
    const firstRow = sheet?.["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]).s.r : 0;

    rows.slice(1).forEach((cells, index) => {
        if (cells.every(cell => text(cell) === "")) return;
        const row = firstRow + index + 2;
        const value = (field: keyof typeof aliases) => cells[header.findIndex(h => aliases[field].includes(h))];
        const item: CreateTrainingClassInput = {
            code: text(value("code")).toUpperCase(),
            name: text(value("name")),
            site: text(value("site")),
            traineeType: text(value("traineeType")),
            program: text(value("program")),
            classAdmin: text(value("classAdmin")),
            plannedSize: text(value("plannedSize")) === "" ? Number.NaN : Number(value("plannedSize")),
            startDate: excelDate(value("startDate"), !!workbook.Workbook?.WBProps?.date1904),
            endDate: excelDate(value("endDate"), !!workbook.Workbook?.WBProps?.date1904),
            masterTrainer: text(value("masterTrainer")),
            status: text(value("status")).toLowerCase(),
        };
        const issue = (field: string, message: string) => errors.push({ row, field, message });
        for (const field of ["code", "name", "program", "status", "classAdmin", "masterTrainer"] as const) {
            if (!item[field]) issue(field, "Trường bắt buộc.");
        }
        if (item.code && !/^[A-Z0-9_-]{4,30}$/.test(item.code)) issue("code", "Phải có 4–30 ký tự A–Z, 0–9, _ hoặc -.");
        const previous = codes.get(item.code);
        if (item.code && previous !== undefined) issue("code", `Mã lớp trùng với dòng ${previous}: ${item.code}.`);
        else codes.set(item.code, row);
        for (const field of ["name", "program", "classAdmin", "masterTrainer", "site", "traineeType"] as const) {
            if ((item[field]?.length ?? 0) > (field === "name" ? 150 : 255)) issue(field, `Tối đa ${field === "name" ? 150 : 255} ký tự.`);
        }
        if (!Number.isInteger(item.plannedSize) || item.plannedSize < 1 || item.plannedSize > 50) issue("plannedSize", "Phải là số nguyên từ 1 đến 50.");
        for (const field of ["startDate", "endDate"] as const) {
            if (!isIsoDate(item[field])) issue(field, "Bắt buộc có ngày hợp lệ dạng YYYY-MM-DD hoặc ô ngày Excel.");
        }
        if (isIsoDate(item.startDate) && isIsoDate(item.endDate) && item.endDate <= item.startDate) issue("endDate", "Phải sau startDate.");
        if (item.status && item.status !== "planning") issue("status", "Lớp mới phải có trạng thái planning.");
        data.push(item);
        rowNumbers.push(row);
    });
    if (data.length === 0 || data.length > 500) errors.push({ field: "input", message: "Mỗi lần import phải có từ 1 đến 500 lớp." });
    return { data, rowNumbers, errors };
}

export function classImportServerIssues(errors: Record<string, string[]>, rowNumbers: number[]): ClassImportIssue[] {
    return Object.entries(errors).flatMap(([path, messages]) => {
        const match = path.match(/\[(\d+)\](?:\.(.*))?/);
        return messages.map(message => ({
            row: match ? rowNumbers[Number(match[1])] ?? Number(match[1]) + 2 : undefined,
            field: match ? match[2] || "input" : path,
            message,
        }));
    });
}
