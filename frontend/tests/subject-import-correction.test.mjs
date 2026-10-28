import assert from "node:assert/strict";
import test from "node:test";
import { editImportCell, failedImportDrafts, importDrafts } from "../src/pages/management/subject/subject-import.ts";

test("preview keeps bad raw values editable even when no parsed DTO exists", () => {
  const preview = {rows: [{rowNumber: 5, values: {Code: "JAVA", Hours: "bad"}, data: null, errors: ["Invalid Hours"], valid: false}]};
  const drafts = importDrafts(preview);
  assert.equal(drafts[0].values.Hours, "bad");
  drafts[0].values.Hours = "8";
  assert.equal(preview.rows[0].values.Hours, "bad");
});
test("inline edits preserve the original row number and all other columns", () => {
  const original = [{rowNumber: 7, values: {Code: "JAVA", Hours: "-1", Outline: "Original"}}, {rowNumber: 12, values: {Code: "SQL", Hours: "4"}}];
  const edited = editImportCell(original, 7, "Hours", "8");
  assert.equal(edited[0].rowNumber, 7); assert.equal(edited[0].values.Hours, "8");
  assert.equal(edited[0].values.Outline, "Original"); assert.equal(original[0].values.Hours, "-1");
  assert.equal(edited[1], original[1]);
});
test("clearing a cell is preserved for the backend to validate", () => {
  const edited = editImportCell([{rowNumber: 2, values: {Name: "Original"}}], 2, "Name", "");
  assert.equal(edited[0].values.Name, "");
});
test("retry includes only failed rows and never resubmits saved subjects", () => {
  const rows = [{rowNumber: 4, values: {Code: "SAVED"}}, {rowNumber: 11, values: {Code: "FAILED"}}];
  const remaining = failedImportDrafts(rows, {successCount: 1, failureCount: 1, errors: [{rowNumber: 11, message: "Invalid Hours"}]});
  assert.deepEqual(remaining, [{rowNumber: 11, values: {Code: "FAILED"}}]);
  remaining[0].values.Code = "CORRECTED";
  assert.equal(rows[1].values.Code, "FAILED");
});
