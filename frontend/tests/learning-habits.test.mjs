import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const bundle = await build({
  absWorkingDir: frontend,
  stdin: {
    contents: `
      export { learningHabitsApi } from "./src/api/features/learning-habits.api";
      export { dateOffset, monday, duration, timerDisplay } from
        "./src/pages/management/learning/components/habits/habit-format";
      export { requests } from "@/api/axios";
    `,
    resolveDir: frontend,
  },
  bundle: true,
  write: false,
  format: "esm",
  plugins: [{
    name: "mock-habit-transport",
    setup(plugin) {
      plugin.onResolve({ filter: /^(?:@\/api\/axios|axios)$/ }, args => ({ path: args.path, namespace: "transport" }));
      plugin.onLoad({ filter: /.*/, namespace: "transport" }, () => ({
        contents: `
          export const requests = [];
          export const isAxiosError = () => false;
          export default Object.fromEntries(["get", "post", "put", "patch", "delete"].map(method =>
            [method, async (path, ...args) => {
              requests.push({ method, path, args });
              return { status: path.endsWith("/active") ? 204 : 200, data: [] };
            }]
          ));
        `,
      }));
    },
  }],
});
const { learningHabitsApi, requests, dateOffset, monday, duration, timerDisplay } = await import(
  "data:text/javascript;base64," + Buffer.from(bundle.outputFiles[0].text).toString("base64")
);

test("the timer transport restores the current timer and uses request keys and versions", async () => {
  assert.equal(await learningHabitsApi.active(), null);
  await learningHabitsApi.start("stable-key", 14);
  await learningHabitsApi.transition({ id: 4, version: 8 }, "finish");
  assert.deepEqual(requests.splice(0), [
    { method: "get", path: "/learning/me/study-sessions/active", args: [{ signal: undefined }] },
    { method: "post", path: "/learning/me/study-sessions/start", args: [{ requestKey: "stable-key", courseId: 14 }] },
    { method: "post", path: "/learning/me/study-sessions/4/finish", args: [null, { params: { version: 8 } }] },
  ]);
});

test("history, statistics, and objective filters are passed to personal endpoints", async () => {
  const range = { from: "2026-11-01", to: "2026-11-24" };
  await learningHabitsApi.statistics(range);
  await learningHabitsApi.history({ ...range, page: 1, source: "MANUAL" });
  await learningHabitsApi.objectives({ week: "2026-11-23", completed: false });
  assert.deepEqual(requests.splice(0).map(({ path, args }) => [path, args[0].params]), [
    ["/learning/me/statistics", range],
    ["/learning/me/study-sessions", { ...range, page: 1, source: "MANUAL" }],
    ["/learning/me/objectives", { week: "2026-11-23", completed: false }],
  ]);
});

test("calendar labels use Monday weeks and timer formatting keeps elapsed seconds", () => {
  assert.equal(monday("2027-01-01"), "2026-12-28");
  assert.equal(dateOffset("2026-11-30", 1), "2026-12-01");
  assert.equal(timerDisplay(65), "01:05");
  assert.equal(timerDisplay(3665), "01:01:05");
  assert.equal(duration(15), "15s");
  assert.equal(duration(135 * 60), "2h 15m");
});
