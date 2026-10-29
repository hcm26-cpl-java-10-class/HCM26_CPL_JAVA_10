import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { validateAssignmentCreation, hasCreationErrors } from "../src/pages/management/teaching-assignment/assignment-creation.ts";

mock.timers.enable({ apis: ["Date"], now: new Date("2026-10-29T05:00:00Z") });

const classForm = { name: "New class", programName: "New program", programVersion: "1.0", subjectIds: [], startDate: "2026-11-01", endDate: "2026-12-31", plannedSize: "25" };
const trainer = { name: "Freely entered trainer", email: "trainer.free@example.com" };
const assignment = { subject: "New subject", role: "MAIN",
  teachingSlots: [{ date: "2026-12-31", startTime: "08:00", endTime: "10:00" }] };

test("validates the three-section form with freely entered subject and trainer details", () => {
  const errors = validateAssignmentCreation(classForm, trainer, assignment);
  assert.equal(hasCreationErrors(errors), false);
});

test("accepts a freely entered subject without a duration input and validates the name", () => {
  assert.equal(hasCreationErrors(validateAssignmentCreation(classForm, trainer, { ...assignment, subject: "x".repeat(200) })), false);
  for (const subject of ["", "   ", "x".repeat(201)])
    assert.ok(validateAssignmentCreation(classForm, trainer, { ...assignment, subject }).assignment.subject);
});

test("retains free class and program names and their 200-character limit", () => {
  for (const field of ["name", "programName"]) {
    assert.equal(hasCreationErrors(validateAssignmentCreation({ ...classForm, [field]: "x".repeat(200) }, trainer, assignment)), false);
    assert.ok(validateAssignmentCreation({ ...classForm, [field]: "x".repeat(201) }, trainer, assignment).classDetails[field]);
  }
});

test("blank trainer details or an invalid email prevent submission", () => {
  for (const profile of [{ name: "", email: "" }, { name: trainer.name, email: "bad-email" }]) {
    assert.ok(hasCreationErrors(validateAssignmentCreation(classForm, profile, assignment)));
  }
});

test("one-submit validation reports class, trainer and assignment errors together", () => {
  const errors = validateAssignmentCreation({ ...classForm, name: "", startDate: "2026-10-29" }, { ...trainer, email: "bad-email" },
    { ...assignment, subject: "", role: "INVALID", teachingSlots: [] });
  assert.ok(errors.classDetails.name);
  assert.ok(errors.trainer.email);
  assert.ok(errors.classDetails.startDate);
  assert.ok(errors.assignment.subject);
  assert.ok(errors.slots.teachingSlots);
  assert.ok(errors.assignment.role);
  assert.equal(hasCreationErrors(errors), true);
});

test("uses class dates to bound slots without separate effective-date inputs", () => {
  for (const date of [classForm.startDate, classForm.endDate]) {
    assert.equal(hasCreationErrors(validateAssignmentCreation(classForm, trainer, { ...assignment, teachingSlots: [{ ...assignment.teachingSlots[0], date }] })), false);
  }
  for (const date of ["2026-10-31", "2027-01-01"]) {
    assert.ok(validateAssignmentCreation(classForm, trainer, { ...assignment, teachingSlots: [{ ...assignment.teachingSlots[0], date }] }).slots["teachingSlots[0].date"]);
  }
});
