import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNewClass } from "../src/pages/management/teaching-assignment/new-class-form.ts";

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
