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
  new Function("require", "module", "exports", output)((id) => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/")) return {};
    return require(id);
  }, module, module.exports);
  return module.exports;
}

test("statistics API sends only subject/date filters to the read-only endpoint", async () => {
  const calls = [];
  const expected = { total: 12, scheduled: 10, completed: 1, cancelled: 1,
    completionRate: 8.33, cancellationRate: 8.33 };
  const { studySessionApi } = load("src/api/features/academic/study_session.api.ts", {
    "@/api/base-service.api": { createBaseApiService: () => ({}) },
    "@/api/axios": { default: { get: async (...args) => { calls.push(args); return { data: expected }; } } },
  });
  const filter = { subjectId: 7, sessionDateFrom: "2026-10-01", sessionDateTo: "2026-10-31" };
  assert.deepEqual(await studySessionApi.statistics(filter), expected);
  assert.deepEqual(calls, [["/study-sessions/statistics", { params: filter }]]);
});

test("statistics panel renders zero values, empty state, loading and errors", () => {
  const { renderToStaticMarkup } = require("react-dom/server");
  for (const [state, expected] of [
    [{ data: { total: 0, scheduled: 0, completed: 0, cancelled: 0, completionRate: 0, cancellationRate: 0 } }, "Không có buổi học phù hợp"],
    [{ isPending: true }, "Đang tải thống kê"],
    [{ isError: true }, "Không thể tải thống kê"],
  ]) {
    const { StudySessionStatisticsPanel } = load("src/pages/management/academic/study_session/StudySessionStatisticsPanel.tsx", {
      "@tanstack/react-query": { useQuery: ({ queryKey }) => queryKey[0] === "relation" ? { data: [] } : state },
      "@/api": {},
    });
    const html = renderToStaticMarkup(require("react").createElement(StudySessionStatisticsPanel));
    assert.ok(html.includes(expected));
    if (state.data) assert.ok(html.includes("0.00%"));
  }
});
