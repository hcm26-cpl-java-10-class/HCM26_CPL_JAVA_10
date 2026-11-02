import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTrainerProfile } from "../src/pages/management/teaching-assignment/new-trainer-form.ts";

test("trainer names and emails are free text and do not need to match sample profiles", () => {
  assert.deepEqual(validateTrainerProfile("Giảng viên Thắng tự nhập", "trainer1.an@example.com"), {});
  assert.deepEqual(validateTrainerProfile("Another name", "Another.Name+course@example.org"), {});
});

test("trainer name and valid email accept 200 characters and reject 201", () => {
  const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(7)}`;
  assert.equal(email.length, 200);
  assert.deepEqual(validateTrainerProfile("x".repeat(200), email), {});
  assert.ok(validateTrainerProfile("x".repeat(201), email).name);
  assert.ok(validateTrainerProfile("Name", `${email}d`).email);
});

test("trainer input rejects blank names and malformed email addresses", () => {
  assert.ok(validateTrainerProfile(" ", "valid@example.com").name);
  for (const email of ["", "bad-email", "a@@example.com", "a b@example.com"]) {
    assert.ok(validateTrainerProfile("Valid name", email).email);
  }
});
