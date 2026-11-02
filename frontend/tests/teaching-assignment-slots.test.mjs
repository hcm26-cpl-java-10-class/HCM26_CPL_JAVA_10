import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTeachingSlots, teachingSlotMinutes, totalTeachingMinutes, formatTeachingDuration } from "../src/pages/management/teaching-assignment/assignment-slots.ts";
import { canSaveAssignmentEdit } from "../src/pages/management/teaching-assignment/assignment-edit.ts";

const slot = { date: "2026-11-02", startTime: "08:00", endTime: "10:00" };
const validate = slots => validateTeachingSlots(slots, "2026-11-01", "2026-11-30");

test("duration is end minus start and totals remain exact to the minute", () => {
  assert.equal(teachingSlotMinutes({ startTime: "08:00", endTime: "09:30" }), 90);
  assert.equal(teachingSlotMinutes({ startTime: "08:50", endTime: "09:21" }), 31);
  assert.equal(totalTeachingMinutes([{ ...slot, startTime: "08:00", endTime: "09:30" }, { ...slot, startTime: "10:00", endTime: "10:45" }]), 135);
  assert.equal(formatTeachingDuration(135), "2 hours 15 minutes");
  assert.equal(formatTeachingDuration(31), "31 minutes");
  for (const endTime of ["", "07:00", "08:00", "25:00"]) assert.equal(teachingSlotMinutes({ startTime: "08:00", endTime }), null);
  assert.equal(totalTeachingMinutes([slot, { ...slot, endTime: "" }]), null);
  assert.equal(formatTeachingDuration(null), "—");
});

test("supports multiple slots on one day, adjacent times and the same hours on different days", () => {
  assert.deepEqual(validate([slot, { ...slot, startTime: "10:00", endTime: "12:00" }, { ...slot, date: "2026-11-03" }]), {});
});
test("rejects overlaps and duplicates without rejecting separate dates", () => {
  for (const next of [slot, { ...slot, startTime: "09:00", endTime: "11:00" }, { ...slot, startTime: "08:30", endTime: "09:00" }])
    assert.ok(validate([slot, next])["teachingSlots[1].startTime"]);
});
test("requires real dates, HH:mm times and a positive same-day interval", () => {
  for (const [field, value] of [["date", ""], ["date", "2026-02-30"], ["startTime", ""], ["startTime", "24:00"],
    ["startTime", "08:00:30"], ["endTime", "08:00"], ["endTime", "07:59"], ["endTime", "25:00"]])
    assert.ok(validate([{ ...slot, [field]: value }])[`teachingSlots[0].${field}`]);
});

test("rejects 29 and exactly 30 minutes and accepts 31 minutes across hour boundaries", () => {
  for (const [startTime, endTime] of [["09:00", "09:29"], ["09:00", "09:30"], ["08:50", "09:20"]])
    assert.equal(validate([{ ...slot, startTime, endTime }])["teachingSlots[0].endTime"], "Each teaching slot must be longer than 30 minutes.");
  for (const [startTime, endTime] of [["09:00", "09:31"], ["08:50", "09:21"], ["23:28", "23:59"]])
    assert.deepEqual(validate([{ ...slot, startTime, endTime }]), {});
});
test("dates must stay within the inclusive effective interval", () => {
  for (const date of ["2026-10-31", "2026-12-01"]) assert.ok(validate([{ ...slot, date }])["teachingSlots[0].date"]);
  for (const date of ["2026-11-01", "2026-11-30"]) assert.deepEqual(validate([{ ...slot, date }]), {});
});
test("requires slots and caps the number of submitted rows", () => {
  assert.ok(validate([]).teachingSlots);
  assert.ok(validate(Array.from({ length: 201 }, () => slot)).teachingSlots);
});
test("changing only the teaching slots invalidates a previously reviewed edit", () => {
  const request = { classId: 1, programSubjectId: 2, trainerId: 1, role: "MAIN", effectiveFrom: "2026-11-01", effectiveTo: "2026-11-30", revision: 3, teachingSlots: [slot] };
  const changed = { ...request, teachingSlots: [{ ...slot, endTime: "11:00" }] };
  assert.equal(canSaveAssignmentEdit(changed, request, { canSave: true, revision: 3 }), false);
});
