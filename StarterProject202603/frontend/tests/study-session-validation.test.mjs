import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(relativePath, mocks = {}) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", output)(id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/") || id.startsWith("./")) return new Proxy({}, { get: (_, name) => name });
    return require(id);
  }, module, module.exports);
  return module.exports;
}
const { validateStudySession } = load("src/pages/management/academic/study_session/validation.ts");
const context = { relationOptions: { subjectId: [{ id: 7 }] }, relationLoading: {}, relationErrors: {} };
// Local unit-test fixtures only; no API or database calls.
const valid = { subjectId: "7", title: "Buổi học Java", sessionDate: "2024-02-29", startTime: "08:00", endTime: "09:00", room: "Lab 301", lecturer: "Nguyễn Thị Ánh", type: "LAB", description: "" };
const errors = changes => validateStudySession({ ...valid, ...changes }, context);

test("valid Create/Edit values, past date, Unicode names and realistic rooms", () => {
  for (const room of ["", "302", "Lab 301", "A-302", "Online", "Phòng #2 (A/B)"]) assert.deepEqual(errors({ room }), {});
  for (const lecturer of ["Nguyễn Thị Ánh", "O’Connor", "Jean-Luc", "Nguyễn Văn A (GV 2)"]) assert.deepEqual(errors({ lecturer }), {});
  for (const type of ["LECTURE", "LAB", "EXAM"]) assert.deepEqual(errors({ type, isActive: false }), {});
});
test("required fields and title boundaries", () => {
  for (const title of ["", "     ", "abcd", "a".repeat(151)]) assert.ok(errors({ title }).title);
  for (const title of ["abcde", "a".repeat(150)]) assert.deepEqual(errors({ title }), {});
  for (const field of ["subjectId", "sessionDate", "startTime", "endTime", "lecturer", "type"]) assert.ok(errors({ [field]: "" })[field]);
});
test("description length is validated without trimming or modifying input", () => {
  assert.deepEqual(errors({ description: "a".repeat(500) }), {});
  const data = { ...valid, description: "a".repeat(501) };
  assert.ok(validateStudySession(data, context).description);
  assert.equal(data.description.length, 501);
});
test("invalid dates and times, equal or reversed times", () => {
  for (const sessionDate of ["2025-02-29", "2026-04-31", "2026-13-01", "not-a-date", "19/10/2026"]) assert.ok(errors({ sessionDate }).sessionDate);
  for (const startTime of ["24:00", "08:60", "wrong"]) assert.ok(errors({ startTime }).startTime);
  for (const endTime of ["08:00", "07:59"]) assert.ok(errors({ endTime }).endTime);
  assert.ok(errors({ endTime: "25:00" }).endTime);
  assert.deepEqual(errors({ startTime: "08:00:00", endTime: "08:00:01" }), {});
});
test("invalid lecturer, room, subject and enum", () => {
  for (const lecturer of ["12345", "  ", "A", "a".repeat(101), "Name<script>"]) assert.ok(errors({ lecturer }).lecturer);
  for (const room of ["   ", "A".repeat(31), "<script>"]) assert.ok(errors({ room }).room);
  assert.ok(errors({ subjectId: 99 }).subjectId);
  assert.ok(errors({ type: "PRACTICE" }).type);
  assert.ok(validateStudySession(valid, { ...context, relationLoading: { subjectId: true } }).subjectId);
  assert.ok(validateStudySession(valid, { ...context, relationErrors: { subjectId: "Forbidden" } }).subjectId);
});

function find(node, predicate) {
  if (!node || typeof node !== "object") return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const result = find(child, predicate);
    if (result) return result;
  }
}
test("textarea has a 500-character limit and count/remaining text", () => {
  const { FormFieldRenderer } = load("src/components/datatable/modal/form/FormFieldRenderer.tsx");
  const tree = FormFieldRenderer({ field: { name: "description", label: "Description", type: "textarea", maxLength: 500, showCharacterCount: true }, value: "abc", errorClass: "", onChange: () => {} });
  assert.equal(find(tree, node => node.type === "Textarea").props.maxLength, 500);
  const counter = find(tree, node => node.type === "p" && node.props["aria-live"] === "polite");
  assert.equal(counter.props.children.join(""), "3/500 ký tự · Còn 497 ký tự");
});
test("invalid Save preserves typed values and blocks submission; corrected Save works", () => {
  const state = [], effects = [], dependencies = [];
  let cursor = 0, effectCursor = 0, submitted;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = effectCursor++;
      if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) effects.push(effect);
      dependencies[index] = deps;
    },
  };
  const { FormModal } = load("src/components/datatable/modal/form/FormModal.tsx", { react });
  const props = { open: true, onClose: () => {}, initial: { ...valid }, schema: { entityName: "study-session", validateForm: validateStudySession, fields: Object.keys(valid).map(name => ({ name, type: "text", label: name })) }, relationOptions: context.relationOptions, onSubmit: data => { submitted = data; } };
  const render = () => { cursor = 0; effectCursor = 0; const tree = FormModal(props); while (effects.length) effects.shift()(); return tree; };
  render();
  let tree = render();
  find(tree, node => node.props?.field?.name === "startTime").props.onChange("startTime", "09:00");
  tree = render();
  assert.ok(find(tree, node => node.props?.field?.name === "endTime").props.fieldErrors.length);
  find(tree, node => node.props?.field?.name === "startTime").props.onChange("startTime", "08:00");
  tree = render();
  find(tree, node => node.props?.field?.name === "title").props.onChange("title", "bad");
  tree = render();
  find(tree, node => node.type === "Button" && node.props.children === "Save").props.onClick();
  tree = render();
  assert.equal(submitted, undefined);
  const title = find(tree, node => node.props?.field?.name === "title");
  assert.equal(title.props.value, "bad");
  assert.ok(title.props.fieldErrors.length);
  title.props.onChange("title", "Đã sửa tiêu đề");
  tree = render();
  find(tree, node => node.type === "Button" && node.props.children === "Save").props.onClick();
  assert.equal(submitted.title, "Đã sửa tiêu đề");
  assert.equal(submitted.lecturer, valid.lecturer);
});
