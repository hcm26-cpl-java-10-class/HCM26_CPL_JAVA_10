import type { UserDTO } from "@/types";

export type ImportRole = "ADMIN" | "TEACHER" | "STUDENT";

export interface UserImportRow {
  rowNumber: number;
  employeeCode: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  errors: string[];
}

const IMPORT_ROLES: ImportRole[] = ["ADMIN", "TEACHER", "STUDENT"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const IMPORT_HEADERS = ["EmployeeCode", "FullName", "Email", "Role", "Department"];

const csvCell = (value: string | number | undefined) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const toFullName = (user: UserDTO) =>
  [user.lastName, user.firstName].filter((part): part is string => Boolean(part?.trim())).join(" ");

export function exportToCSV(
  data: UserDTO[],
  roleNameById: ReadonlyMap<string, string>,
  departmentNameById: ReadonlyMap<string, string>,
): Blob {
  const rows = [
    ["EmployeeCode", "FullName", "Email", "Role", "Department", "Status"],
    ...data.map((user) => [
      user.employeeCode ?? "",
      toFullName(user),
      user.email ?? "",
      (user.roleIds ?? [])
        .map((id) => roleNameById.get(String(id)) ?? "")
        .filter(Boolean)
        .join(", "),
      (user.departmentIds ?? [])
        .map((id) => departmentNameById.get(String(id)) ?? "")
        .filter(Boolean)
        .join(", "),
      user.status ?? (user.isActive === false ? "INACTIVE" : "ACTIVE"),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

export function createUserImportTemplate(): Blob {
  const csv = `\uFEFF${IMPORT_HEADERS.map(csvCell).join(",")}\r\n`;
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("File CSV có dấu ngoặc kép chưa được đóng.");
  if (cell || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

function toImportRows(matrix: string[][]): UserImportRow[] {
  const headers = matrix[0]?.map((header) => header.trim().toLowerCase()) ?? [];
  const missingHeaders = IMPORT_HEADERS.filter((header) => !headers.includes(header.toLowerCase()));
  if (missingHeaders.length > 0) {
    throw new Error(`Thiếu cột bắt buộc: ${missingHeaders.join(", ")}.`);
  }

  const columnIndex = (header: string) => headers.indexOf(header.toLowerCase());
  const value = (cells: string[], header: string) => cells[columnIndex(header)]?.trim() ?? "";
  return matrix.slice(1).map((cells, index) => ({
    rowNumber: index + 2,
    employeeCode: value(cells, "EmployeeCode"),
    fullName: value(cells, "FullName"),
    email: value(cells, "Email"),
    role: value(cells, "Role").toUpperCase(),
    department: value(cells, "Department"),
    errors: [],
  }));
}

export async function parseUserImportFile(file: File): Promise<UserImportRow[]> {
  let matrix: string[][];
  if (file.name.toLowerCase().endsWith(".csv")) {
    matrix = parseCsvMatrix(await file.text());
  } else {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("File không có trang tính để đọc.");
    const sheet = workbook.Sheets[firstSheetName];
    matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
  }
  if (matrix.length < 2) throw new Error("File không có dữ liệu người dùng.");
  return toImportRows(matrix);
}

export function validateUserImportRows(
  rows: UserImportRow[],
  existingEmails: ReadonlySet<string>,
  departmentCodes: ReadonlySet<string>,
): UserImportRow[] {
  const emailCounts = new Map<string, number>();
  for (const row of rows) {
    const email = row.email.toLowerCase();
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  }

  return rows.map((row) => {
    const errors: string[] = [];
    if (!row.employeeCode) errors.push("Thiếu mã NV/HV.");
    if (!row.fullName) errors.push("Thiếu họ tên.");
    if (!row.email || !EMAIL_PATTERN.test(row.email)) errors.push("Email không hợp lệ.");
    if ((emailCounts.get(row.email.toLowerCase()) ?? 0) > 1) {
      errors.push("Email bị trùng trong file.");
    } else if (existingEmails.has(row.email.toLowerCase())) {
      errors.push("Email đã tồn tại trong hệ thống.");
    }
    if (!IMPORT_ROLES.includes(row.role as ImportRole)) {
      errors.push("Vai trò phải là ADMIN, TEACHER hoặc STUDENT.");
    }
    if (!row.department) errors.push("Thiếu mã phòng ban.");
    else if (!departmentCodes.has(row.department.toLowerCase())) {
      errors.push("Mã phòng ban không tồn tại.");
    }
    return { ...row, errors };
  });
}

export function createBackendUserImportFile(rows: UserImportRow[]): File {
  const header = ["Email", "First Name", "Last Name", "Roles", "Departments"];
  const content = rows.map((row) => {
    const parts = row.fullName.trim().split(/\s+/);
    const firstName = parts.pop() ?? "";
    const lastName = parts.join(" ");
    return [row.email, firstName, lastName, row.role, row.department].map(csvCell).join(",");
  });
  const csv = `\uFEFF${[header.map(csvCell).join(","), ...content].join("\r\n")}`;
  return new File([csv], "users-import.csv", { type: "text/csv;charset=utf-8" });
}
