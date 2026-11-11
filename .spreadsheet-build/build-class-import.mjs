import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "file:///C:/Users/pc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const outputDir = "D:/FA26/HCM26_CPL_JAVA_10-feature-subject-management/outputs/class-import-test";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Class Import");
sheet.showGridLines = false;
sheet.tabColor = "#1F4E78";

const headers = [
  "Class Code",
  "Class Name",
  "Expected Start Date",
  "Expected End Date",
  "Status",
  "Planned Trainee No.",
  "Delivery Type",
  "Trainee Type",
  "Format Type",
  "Skills",
  "Site",
  "Location",
  "Subject Type",
  "Scope",
  "Supplier/Partner",
  "Key Program",
  "Job Recommendation",
  "Training Program Code",
  "Training Program Version",
];

const rows = [
  headers,
  ["TEST_JAVA_101", "Lớp kiểm thử Java cơ bản", new Date(2026, 10, 3), new Date(2027, 1, 28), "active", 30, "Class", "Fresher", "Offline", "Java, OOP", "TP. Ho Chi Minh", "Phòng A201", "IT Technical", "Unit", "Internal Training", "Core Java", true, "", ""],
  ["TEST_JAVA_102", "Lớp kiểm thử Java nâng cao", new Date(2026, 10, 10), new Date(2027, 2, 15), "active", 25, "Class", "Junior", "Hybrid", "Java, Spring Boot", "TP. Ho Chi Minh", "Phòng A202", "IT Technical", "Unit", "Internal Training", "Backend", false, "LOCAL_JAVA", "1.0"],
  ["TEST_JAVA_103", "Lớp kiểm thử Spring Boot", new Date(2026, 11, 1), new Date(2027, 2, 31), "active", 28, "Workshop", "Junior", "Online", "Spring Boot, REST API", "Ha Noi", "Online", "IT Technical", "Department", "External Partner", "Spring Track", true, "", ""],
  ["TEST_JAVA_104", "Lớp kiểm thử cơ sở dữ liệu", new Date(2027, 0, 5), new Date(2027, 3, 30), "active", 22, "Class", "Fresher", "Offline", "SQL, MySQL", "Da Nang", "Phòng B101", "IT Technical", "Unit", "Internal Training", "Database", false, "", ""],
  ["TEST_JAVA_105", "Lớp kiểm thử tích hợp hệ thống", new Date(2027, 0, 12), new Date(2027, 4, 15), "active", 20, "Class", "Middle", "Hybrid", "Java, Integration", "TP. Ho Chi Minh", "Phòng B102", "IT Technical", "Company", "External Partner", "Integration", true, "", ""],
];

sheet.getRange("A1:S6").values = rows;
sheet.getRange("C2:D6").format.numberFormat = "yyyy-mm-dd";
sheet.getRange("F2:F6").format.numberFormat = "#,##0";
sheet.getRange("A1:S6").format.font = { name: "Arial", size: 10, color: "#1F2937" };
sheet.getRange("A1:S1").format = {
  fill: "#1F4E78",
  font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#D9E2F3" },
};
sheet.getRange("A2:S6").format.verticalAlignment = "center";
sheet.getRange("A2:S6").format.borders = { preset: "inside", style: "thin", color: "#E5E7EB" };
sheet.getRange("A1:S6").format.autofitColumns();
sheet.getRange("A1:S6").format.autofitRows();
sheet.getRange("A1:S1").format.rowHeight = 34;
sheet.getRange("A:A").format.columnWidth = 18;
sheet.getRange("B:B").format.columnWidth = 30;
sheet.getRange("C:D").format.columnWidth = 18;
sheet.getRange("J:J").format.columnWidth = 25;
sheet.getRange("L:L").format.columnWidth = 24;
sheet.getRange("Q:Q").format.columnWidth = 20;
sheet.getRange("R:S").format.columnWidth = 24;
sheet.freezePanes.freezeRows(1);
sheet.tables.add("A1:S6", true, "ClassImportTestTable");

workbook.recalculate();
const check = await workbook.inspect({
  kind: "table",
  range: "Class Import!A1:S6",
  include: "values,formulas",
  tableMaxRows: 10,
  tableMaxCols: 20,
  maxChars: 8000,
});
console.log(check.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 50 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "Class Import", range: "A1:S6", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/class-import-preview.png`, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(`${outputDir}/class-import-test.xlsx`);
console.log(`EXPORTED=${outputDir}/class-import-test.xlsx`);
