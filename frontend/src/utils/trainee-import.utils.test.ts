import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseTraineeWorkbook, traineeTemplate, TRAINEE_IMPORT_HEADERS } from "./trainee-import.utils";

function book(rows: unknown[][], date1904 = false) {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Trainees");
    workbook.Workbook = { WBProps: { date1904 } };
    return workbook;
}
describe("Trainee Excel contract", () => {
    it("generates blank template with exact required and optional headers", () => {
        const template = traineeTemplate();
        expect(XLSX.utils.sheet_to_json(template.Sheets.Trainees, { header: 1 })).toEqual([TRAINEE_IMPORT_HEADERS]);
        expect(template.SheetNames).toContain("Instructions");
    });
    it("parses identity without inventing an ID and preserves the real Excel row numbers", () => {
        const result = parseTraineeWorkbook(book([TRAINEE_IMPORT_HEADERS, [], ["abc_001", "Test Student", "", "", "2000-01-01", "Male"]]));
        expect(result.issues).toEqual([]);
        expect(result.rows[0]).toMatchObject({ rowNumber: 3, studentId: "ABC_001", fullName: "Test Student", dob: "2000-01-01" });
    });
    it("parses both Excel date systems and rejects impossible dates", () => {
        expect(parseTraineeWorkbook(book([TRAINEE_IMPORT_HEADERS, ["S01", "Student", "", "", 36526, ""]])).rows[0].dob).toBe("2000-01-01");
        expect(parseTraineeWorkbook(book([TRAINEE_IMPORT_HEADERS, ["S01", "Student", "", "", 35064, ""]], true)).rows[0].dob).toBe("2000-01-01");
        expect(parseTraineeWorkbook(book([TRAINEE_IMPORT_HEADERS, ["S01", "Student", "", "", "2000-02-30", ""]])).issues).toEqual(expect.arrayContaining([expect.objectContaining({ field: "dob", rowNumber: 2 })]));
    });
    it("reports duplicates on every affected row, invalid email and gender", () => {
        const result = parseTraineeWorkbook(book([TRAINEE_IMPORT_HEADERS, ["S01", "Student", "bad-email", "", "", "Unknown"], ["s01", "Other Student"]]));
        expect(result.issues.filter(issue => issue.message.includes("Duplicate")).map(issue => issue.rowNumber)).toEqual([2, 3]);
        expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ field: "personalEmail" }), expect.objectContaining({ field: "gender" })]));
    });
    it("rejects missing/duplicate/unknown headers, formulas and oversized sheets", () => {
        expect(parseTraineeWorkbook(book([["Full Name", "Full Name", "Unexpected"], ["Test", "Test"]])).issues.some(issue => issue.field === "header")).toBe(true);
        const formula = book([TRAINEE_IMPORT_HEADERS, ["S01", "Student"]]);
        formula.Sheets.Trainees.A2 = { t: "s", v: "S01", f: '"S01"' };
        expect(parseTraineeWorkbook(formula).issues.some(issue => issue.message.includes("Formula"))).toBe(true);
        const oversized = book([TRAINEE_IMPORT_HEADERS]); oversized.Sheets.Trainees["!ref"] = "A1:F502";
        expect(parseTraineeWorkbook(oversized).issues[0].message).toContain("500");
    });
});
