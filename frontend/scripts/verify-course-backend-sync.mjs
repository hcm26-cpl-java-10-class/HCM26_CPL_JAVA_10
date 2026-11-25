// Explicit real-backend verification; never part of the default unit-test command.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import * as XLSX from "xlsx";

const api = process.env.COURSE_SYNC_API_URL;
if (api !== "http://127.0.0.1:8093/api" || process.env.COURSE_SYNC_CONFIRM_ISOLATED !== "course_sync_20261104") {
  throw new Error("Requires the explicitly verified isolated backend and confirmation. No API requests made.");
}
const output = new URL("../../docs/course-sync-verification/", import.meta.url);
mkdirSync(output, { recursive: true });
const fixture = Array.from({ length: 15 }, (_, i) => ({ Name: `Sync Imported Course ${String(i + 1).padStart(2, "0")}`,
  Instructor: "Integration Instructor", Description: `Persisted Course import fixture ${i + 1}.`,
  "Thumbnail URL": "https://img.youtube.com/vi/iCYoaTvE9vo/hqdefault.jpg", Active: true,
  "Category Codes": "JAVA", Level: "INTERMEDIATE", Status: "PUBLISHED", "Instructor Email": "fixture@example.test" }));
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(fixture), "Courses");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Note"], ["This sheet is intentionally unsupported by Course import."]]), "Sections");
const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
writeFileSync(new URL("import-15-courses.xlsx", output), bytes);
if (process.argv.includes("--prepare")) { console.log("Prepared 15-course XLSX fixture; no API mutations performed."); process.exit(0); }

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const generated = new URL("../tests/.backend-sync.generated.mjs", import.meta.url);
const bundle = await build({ stdin: { contents: `
  export { courseData } from "./src/integrations/courses/course-data";
  export { previewCourseWorkbook, previewCourseRows, persistCourseImport, courseWorkbook } from "./src/integrations/courses/course-workbook";
  export { store } from "./src/store/store";
  export { setLogin } from "./src/store/slices/auth/authSlice";
  export { default as axios } from "./src/api/axios";
`, resolveDir: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), loader: "ts" },
  bundle: true, write: false, platform: "node", format: "esm", packages: "external",
  tsconfig: new URL("../tsconfig.app.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  define: { "import.meta.env": JSON.stringify({ VITE_API_URL: api }) } });
writeFileSync(generated, bundle.outputFiles[0].text);
let mod;
try { mod = await import(generated.href); } finally { unlinkSync(generated); }
const { courseData, previewCourseRows, persistCourseImport, courseWorkbook, store, setLogin, axios } = mod;
// Suppress the pre-existing general API client's verbose request/response logs.
const log = console.log;
console.log = () => {};
async function login(email) {
  const response = await fetch(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "password123" }) });
  assert.equal(response.status, 200);
  const data = await response.json();
  store.dispatch(setLogin({ ...data, token: data.accessToken }));
}
await login("admin@example.com");
const initial = await courseData.all();
if (process.argv.includes("--check-initial")) {
  assert.equal(initial.length, 4);
  assert.equal((await courseData.page({ page: 0, size: 100, isActive: true })).totalElements, 4);
  console.log = log; log("Real API initial counts: management=4, catalog=4."); process.exit(0);
}
if (process.argv.includes("--check-import")) {
  assert.equal(initial.length, 19);
  assert.equal((await courseData.page({ page: 0, size: 100, isActive: true })).totalElements, 19);
  for (const row of fixture) {
    const persisted = initial.find(course => course.name === row.Name);
    assert.ok(persisted); assert.equal(persisted.description, row.Description); assert.equal(persisted.thumbnailUrl, row["Thumbnail URL"]);
    assert.equal(persisted.instructor, row.Instructor); assert.equal(persisted.isActive, true);
  }
  writeFileSync(new URL("after-import.json", output), JSON.stringify({ backendCount: initial.length, activeCount: 19, ids: initial.map(c => c.id), importedIds: Object.fromEntries(initial.filter(c => c.name.startsWith("Sync Imported Course")).map(c => [c.name, c.id])), verifiedSupportedFields: ["name", "description", "thumbnailUrl", "instructor", "isActive"] }, null, 2));
  console.log = log; log("Real API after UI XLSX import: management=19, catalog=19; all 15 imported rows verified."); process.exit(0);
}

// Run only after the browser has demonstrated 4 -> 19 -> 20 -> 19 and enrolled
// the admin in Sync Imported Course 01. These checks use real authenticated HTTP.
assert.equal(initial.length, 19);
const afterImport = JSON.parse(readFileSync(new URL("after-import.json", output), "utf8"));
const edited = initial.find(course => course.name === "Sync Imported Course 02 Updated");
assert.ok(edited);
assert.equal(edited.id, afterImport.importedIds["Sync Imported Course 02"]);
assert.equal(edited.description, "Edited supported Course metadata.");
assert.equal(edited.instructor, "Updated Instructor");
assert.equal(edited.thumbnailUrl, "https://img.youtube.com/vi/LuVEozf3wnU/hqdefault.jpg");
const imported = initial.find(course => course.name === "Sync Imported Course 01");
assert.ok(imported);
const mine = (await axios.get("/enrollments/my-courses")).data;
assert.ok(mine.some(record => record.courseId === imported.id));
const learning = (await axios.get("/learning/me")).data;
assert.ok(learning.enrolledCourses.some(record => record.courseId === imported.id));
await assert.rejects(axios.post("/enrollments", { courseId: imported.id }));
assert.equal((await axios.get("/enrollments/my-courses")).data.filter(record => record.courseId === imported.id).length, 1);
await assert.rejects(courseData.remove(imported.id));
assert.equal((await courseData.all()).length, 19);

const duplicate = await persistCourseImport(previewCourseRows([{ Name: imported.name, Instructor: imported.instructor, Description: imported.description, "Thumbnail URL": imported.thumbnailUrl, Active: imported.isActive }]));
assert.equal(duplicate.imported, 0); assert.equal(duplicate.skipped, 1); assert.equal(duplicate.failed, 0);
const invalid = await persistCourseImport(previewCourseRows([
  { Name: "", Active: true }, { Name: "Invalid oversized fixture", Description: "x".repeat(501), Active: true },
  { Name: imported.name, Description: "Conflicting value", Active: true }, { Name: "Invalid active fixture", Active: "PUBLISHED" },
]));
assert.equal(invalid.imported, 0); assert.equal(invalid.failed, 4);
assert.equal((await courseData.all()).length, 19);

const toggle = initial.find(course => course.name === "Sync Imported Course 15");
await courseData.update(toggle.id, { ...toggle, isActive: false });
assert.equal((await courseData.all()).length, 19);
assert.equal((await courseData.page({ page: 0, size: 100, isActive: true })).totalElements, 18);
await courseData.update(toggle.id, { ...toggle, isActive: true });
assert.equal((await courseData.page({ page: 0, size: 100, isActive: true })).totalElements, 19);
const exported = courseWorkbook(await courseData.all());
const exportedBytes = XLSX.write(exported, { type: "buffer", bookType: "xlsx" });
const roundTrip = XLSX.read(exportedBytes, { type: "buffer" });
assert.equal(XLSX.utils.sheet_to_json(roundTrip.Sheets.Courses).length, 19);
writeFileSync(new URL("verified-backend-export.xlsx", output), exportedBytes);

await login("student@example.com");
assert.equal((await axios.get("/enrollments/my-courses")).data.length, 0);
assert.equal((await axios.get("/learning/me")).data.enrolledCourses.length, 0);
await assert.rejects(courseData.create({ name: "Unauthorized fixture", isActive: true }), error => error.response?.status === 403);
await assert.rejects(courseData.remove(imported.id), error => error.response?.status === 403);
await assert.rejects(axios.get("/users/1/learning"), error => error.response?.status === 403);
await login("teacher@example.com");
await assert.rejects(axios.get("/learning/me"), error => error.response?.status === 403);
await assert.rejects(axios.post("/enrollments", { courseId: imported.id }), error => error.response?.status === 403);
await login("admin@example.com");
assert.equal((await courseData.all()).length, 19);
assert.ok((await axios.get("/enrollments/my-courses")).data.some(record => record.courseId === imported.id));
const result = { realBackend: api, courseCount: 19, activeCount: 19, duplicateImport: duplicate,
  invalidImport: invalid, protectedDeletion: "rejected; course and enrollment retained", exportRows: 19,
  adminEnrollment: "confirmed; one record", studentIsolation: "empty personal records", permissions: "student Course writes denied; teacher personal learning/enrollment denied", activeVisibility: "19 management / 18 catalog while inactive; restored to 19 / 19", relogin: "enrollment retained" };
writeFileSync(new URL("real-api-results.json", output), JSON.stringify(result, null, 2));
console.log = log;
log(JSON.stringify(result, null, 2));
