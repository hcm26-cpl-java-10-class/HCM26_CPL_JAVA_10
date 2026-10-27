import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveText, trainerTextOptions, parseRole } from "../src/pages/management/teaching-assignment/assignment-text.ts";

const trainers = trainerTextOptions([
  { id: 1, name: "Giảng viên mẫu An", email: "an@example.com" },
  { id: 2, name: "Giảng viên mẫu Bình", email: "binh@example.com" },
]);

test("typed names without accents, exact name tokens and email resolve the existing trainer", () => {
  assert.equal(resolveText("  giang vien mau binh ", trainers), "2");
  assert.equal(resolveText("An", trainers), "1", "An must not ambiguously match the letters in Giang");
  assert.equal(resolveText("BINH@EXAMPLE.COM", trainers), "2");
  assert.equal(resolveText(trainers[0].label, trainers), "1");
});

test("ambiguous names cannot silently bind a different record", () => {
  const duplicate = [...trainers, ...trainerTextOptions([{ id: 3, name: "Giảng viên mẫu An", email: "another.an@example.com" }])];
  assert.equal(resolveText("Giảng viên mẫu An", duplicate), undefined);
  assert.equal(resolveText("An", duplicate), undefined);
  assert.equal(resolveText("an@example.com", duplicate), "1");
  assert.equal(resolveText("3", duplicate), "3");
});

test("unknown IDs, unsafe numeric IDs and arbitrary text never create an association", () => {
  const choices = [{ value: "1", label: "Class 999" }];
  for (const text of ["999", "0", "9007199254740993", "", "   ", "New invented class"]) {
    assert.equal(resolveText(text, choices), undefined);
  }
  assert.equal(resolveText("1", choices), "1");
});

test("subject version and curriculum-row identity remain explicit when codes repeat", () => {
  const subjects = [
    { value: "21", label: "JAVA_CORE · Java · v1.0", aliases: ["JAVA_CORE", "JAVA_CORE v1.0"] },
    { value: "22", label: "JAVA_CORE · Java · v2.0", aliases: ["JAVA_CORE", "JAVA_CORE v2.0"] },
  ];
  assert.equal(resolveText("JAVA_CORE", subjects), undefined);
  assert.equal(resolveText("JAVA_CORE v2.0", subjects), "22");
  assert.equal(resolveText("5", subjects), undefined, "a Subject ID cannot replace the program-subject ID");
});

test("typed roles accept explicit names but cannot silently choose a role from a partial word", () => {
  for (const text of ["MAIN", "main trainer", "Chính", "giang vien chinh"]) assert.equal(parseRole(text), "MAIN");
  for (const text of ["ASSISTANT", "Assistant trainer", "Phụ"]) assert.equal(parseRole(text), "ASSISTANT");
  for (const text of ["", "ma", "ass", "Supervisor"]) assert.equal(parseRole(text), undefined);
});
