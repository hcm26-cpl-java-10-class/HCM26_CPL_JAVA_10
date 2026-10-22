import assert from "node:assert/strict";
import test from "node:test";
import { toDuplicateInitial } from "../src/pages/management/academic/study_session/duplicate.ts";
import { validateStudySession } from "../src/pages/management/academic/study_session/validation.ts";

for (const status of ["SCHEDULED", "COMPLETED", "CANCELLED"]) {
  test(`duplicate ${status} copies editable fields without changing the source`, () => {
    const source = Object.freeze({ id: 81, subjectId: 2, title: "Java", sessionDate: "2026-12-22",
      startTime: "08:00", endTime: "10:00", room: "A", lecturer: "Lecturer", type: "LAB",
      description: "Practice", status, cancelReason: "Cancelled", notes: "Completed",
      createdAt: "old", updatedAt: "old", createdBy: 1, updatedBy: 1, isActive: true });
    const before = { ...source };
    const draft = toDuplicateInitial(source);
    assert.deepEqual(Object.keys(draft).sort(), ["subjectId", "title", "sessionDate", "startTime", "endTime", "room", "lecturer", "type", "description"].sort());
    for (const key of Object.keys(draft)) assert.equal(draft[key], source[key]);
    draft.title = "New title";
    draft.endTime = "07:00";
    assert.ok(validateStudySession(draft, { relationOptions: { subjectId: [{ id: 2 }] }, relationLoading: {}, relationErrors: {} }).endTime);
    assert.deepEqual(source, before);
    assert.equal(draft.id, undefined);
    assert.equal(draft.status, undefined);
  });
}

import fs from "node:fs";
import ts from "typescript";

function tableHarness(canCreate = true) {
  const state = [];
  let cursor = 0;
  const calls = [];
  const invalidations = [];
  const api = {
    getById: async (id) => { calls.push(["get", id]); return { id: 81, title: "Original" }; },
    create: async (data) => { calls.push(["post", data]); return { ...data, id: 82 }; },
  };
  const mocks = {
    "@/types": { DefaultPagination: { page: 0, size: 10 } },
    "@/api": {},
    "@/components/datatable/util/dataio.utils": {},
    "@/hooks/usePermissions": { usePermissions: () => ({ hasPermission: (key) => key.endsWith("_CREATE") ? canCreate : true }) },
    "@tanstack/react-query": {
      useQueryClient: () => ({ invalidateQueries: (key) => invalidations.push(key) }),
      useQueries: () => [],
      useQuery: () => ({}),
      useMutation: (options) => ({ mutate: async (data) => { await options.mutationFn(data); options.onSuccess?.(); } }),
    },
    react: {
      useMemo: (fn) => fn(), useEffect: () => {},
      useState: (initial) => {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
      },
    },
    axios: { default: { isAxiosError: () => false } },
    sonner: { toast: { error: () => {}, success: () => {} } },
  };
  const source = fs.readFileSync(new URL("../src/components/datatable/hook/useProTable.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((name) => { assert.ok(name in mocks, name); return mocks[name]; }, module, module.exports);
  const schema = { entityName: "study-session", idField: "id", fields: [], duplicateInitial: async (row) => toDuplicateInitial(row) };
  return { calls, invalidations, render: () => { cursor = 0; return module.exports.useProTable(api, schema); } };
}

test("Duplicate only loads a draft; Cancel sends no POST; Save uses Create and refreshes", async () => {
  const harness = tableHarness();
  let table = harness.render();
  await table.openDuplicate({ id: 81 });
  table = harness.render();
  assert.equal(table.isFormOpen, true);
  assert.equal(table.editingRow, null);
  assert.equal(table.createInitial.id, undefined);
  assert.equal(table.createInitial.title, "Original");
  table.setFormOpen(false);
  assert.deepEqual(harness.calls, [["get", "81"]]);
  table = harness.render();
  table.openCreate();
  assert.equal(harness.render().createInitial, null);
  await harness.render().openDuplicate({ id: 81 });
  table = harness.render();
  table.create({ ...table.createInitial, title: "New lesson" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.calls.filter(([method]) => method === "post").length, 1);
  assert.ok(harness.invalidations.length > 0);
  assert.equal(harness.render().isFormOpen, false);
});

test("without Create permission Duplicate cannot fetch or open a form or create", async () => {
  const harness = tableHarness(false);
  const table = harness.render();
  await table.openDuplicate({ id: 81 });
  table.create({ title: "Forbidden" });
  assert.deepEqual(harness.calls, []);
  assert.equal(harness.render().isFormOpen, false);
});
