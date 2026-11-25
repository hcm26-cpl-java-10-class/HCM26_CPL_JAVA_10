import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const result = await build({
  absWorkingDir: root,
  entryPoints: ["src/pages/management/learning/components/reports/report-content.ts"],
  bundle: true,
  write: false,
  format: "esm",
  plugins: [{ name: "mock-axios", setup(plugin) {
    plugin.onResolve({ filter: /^axios$/ }, () => ({ path: "axios", namespace: "mock" }));
    plugin.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: "export const isAxiosError = () => false;" }));
  } }],
});
const { reportPeriod, reportBlocks } = await import("data:text/javascript;base64," +
  Buffer.from(result.outputFiles[0].text).toString("base64"));

test("report dates are Monday-based and quarters are calendar quarters", () => {
  assert.deepEqual(reportPeriod("WEEKLY", "2026-11-25", "2026-11-25"),
    { from: "2026-11-23", to: "2026-11-25", ongoing: true });
  assert.deepEqual(reportPeriod("QUARTERLY", "2026-08-25", "2026-11-25"),
    { from: "2026-07-01", to: "2026-09-30", ongoing: false });
  assert.deepEqual(reportPeriod("MONTHLY", "2024-02-15", "2026-11-25"),
    { from: "2024-02-01", to: "2024-02-29", ongoing: false });
});

test("Vietnamese detail and PDF use the same saved statistics and hide unavailable fields", () => {
  const blocks = reportBlocks({
    report: { language: "VI", sections: ["OVERVIEW", "AI"], aiStatus: "UNAVAILABLE" },
    snapshot: { overview: { enrolled: 5, enrolledInPeriod: 2, completed: 2, inProgress: 2,
      notStarted: 1, unknown: 0, completionRate: 40, averageProgress: null }, limitations: [] },
    analysis: null,
    evidence: {},
  });
  assert.deepEqual(blocks.map(block => block.title), ["Tổng quan học tập", "Phân tích và đề xuất của AI"]);
  assert.deepEqual(blocks[0].rows.slice(-2), [["Tỷ lệ hoàn thành hiện tại", "40%"], ["Tiến độ khóa trung bình", "—"]]);
  assert.equal(blocks[1].rows[0][1], "Phân tích AI không khả dụng");
});
