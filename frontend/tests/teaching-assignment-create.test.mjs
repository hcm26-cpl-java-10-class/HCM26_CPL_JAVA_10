import { test } from "node:test";
import assert from "node:assert/strict";
import { isISODate, validateAssignmentForm } from "../src/pages/management/teaching-assignment/assignment-form.ts";

const context = {
  classProfile: { id: 1, startDate: "2026-01-01", endDate: "2026-12-31" },
  subjects: [{ programSubjectId: 10 }],
};
const valid = {
  classId: "1", programSubjectId: "10", trainerId: "2", role: "MAIN",
  effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31",
};
const validate = (overrides = {}, classContext = context) =>
  validateAssignmentForm({ ...valid, ...overrides }, classContext, [1, 3], [2, 4]);

test("accepts inclusive class boundaries, same-day periods and optional end", () => {
  assert.deepEqual(validate(), {});
  assert.deepEqual(validate({ effectiveTo: "2026-01-01" }), {});
  assert.deepEqual(validate({ effectiveTo: "" }), {});
});

test("requires an eligible class, a subject in that class and an active trainer", () => {
  assert.ok(validate({ classId: "9" }).classId);
  assert.ok(validate({ programSubjectId: "99" }).programSubjectId);
  assert.ok(validate({ trainerId: "99" }).trainerId);
  assert.ok(validate({ classId: "3" }).programSubjectId, "previous class data cannot validate a new selection");
  assert.ok(validateAssignmentForm(valid, undefined, [1], [2]).programSubjectId);
});

test("rejects reversed dates and dates outside class boundaries", () => {
  assert.ok(validate({ effectiveFrom: "2025-12-31" }).effectiveFrom);
  assert.ok(validate({ effectiveFrom: "2027-01-01" }).effectiveFrom);
  assert.ok(validate({ effectiveTo: "2027-01-01" }).effectiveTo);
  assert.ok(validate({ effectiveFrom: "2026-06-01", effectiveTo: "2026-05-31" }).effectiveTo);
});

test("validates real calendar dates and roles instead of only date formatting", () => {
  for (const value of ["", "2026-02-29", "2026-04-31", "0000-01-01", "not-a-date"]) {
    assert.equal(isISODate(value), false);
    assert.ok(validate({ effectiveFrom: value }).effectiveFrom);
  }
  assert.equal(isISODate("2028-02-29"), true);
  assert.ok(validate({ role: "INVALID" }).role);
  assert.ok(validate({ effectiveTo: "2026-02-30" }).effectiveTo);
});
