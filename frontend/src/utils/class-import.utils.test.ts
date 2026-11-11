import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { classImportServerIssues, excelDate, parseClassWorkbook } from "./class-import.utils";

const headers = ["Mã lớp (Class Code)*", "Tên lớp*", "Chương trình (Program)*", "Trạng thái*", "Sĩ số dự kiến*",
    "Ngày bắt đầu (yyyy-mm-dd)*", "Ngày kết thúc (yyyy-mm-dd)*", "Quản lý lớp (Class Admin)*", "Giảng viên chính*"];
const row = (index = 1): unknown[] => [`HCM26_JAVA_${index}`, `Java ${index}`, "JAVA", "planning", 20, "2026-06-01", "2026-12-01", "Admin", "Trainer"];
function workbook(rows: unknown[][], names = headers) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([names, ...rows]), "Classes");
    // Exercise actual Excel serialization, not just a hand-built row object.
    return XLSX.read(XLSX.write(book, { type: "array", bookType: "xlsx" }), { type: "array" });
}

describe("Excel → TrainingClassDTO import mapping", () => {
    it.each([1, 6])("maps %i complete rows to the JSON DTO", count => {
        const result = parseClassWorkbook(workbook(Array.from({ length: count }, (_, index) => row(index + 1))));
        expect(result.errors).toEqual([]);
        expect(result.data).toHaveLength(count);
        expect(result.data[0]).toMatchObject({ code: "HCM26_JAVA_1", name: "Java 1", program: "JAVA", status: "planning", plannedSize: 20,
            startDate: "2026-06-01", endDate: "2026-12-01", classAdmin: "Admin", masterTrainer: "Trainer" });
    });

    it("accepts DTO field names, bilingual name headers, whitespace and uppercase status", () => {
        const values = row();
        values[0] = " hcm26_java_1 ";
        values[3] = " PLANNING ";
        const result = parseClassWorkbook(workbook([values], ["code", " Tên lớp (Class Name) * ", "program", "status", "plannedSize", "startDate", "endDate", "classAdmin", "masterTrainer"]));
        expect(result.errors).toEqual([]);
        expect(result.data[0]).toMatchObject({ code: "HCM26_JAVA_1", status: "planning", name: "Java 1" });
    });

    it("converts Excel date serials, including the 1904 calendar, without a timezone shift", () => {
        const values = row();
        values[5] = 46174;
        values[6] = 46357;
        const result = parseClassWorkbook(workbook([values]));
        expect(result.errors).toEqual([]);
        expect(result.data[0]).toMatchObject({ startDate: "2026-06-01", endDate: "2026-12-01" });
        expect(excelDate(44712, true)).toBe("2026-06-01");
    });

    it.each(headers.map((header, index) => [header, index] as const))("reports a missing mandatory column value: %s", (_, index) => {
        const values = row();
        values[index] = "";
        const result = parseClassWorkbook(workbook([values]));
        expect(result.errors.some(error => error.row === 2)).toBe(true);
        // Missing fields must remain missing; never fabricate admin, trainer, program or size.
        if ([2, 7, 8].includes(index)) expect(Object.values(result.data[0]).filter(value => value === "").length).toBeGreaterThan(0);
    });

    it("preserves physical Excel row numbers across blank lines", () => {
        const invalid = row(2);
        invalid[1] = "";
        const result = parseClassWorkbook(workbook([row(), [], invalid]));
        expect(result.rowNumbers).toEqual([2, 4]);
        expect(result.errors).toContainEqual({ row: 4, field: "name", message: "Trường bắt buộc." });
        expect(classImportServerIssues({ "importClasses.input[1].code": ["Class code already exists"] }, result.rowNumbers))
            .toEqual([{ row: 4, field: "code", message: "Class code already exists" }]);
    });

    it("reports duplicate codes within the file after normalization", () => {
        const other = row();
        other[0] = " hcm26_java_1 ";
        expect(parseClassWorkbook(workbook([row(), other])).errors).toContainEqual(expect.objectContaining({ row: 3, field: "code" }));
    });

    it.each([
        [0, "bad code!", "code"], [3, "active", "status"], [4, 0, "plannedSize"], [4, 51, "plannedSize"], [4, 1.5, "plannedSize"],
        [5, "01/06/2026", "startDate"], [5, "2026-02-30", "startDate"], [6, "2026-01-01", "endDate"],
    ])("rejects invalid value %s/%s", (index, value, field) => {
        const values = row();
        values[Number(index)] = value;
        expect(parseClassWorkbook(workbook([values])).errors).toContainEqual(expect.objectContaining({ row: 2, field }));
    });
});
