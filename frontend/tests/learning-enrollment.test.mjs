import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, unlinkSync } from "node:fs";

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
globalThis.window = { location: { href: "" }, matchMedia: () => ({ matches: false }) };
const outfile = new URL("./.learning-enrollment.generated.mjs", import.meta.url);
const result = await build({
  stdin: { contents: `
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { Provider } from "react-redux";
    import { configureStore } from "@reduxjs/toolkit";
    import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
    import { MemoryRouter } from "react-router-dom";
    import { RoleSwitchProvider } from "./src/contexts/RoleSwitchContext";
    import { CourseProvider } from "./src/contexts/CourseContext";
    import Catalog from "./src/pages/management/demo/enrollment/CourseEnrollmentsPage";
    import LearningCoursesEntry from "./src/pages/management/learning/LearningCoursesEntry";
    import { LearningRecordsPanel } from "./src/pages/management/learning/components/LearningRecordsPanel";
    import { enrollCourse, personalEnrollmentKey } from "./src/pages/management/learning/learning-enrollment";
    import { coursePageKey } from "./src/integrations/courses/course-queries";
    import { learningCatalogApi } from "./src/pages/management/learning/learning-catalog.api";
    import { enrollmentToCourse } from "./src/pages/management/learning/learning-records.utils";
    import axios from "./src/api/axios";
    export { QueryClient, enrollCourse, personalEnrollmentKey, learningCatalogApi, enrollmentToCourse, axios };
    export function renderCatalog({ courses = [], enrollments = [], permissions = ["LEARNER_ACCESS", "LEARNING_SELF_READ", "ENROLLMENT_CREATE", "COURSE_READ"], email = "alice@example.test", state = "success", panel = false, compact = false, local = [], entry = false } = {}) {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false } } });
      const store = configureStore({ reducer: () => ({ auth: { email, isAuthenticated: true, permissions } }) });
      const key = coursePageKey(email, { page: 0, size: 12, search: "", sort: "id,desc", isActive: true });
      const page = { content: courses, totalElements: courses.length, totalPages: 1 };
      if (state === "success") client.setQueryData(key, page);
      if (state === "error") client.getQueryCache().build(client, { queryKey: key }).setState({ status: "error", fetchStatus: "idle", error: new Error("Test offline") });
      client.setQueryData(coursePageKey(email, { page: 0, size: 20, search: "", sort: "name,asc" }), page);
      client.setQueryData(coursePageKey(email, { page: 0, size: 1, sort: "id,asc" }), page);
      client.setQueryData(coursePageKey(email, { page: 0, size: 10, search: "", sort: "id,asc" }), page);
      client.setQueryData(personalEnrollmentKey(email), enrollments);
      client.setQueryData(["personal-learning", email], { enrolledCourses: enrollments, inProgressCourses: null, completedCourses: null, overallProgress: null, certificates: null, learningActivity: null });
      globalThis.window.localStorage = { getItem: key => key === "app_enrolled_records" ? JSON.stringify(local) : null, setItem() {}, removeItem() {} };
      const html = renderToStaticMarkup(<Provider store={store}><QueryClientProvider client={client}><RoleSwitchProvider><MemoryRouter><CourseProvider>
        {panel ? <LearningRecordsPanel compact={compact} /> : entry ? <LearningCoursesEntry /> : <Catalog />}
      </CourseProvider></MemoryRouter></RoleSwitchProvider></QueryClientProvider></Provider>);
      client.clear(); return html;
    }
  `, resolveDir: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), loader: "tsx" },
  plugins: [{ name: "layout-boundary", setup(build) {
    build.onResolve({ filter: /components\/layout\/MainLayout$/ }, () => ({ path: "test-layout", namespace: "test" }));
    build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: 'import React from "react"; export const MainLayout = ({ children }) => <main>{children}</main>;', loader: "tsx", resolveDir: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1") }));
  } }],
  bundle: true, write: false, platform: "node", format: "esm", packages: "external",
  tsconfig: new URL("../tsconfig.app.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  define: { "import.meta.env": "{}" },
});
writeFileSync(outfile, result.outputFiles[0].text);
let mod;
try { mod = await import(outfile.href); } finally { unlinkSync(outfile); }
const { QueryClient, enrollCourse, personalEnrollmentKey, learningCatalogApi, renderCatalog, enrollmentToCourse, axios } = mod;
const originalEnroll = learningCatalogApi.enroll;
const originalMine = learningCatalogApi.mine;
const clients = [];
afterEach(() => { learningCatalogApi.enroll = originalEnroll; learningCatalogApi.mine = originalMine; for (const client of clients.splice(0)) client.clear(); storage.clear(); });
const account = "alice@example.test";
function clientFor(email = account) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(personalEnrollmentKey(email), []); clients.push(client); return client;
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const course = { id: 12, name: "Java Fundamentals", instructor: "Teacher User", description: "Original description", thumbnailUrl: "https://img.youtube.com/vi/iCYoaTvE9vo/hqdefault.jpg", isActive: true };
const record = { id: 37, courseId: 12, courseName: course.name, instructor: course.instructor, courseDescription: course.description, thumbnailUrl: course.thumbnailUrl };

test("direct enrollment shares rapid requests and updates only after backend confirmation", async () => {
  const client = clientFor(); const response = deferred(); let posts = 0;
  learningCatalogApi.enroll = id => { assert.equal(id, 12); posts++; return response.promise; };
  const first = enrollCourse(client, account, 12, () => true);
  const second = enrollCourse(client, account, 12, () => true);
  assert.equal(first, second); assert.equal(posts, 1);
  assert.deepEqual(client.getQueryData(personalEnrollmentKey(account)), []);
  response.resolve(record);
  assert.equal((await first).created, true);
  assert.deepEqual(client.getQueryData(personalEnrollmentKey(account)), [record]);
  assert.equal((await enrollCourse(client, account, 12, () => true)).created, false);
  assert.equal(posts, 1);
});

test("failed enrollment preserves previous state and propagates the error", async () => {
  const client = clientFor(); const failure = new Error("Offline");
  learningCatalogApi.enroll = async () => { throw failure; };
  learningCatalogApi.mine = async () => [];
  await assert.rejects(enrollCourse(client, account, 12, () => true), failure);
  assert.deepEqual(client.getQueryData(personalEnrollmentKey(account)), []);
});

test("duplicate/conflicting response is reconciled only using backend personal records", async () => {
  const client = clientFor();
  learningCatalogApi.enroll = async () => { throw new Error("Already enrolled"); };
  learningCatalogApi.mine = async () => [record];
  assert.equal((await enrollCourse(client, account, 12, () => true)).created, false);
  assert.deepEqual(client.getQueryData(personalEnrollmentKey(account)), [record]);
});

test("late responses cannot recreate a cleared logout cache or leak into another account", async () => {
  const client = clientFor(); const response = deferred();
  learningCatalogApi.enroll = () => response.promise;
  let currentAccount = account;
  const pending = enrollCourse(client, account, 12, () => currentAccount === account);
  client.clear(); currentAccount = "bob@example.test";
  client.setQueryData(personalEnrollmentKey(currentAccount), []);
  response.resolve(record);
  assert.equal(await pending, null);
  assert.equal(client.getQueryData(personalEnrollmentKey(account)), undefined);
  assert.deepEqual(client.getQueryData(personalEnrollmentKey(currentAccount)), []);
});

test("a fresh login for the same user does not inherit a previous login's in-flight request", async () => {
  const client = clientFor(); const old = deferred(); let calls = 0;
  learningCatalogApi.enroll = () => ++calls === 1 ? old.promise : Promise.resolve(record);
  const stale = enrollCourse(client, account, 12, () => true);
  client.clear(); client.setQueryData(personalEnrollmentKey(account), []);
  const fresh = enrollCourse(client, account, 12, () => true);
  assert.notEqual(stale, fresh); assert.equal(calls, 2);
  await fresh; old.resolve(record);
  assert.equal(await stale, null);
});

test("successful enrollment invalidates personal overview and authorized target views", async () => {
  const client = clientFor();
  client.setQueryData(["personal-learning", account], { enrolledCourses: [] });
  client.setQueryData(["admin-learning", account, "7"], { enrolledCourses: [] });
  learningCatalogApi.enroll = async () => record;
  await enrollCourse(client, account, 12, () => true);
  assert.equal(client.getQueryState(["personal-learning", account]).isInvalidated, true);
  assert.equal(client.getQueryState(["admin-learning", account, "7"]).isInvalidated, true);
});

test("Catalog renders real metadata, direct Enroll, and no confirmation or invented fields", () => {
  const html = renderCatalog({ courses: [course] });
  for (const text of [course.name, course.description, course.instructor, course.thumbnailUrl, ">Enroll<", "Category unavailable", "Level unavailable"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /role="dialog"|Confirm Course Enrollment|Published|Beginner|15%|10 lessons|57m/);
});

test("confirmed enrollment renders green badge and Continue learning after remount", () => {
  for (let visit = 0; visit < 2; visit++) {
    const html = renderCatalog({ courses: [course], enrollments: [record] });
    assert.match(html, /bg-emerald-600/); assert.match(html, /Enrolled/);
    assert.match(html, /Continue learning/); assert.match(html, /href="\/my-learning"/);
    assert.doesNotMatch(html, />Enroll<|15%/);
  }
  const otherUser = renderCatalog({ courses: [course], email: "bob@example.test", local: [record] });
  assert.match(otherUser, />Enroll</); assert.doesNotMatch(otherUser, /Continue learning/);
});

test("My Learning and compact Overview preserve metadata and reject local achievements", () => {
  for (const compact of [false, true]) {
    const html = renderCatalog({ panel: true, compact, enrollments: [record], local: [{ ...record, courseName: "Other account fake", progress: 100 }] });
    assert.match(html, /Java Fundamentals/); assert.match(html, /Teacher User/);
    assert.match(html, /not available|Not available/);
    assert.doesNotMatch(html.replace(/<[^>]*>/g, ""), /Other account fake|100%|15%|Advance|Complete \(100%\)/);
    if (!compact) { assert.ok(html.includes(course.description)); assert.ok(html.includes(course.thumbnailUrl)); }
  }
});

test("admin-only account sees unavailable reports without personal enrollment access", () => {
  const html = renderCatalog({ courses: [course], permissions: ["ADMIN_ACCESS", "COURSE_READ"] });
  assert.match(html, /Learning Progress/); assert.match(html, /Not available/);
  assert.doesNotMatch(html, />Enroll<|Continue learning|My enrollments|>0%<|No learners enrolled|1 learner enrolled/);
});

test("Courses route preserves Course Management for administrators and offers only the Catalog to learners", () => {
  const admin = renderCatalog({ entry: true, permissions: ["ADMIN_ACCESS", "COURSE_READ"] });
  assert.match(admin, /Manage backend course records/);
  assert.match(admin, />Export</);
  const learner = renderCatalog({ entry: true, courses: [course] });
  assert.match(learner, /Courses available/);
  assert.doesNotMatch(learner, /Import \.xlsx|Manage course curriculum|Create Course/);
});

test("loading and API failures are distinct from an empty Catalog", () => {
  assert.match(renderCatalog({ state: "loading" }), /Loading courses/);
  assert.match(renderCatalog({ state: "error" }), /Courses could not be loaded/);
  assert.match(renderCatalog(), /No active courses are available/);
});

test("mapping preserves separate course/enrollment IDs without fabricating progress or next lessons", () => {
  const mapped = enrollmentToCourse(record);
  assert.equal(mapped.id, "37"); assert.equal(mapped.courseId, 12);
  assert.equal(mapped.description, course.description); assert.equal(mapped.thumbnailUrl, course.thumbnailUrl);
  assert.equal(mapped.progress, null); assert.equal(mapped.status, "enrolled");
  assert.equal(mapped.nextItem, undefined); assert.equal(mapped.estimatedCompletion, undefined);
});

test("Course adapter sends real search, sort, page and active filters; lesson totals use minutes", async () => {
  const original = axios.defaults.adapter; const requests = [];
  axios.defaults.adapter = async config => {
    requests.push(config);
    const data = config.url === "/courses" ? { content: [course], totalElements: 1, totalPages: 1 }
      : { content: config.params.page === 0 ? [{ durationMinutes: 3 }, { durationMinutes: 5 }] : [{ durationMinutes: 7 }], totalPages: 2 };
    return { status: 200, statusText: "OK", headers: {}, config, data };
  };
  try {
    await learningCatalogApi.courses(2, 6, " Java ", "name,asc", true);
    assert.deepEqual(requests[0].params, { page: 2, size: 6, search: "Java", sort: "name,asc", isActive: true });
    assert.deepEqual(await learningCatalogApi.lessons(12), { count: 3, minutes: 15 });
    assert.equal(requests[1].params.courseId, 12);
    axios.defaults.adapter = async config => ({ status: 200, statusText: "OK", headers: {}, config, data: { content: [{ durationMinutes: null }], totalPages: 1 } });
    assert.deepEqual(await learningCatalogApi.lessons(12), { count: 1, minutes: null });
  } finally { axios.defaults.adapter = original; }
});
