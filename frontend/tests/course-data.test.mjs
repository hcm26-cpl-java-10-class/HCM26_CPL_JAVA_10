import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, unlinkSync } from "node:fs";
import * as XLSX from "xlsx";

const storage = new Map();
const store = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
globalThis.localStorage = store;
globalThis.window = { localStorage: store, sessionStorage: store };
const generated = new URL("./.course-data.generated.mjs", import.meta.url);
const result = await build({ stdin: { contents: `
  export * from "./src/integrations/courses/course-data";
  export * from "./src/integrations/courses/course-workbook";
  export * from "./src/integrations/courses/course-queries";
`, resolveDir: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), loader: "ts" },
  bundle: true, write: false, platform: "node", format: "esm", packages: "external",
  tsconfig: new URL("../tsconfig.app.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), define: { "import.meta.env": "{}" } });
writeFileSync(generated, result.outputFiles[0].text);
let mod;
try { mod = await import(generated.href); } finally { unlinkSync(generated); }
const { courseData, validateCourse, legacyCourseSummary, previewCourseRows, previewCourseWorkbook, persistCourseImport, courseWorkbook, refreshCourseViews } = mod;
const original = { ...courseData };
afterEach(() => { Object.assign(courseData, original); storage.clear(); });
const course = (name, id) => ({ id, name, description: "Description", instructor: "Instructor", thumbnailUrl: "", isActive: true });

test("15 valid imports append to four existing backend records using returned IDs", async () => {
  const records = Array.from({ length: 4 }, (_, i) => course(`Existing ${i}`, i + 1));
  courseData.all = async () => [...records];
  courseData.create = async row => { assert.equal(row.id, undefined); const saved = { ...row, id: records.length + 1 }; records.push(saved); return saved; };
  const preview = previewCourseRows(Array.from({ length: 15 }, (_, i) => ({ Name: `Imported ${i}`, Active: true })));
  const result = await persistCourseImport(preview);
  assert.equal(result.imported, 15); assert.equal(result.failed, 0); assert.equal(records.length, 19);
  assert.deepEqual(records.slice(0, 4).map(c => c.id), [1, 2, 3, 4]);
});

test("normalized duplicate names skip identical records and reject conflicts without overwrites", async () => {
  const existing = course("Java Fundamentals", 12); let creates = 0;
  courseData.all = async () => [existing]; courseData.create = async () => { creates++; throw new Error("Must not create"); };
  const result = await persistCourseImport(previewCourseRows([
    { Name: "  JAVA\u00a0 FUNDAMENTALS ", Instructor: "Instructor", Description: "Description", Active: true },
    { Name: "Java Fundamentals", Description: "Different metadata", Active: true },
  ]));
  assert.equal(result.skipped, 1); assert.equal(result.failed, 1); assert.equal(creates, 0);
  assert.equal(existing.description, "Description");
});

test("unsupported workbook metadata and sheets are disclosed; blank rows retain Excel row numbers", () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ["Name", "Active", "Category Codes", "Level", "Status"],
    ["Actual course", true, "JAVA", "INTERMEDIATE", "DRAFT"], [], ["Second course", false],
  ]), "Courses");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Unsupported sheet"]]), "Lessons");
  const preview = previewCourseWorkbook(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
  assert.deepEqual(preview.rows.map(row => row.row), [2, 4]);
  assert.equal(preview.rows[0].course.isActive, true); assert.equal(preview.rows[1].course.isActive, false);
  for (const label of ["Category Codes", "Level", "Status", "Lessons sheet"]) assert.ok(preview.warnings.some(warning => warning.includes(label)));
  assert.equal(preview.rows[0].course.publicationStatus, undefined);
});

test("invalid Course rows are rejected before persistence and Active is not publication", () => {
  const preview = previewCourseRows([{ Name: "" }, { Name: "Invalid", Active: "PUBLISHED" }, { Name: "Long", Description: "x".repeat(501) }]);
  assert.ok(preview.rows.every(row => row.error && !row.course));
  assert.throws(() => validateCourse({ name: "x".repeat(151), isActive: true }));
});

test("partial server failure reports confirmed writes and leaves remaining rows unattempted", async () => {
  courseData.all = async () => []; let calls = 0;
  courseData.create = async row => { if (++calls === 2) throw new Error("Network failed"); return { ...row, id: calls }; };
  const result = await persistCourseImport(previewCourseRows([1, 2, 3].map(i => ({ Name: `Course ${i}`, Active: true }))));
  assert.equal(result.imported, 1); assert.equal(result.failed, 1); assert.equal(result.unattempted, 1);
  assert.equal(calls, 2); assert.match(result.rows[1].message, /Network failed/);
});

test("failed preflight and lost account session never produce Course creation requests", async () => {
  let creates = 0; courseData.create = async () => { creates++; };
  const preview = previewCourseRows([{ Name: "Course", Active: true }]);
  courseData.all = async () => { throw new Error("Read denied"); };
  await assert.rejects(persistCourseImport(preview), /Read denied/);
  courseData.all = async () => [];
  assert.equal((await persistCourseImport(preview, () => false)).unattempted, 1);
  assert.equal(creates, 0);
});

test("XLSX export round trips real IDs and supported fields with explicit limitations", () => {
  const workbook = courseWorkbook([course("Backend course", 37)]);
  const restored = XLSX.read(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(restored.Sheets.Courses, { defval: "" });
  assert.equal(rows.length, 1); assert.equal(rows[0].ID, 37); assert.equal(rows[0].Name, "Backend course");
  assert.equal(rows[0].Active, true); assert.equal(rows[0].Status, ""); assert.equal(rows[0].Level, "");
  assert.ok(restored.Sheets.Readme);
});

test("legacy browser Course records are identified without modifying any storage", () => {
  const raw = JSON.stringify(Array.from({ length: 15 }, (_, id) => ({ id, name: `Legacy ${id}` })));
  storage.set("app_courses_state", raw); storage.set("unrelated-preference", "keep");
  assert.deepEqual(legacyCourseSummary(), { local: 15, session: 15, unreadable: false });
  assert.equal(storage.get("app_courses_state"), raw); assert.equal(storage.get("unrelated-preference"), "keep");
});

test("Course mutations refresh Course, Catalog, Detail and Learning query families", async () => {
  const keys = [];
  await refreshCourseViews({ invalidateQueries: async ({ queryKey }) => { keys.push(queryKey[0]); } });
  assert.deepEqual(keys, ["course-data", "course-detail", "my-enrollments", "personal-learning", "admin-learning"]);
});

test("full backend read follows every page and rejects an unstable dataset", async () => {
  const calls = [];
  courseData.page = async options => { calls.push(options.page); return { content: [course(`Course ${options.page}`, options.page + 1)], totalElements: 2, totalPages: 2 }; };
  assert.equal((await courseData.all()).length, 2); assert.deepEqual(calls, [0, 1]);
  courseData.page = async options => ({ content: [course("Changed", 1)], totalElements: options.page ? 3 : 2, totalPages: 2 });
  await assert.rejects(courseData.all(), /Courses changed/);
});
