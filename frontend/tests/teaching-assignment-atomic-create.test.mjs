import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAssignmentCreation, hasCreationErrors } from "../src/pages/management/teaching-assignment/assignment-creation.ts";

const classForm = { name: "New class", programName: "New program", programVersion: "1.0", subjectIds: [], startDate: "2026-11-01", endDate: "2026-12-31", plannedSize: "25" };
const trainer = { name: "New trainer", email: "trainer.free@example.com" };
const assignment = { subject: "Java arbitrary name", subjectDurationHours: "40", role: "MAIN", effectiveFrom: "2026-11-02", effectiveTo: "2026-11-30" };

test("one-submit validation accepts unsaved class/program/trainer data without temporary IDs", () => {
  const errors = validateAssignmentCreation(classForm, trainer, assignment);
  assert.equal(hasCreationErrors(errors), false);
});

test("subject accepts free names without looking up existing subjects", () => {
  for (const subject of ["JAVA_CO arbitrary text", "x".repeat(200)]) {
    assert.equal(hasCreationErrors(validateAssignmentCreation(classForm, trainer, { ...assignment, subject })), false);
  }
});

test("subject names are required and limited to 200 characters", () => {
  for (const subject of ["", "   ", "x".repeat(201)]) {
    assert.ok(validateAssignmentCreation(classForm, trainer, { ...assignment, subject }).assignment.subject);
  }
});

test("a real positive whole subject duration is required", () => {
  for (const subjectDurationHours of ["", "0", "-1", "1.5", "2147483648"]) {
    assert.ok(validateAssignmentCreation(classForm, trainer, { ...assignment, subjectDurationHours }).assignment.subjectDurationHours);
  }
  assert.equal(hasCreationErrors(validateAssignmentCreation(classForm, trainer, { ...assignment, subjectDurationHours: "1" })), false);
});

test("one-submit validation reports class, trainer and assignment errors together", () => {
  const errors = validateAssignmentCreation({ ...classForm, name: "" }, { ...trainer, email: "bad-email" },
    { ...assignment, effectiveFrom: "2026-10-01", role: "INVALID" });
  assert.ok(errors.classDetails.name);
  assert.ok(errors.trainer.email);
  assert.ok(errors.assignment.effectiveFrom);
  assert.ok(errors.assignment.role);
  assert.equal(hasCreationErrors(errors), true);
});

test("optional end date and inclusive same-day effectivity remain supported", () => {
  for (const effectiveTo of ["", assignment.effectiveFrom]) {
    assert.equal(hasCreationErrors(validateAssignmentCreation(classForm, trainer, { ...assignment, effectiveTo })), false);
  }
});
