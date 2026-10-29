import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { validateNewClass, minimumClassStartDate } from "../src/pages/management/teaching-assignment/new-class-form.ts";

mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-30T05:00:00Z") });

const valid = { name: "Lớp Java Thắng tự đặt", programName: "Chương trình mới tự đặt", programVersion: "1.0", subjectIds: [7], startDate: "2026-10-01", endDate: "2026-12-31", plannedSize: "25" };

test("accepts arbitrary new class names without matching sample classes", () => {
  assert.deepEqual(validateNewClass(valid, [7]), {});
  assert.deepEqual(validateNewClass({ ...valid, name: "Evening class 2026 / OOP" }, [7]), {});
});

test("class and program names accept 200 characters and reject 201", () => {
  for (const field of ["name", "programName"]) {
    assert.equal(validateNewClass({ ...valid, [field]: "x".repeat(200) }, [7])[field], undefined);
    assert.ok(validateNewClass({ ...valid, [field]: "x".repeat(201) }, [7])[field]);
  }
});

test("requires a program name, active subjects, usable class dates and whole student count", () => {
  for (const [field, value] of [["name", "   "], ["name", "x".repeat(201)], ["programName", ""], ["programVersion", ""], ["subjectIds", []], ["subjectIds", [99]], ["subjectIds", [7, 7]],
    ["startDate", "2026-02-30"], ["endDate", "2026-09-30"], ["plannedSize", "0"], ["plannedSize", "25.5"], ["plannedSize", "10001"]]) {
    assert.ok(validateNewClass({ ...valid, [field]: value }, [7])[field], `${field}: ${value}`);
  }
  assert.deepEqual(validateNewClass({ ...valid, endDate: valid.startDate, plannedSize: "1" }, [7]), {});
});

test("rejects past and current dates; accepts tomorrow and later dates", () => {
  const now = new Date("2026-10-29T05:00:00Z");
  for (const startDate of ["2026-10-28", "2026-10-29"]) {
    assert.match(validateNewClass({ ...valid, startDate }, [7], false, now).startDate, /tomorrow or later/);
  }
  for (const startDate of ["2026-10-30", "2026-10-31"]) {
    assert.equal(validateNewClass({ ...valid, startDate }, [7], false, now).startDate, undefined);
  }
});

test("tomorrow follows Vietnam midnight, month/year boundaries and leap years", () => {
  for (const [instant, expected] of [
    ["2026-10-29T16:59:59Z", "2026-10-30"],
    ["2026-10-29T17:00:00Z", "2026-10-31"],
    ["2026-10-31T05:00:00Z", "2026-11-01"],
    ["2026-12-31T05:00:00Z", "2027-01-01"],
    ["2028-02-28T05:00:00Z", "2028-02-29"],
    ["2028-02-29T05:00:00Z", "2028-03-01"],
  ]) assert.equal(minimumClassStartDate(new Date(instant)), expected);
});

test("a form opened before midnight is revalidated against the day at submission", () => {
  const form = { ...valid, startDate: "2026-10-30" };
  assert.equal(validateNewClass(form, [7], false, new Date("2026-10-29T16:59:59Z")).startDate, undefined);
  assert.ok(validateNewClass(form, [7], false, new Date("2026-10-29T17:00:00Z")).startDate);
});
