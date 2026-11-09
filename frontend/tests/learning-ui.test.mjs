import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, unlinkSync } from "node:fs";

// Render the actual panel with its Redux/Query providers, without a browser dependency.
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
globalThis.window = { location: { href: "" }, matchMedia: () => ({ matches: false }) };
const outfile = new URL("./.learning-ui.generated.mjs", import.meta.url);
const result = await build({
  stdin: { contents: `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { Provider } from "react-redux";
    import { configureStore } from "@reduxjs/toolkit";
    import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
    import { MemoryRouter } from "react-router-dom";
    import { isolateQuerySession } from "./src/lib/query-session";
    import { mapProfile } from "./src/api/features/profile.api";
    import { LearningRecordsPanel } from "./src/pages/management/learning/components/LearningRecordsPanel";
    import axiosInstance from "./src/api/axios";
    import { store } from "./src/store/store";
    import { setLogin, setLogout } from "./src/store/slices/auth/authSlice";
    export { mapProfile, isolateQuerySession, QueryClient, configureStore, axiosInstance, store, setLogin, setLogout };
    export function renderPanel(userId, courses = [], state = "success") {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
      const store = configureStore({ reducer: () => ({ auth: { email: "me@example.com" } }) });
      const records = enrolledCourses => ({ enrolledCourses, inProgressCourses: null,
        completedCourses: null, overallProgress: null, certificates: null, learningActivity: null });
      if (state === "success") {
        client.setQueryData(["personal-learning", "me@example.com"], records(courses));
        client.setQueryData(["admin-learning", "me@example.com", "99"], records([{ id: 9, courseName: "Target user's course" }]));
      } else if (state === "error") {
        const queryKey = userId ? ["admin-learning", "me@example.com", userId] : ["personal-learning", "me@example.com"];
        client.getQueryCache().build(client, { queryKey }).setState({ status: "error", fetchStatus: "idle", error: new Error("Offline test fixture") });
      }
      const html = renderToStaticMarkup(<Provider store={store}><QueryClientProvider client={client}>
        <MemoryRouter><LearningRecordsPanel userId={userId} /></MemoryRouter>
      </QueryClientProvider></Provider>);
      client.clear();
      return html;
    }
  `, resolveDir: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), loader: "tsx" },
  bundle: true, write: false, platform: "node", format: "esm", packages: "external",
  tsconfig: new URL("../tsconfig.app.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  define: { "import.meta.env": "{}" },
});
writeFileSync(outfile, result.outputFiles[0].text);
let renderPanel, mapProfile, isolateQuerySession, QueryClient, configureStore, axiosInstance, store, setLogin, setLogout;
try { ({ renderPanel, mapProfile, isolateQuerySession, QueryClient, configureStore, axiosInstance, store, setLogin, setLogout } = await import(outfile.href)); } finally { unlinkSync(outfile); }
test("personal panel renders an honest enrollment empty state", () => {
  const html = renderPanel();
  assert.match(html, /You have no course enrollments yet/);
  assert.match(html, /Not available/);
  assert.doesNotMatch(html, /Target user/);
});
test("personal panel cannot consume the administrative target cache", () => {
  const html = renderPanel(undefined, [{ id: 1, courseName: "My own course" }]);
  assert.match(html, /My own course/);
  assert.doesNotMatch(html, /Target user/);
});
test("User Detail panel uses only its target records", () => {
  const html = renderPanel("99", [{ id: 1, courseName: "My own course" }]);
  assert.match(html, /Target user&#x27;s course/);
  assert.doesNotMatch(html, /My own course/);
  assert.match(html, /Certificate records are not available/);
});

test("existing tab and sidebar hierarchy renders without invented progress", () => {
  const html = renderPanel(undefined, [{ id: 1, courseName: "Real enrollment" }]);
  for (const label of ["Enrolled", "In Progress", "Completed", "Saved", "Certificates &amp; Badges", "Learning summary", "Last 4 weeks"]) assert.ok(html.includes(label), label);
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ""), /0%|100%|80%|NaN%|undefined%/);
});
test("profile mapping preserves missing values and returned skills without sample replacements", () => {
  const profile = mapProfile({ email: "me@example.com", fullName: "Me", status: "Active", skills: [] });
  assert.equal(profile.employeeCode, "");
  assert.equal(profile.department, "");
  assert.deepEqual(profile.skills, []);
  assert.deepEqual(mapProfile({ ...profile, skills: ["Actual skill"] }).skills, [{ name: "Actual skill", color: "blue" }]);
});
test("query cache is cleared on account and permission changes but retained for name edits", () => {
  const store = configureStore({ reducer: (state = { auth: { email: "a", isAuthenticated: true, permissions: ["USER_READ"] } }, action) => action.type === "replace" ? { auth: action.auth } : state });
  const client = new QueryClient();
  const stop = isolateQuerySession(client, store);
  client.setQueryData(["user", "detail", 7], "old account");
  store.dispatch({ type: "replace", auth: { ...store.getState().auth, firstName: "Edited" } });
  assert.equal(client.getQueryData(["user", "detail", 7]), "old account");
  store.dispatch({ type: "replace", auth: { ...store.getState().auth, email: "b" } });
  assert.equal(client.getQueryCache().getAll().length, 0);
  client.setQueryData(["admin-learning", "b", 7], "previous scope");
  store.dispatch({ type: "replace", auth: { ...store.getState().auth, permissions: [] } });
  assert.equal(client.getQueryCache().getAll().length, 0);
  stop(); client.clear();
});

test("parallel 401 queries share one token rotation and refresh permission state", async () => {
  const { default: axios, AxiosError } = await import("axios");
  const originalDefault = axios.defaults.adapter;
  const originalInstance = axiosInstance.defaults.adapter;
  let rotations = 0;
  store.dispatch(setLogin({ token: "expired-test-token", email: "refresh@example.com", role: "ADMIN", roles: ["ADMIN"], firstName: "Test", lastName: "", permissions: ["ADMIN_ACCESS", "USER_READ"] }));
  axios.defaults.adapter = async config => {
    rotations++;
    await new Promise(resolve => setTimeout(resolve, 0));
    return { status: 200, statusText: "OK", headers: {}, config, data: {
      accessToken: "fresh-test-token", email: "refresh@example.com", role: "STUDENT", roles: ["STUDENT"],
      permissions: ["LEARNER_ACCESS", "LEARNING_SELF_READ"], rolePermissions: { STUDENT: ["LEARNER_ACCESS", "LEARNING_SELF_READ"] },
    } };
  };
  axiosInstance.defaults.adapter = async config => {
    if (config.headers.Authorization === "Bearer expired-test-token") {
      throw new AxiosError("Expired", "ERR_BAD_RESPONSE", config, null, { status: 401, statusText: "Unauthorized", headers: {}, config });
    }
    return { status: 200, statusText: "OK", data: "own records", headers: {}, config };
  };
  try {
    const results = await Promise.all([axiosInstance.get("/learning/me"), axiosInstance.get("/profile")]);
    assert.equal(rotations, 1);
    assert.deepEqual(results.map(r => r.data), ["own records", "own records"]);
    assert.deepEqual(store.getState().auth.permissions, ["LEARNER_ACCESS", "LEARNING_SELF_READ"]);
  } finally {
    axios.defaults.adapter = originalDefault;
    axiosInstance.defaults.adapter = originalInstance;
    store.dispatch(setLogout());
  }
});

test("loading records do not masquerade as an empty enrolled-course result", () => {
  const html = renderPanel(undefined, [], "loading");
  assert.match(html, /role="status"/);
  assert.match(html, /Loading learning records/);
  assert.doesNotMatch(html, /You have no course enrollments|Overall progress/);
});
test("failed target-user reads show a retryable error rather than empty or personal records", () => {
  const html = renderPanel("99", [], "error");
  assert.match(html, /role="alert"/);
  assert.match(html, /Learning records could not be loaded/);
  assert.match(html, /Retry/);
  assert.doesNotMatch(html, /no course enrollments|My own course|Target user/);
});
