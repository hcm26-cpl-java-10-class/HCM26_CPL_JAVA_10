import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../src/utils/rbac.utils.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { availableAccountViews, canAccessPath, resolveEffectivePermissions, getHomePathByRole } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const admin = ["ADMIN_ACCESS", "USER_READ", "USER_LEARNING_READ"];
const learner = ["LEARNER_ACCESS", "LEARNING_SELF_READ", "COURSE_READ"];
test("admin-only navigation has no learner view or personal learning", () => {
  assert.deepEqual(availableAccountViews(admin), ["ADMIN"]);
  assert.equal(canAccessPath("/my-learning", "ADMIN", admin), false);
  assert.equal(canAccessPath("/profile", "ADMIN", admin), true);
});
test("learner-only navigation blocks administration and permits shared profile", () => {
  assert.deepEqual(availableAccountViews(learner), ["STUDENT"]);
  for (const path of ["/users", "/users/9/detail", "/dashboard", "/roles", "/modules"]) {
    assert.equal(canAccessPath(path, "STUDENT", learner), false);
  }
  assert.equal(canAccessPath("/profile", "STUDENT", learner), true);
  assert.equal(canAccessPath("/my-learning", "STUDENT", learner), true);
});
test("dual accounts retain shared personal access in either view", () => {
  const both = [...admin, ...learner];
  assert.deepEqual(availableAccountViews(both), ["ADMIN", "STUDENT"]);
  for (const view of availableAccountViews(both)) {
    assert.equal(canAccessPath("/profile", view, both), true);
    assert.equal(canAccessPath("/my-learning", view, both), true);
  }
  assert.equal(canAccessPath("/users", "STUDENT", both), false);
  assert.equal(canAccessPath("/users", "ADMIN", both), true);
});
test("preview role maps cannot manufacture grants", () => {
  assert.deepEqual(resolveEffectivePermissions("STUDENT", { STUDENT: learner }, admin), []);
  assert.equal(resolveEffectivePermissions("STUDENT", {}, [...learner, ...admin]).includes("USER_READ"), false);
});
test("all personal aliases require both learning permissions", () => {
  for (const path of ["/my-learning", "/learning", "/fams/my-learning", "/enrollments"]) {
    assert.equal(canAccessPath(path, "ADMIN", ["LEARNER_ACCESS"]), false);
    assert.equal(canAccessPath(path, "ADMIN", learner), true);
  }
});

test("Teacher management view does not expose user administration or personal learning", () => {
  const teacher = ["ADMIN_ACCESS", "COURSE_READ", "BOOK_UPDATE"];
  assert.deepEqual(availableAccountViews(teacher), ["ADMIN"]);
  assert.equal(getHomePathByRole("ADMIN", teacher), "/teacher");
  assert.equal(canAccessPath("/dashboard", "ADMIN", teacher), false);
  assert.equal(canAccessPath("/my-learning", "ADMIN", teacher), false);
  assert.equal(resolveEffectivePermissions("ADMIN", {}, teacher).includes("USER_READ"), false);
});
test("custom-role view options depend on grants rather than names", () => {
  assert.deepEqual(availableAccountViews(["COURSE_READ"]), []);
  assert.equal(getHomePathByRole(null, ["COURSE_READ"]), "/profile");
  assert.equal(getHomePathByRole("ADMIN", ["ADMIN_ACCESS", "COURSE_READ"]), "/courses");
  assert.equal(getHomePathByRole("STUDENT", ["LEARNER_ACCESS", "COURSE_READ"]), "/courses");
});
test("shared profile aliases are exact and trailing slashes retain permission checks", () => {
  assert.equal(canAccessPath("/profile/", "ADMIN", admin), true);
  assert.equal(canAccessPath("/my-learning/", "ADMIN", admin), false);
  assert.equal(canAccessPath("/users/7/profile", "STUDENT", learner), false);
  assert.equal(canAccessPath("/student/exams", "ADMIN", admin), false);
});
