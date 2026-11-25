import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { writeFileSync, unlinkSync } from "node:fs";

// Mock minimal browser globals for tests importing frontend modules
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = {
  location: { href: "" },
  matchMedia: () => ({ matches: false }),
};

const outfile = new URL("./.dashboard-permissions.generated.mjs", import.meta.url);
const result = await build({
  stdin: {
    contents: `
    export {
      parsePermission,
      formatModuleName,
      getModuleIcon,
      getCategoryIcon,
      KNOWN_MODULE_PREFIXES,
      MODULE_CATEGORY_MAP,
      CATEGORY_ICON_MAP,
      ACTION_SORT_ORDER,
      getPermBadgeStyle,
    } from "./src/pages/management/dashboard/index.tsx";
  `,
    resolveDir: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  packages: "external",
  tsconfig: new URL("../tsconfig.app.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  define: { "import.meta.env": "{}" },
});

writeFileSync(outfile, result.outputFiles[0].text);
let parsePermission, formatModuleName, getModuleIcon, getCategoryIcon, MODULE_CATEGORY_MAP, getPermBadgeStyle;

try {
  ({
    parsePermission,
    formatModuleName,
    getModuleIcon,
    getCategoryIcon,
    MODULE_CATEGORY_MAP,
    getPermBadgeStyle,
  } = await import(outfile.href));
} finally {
  unlinkSync(outfile);
}

test("parses standard CRUD permissions accurately", () => {
  const userRead = parsePermission("USER_READ");
  assert.equal(userRead.module, "USER");
  assert.equal(userRead.type, "READ");
  assert.equal(userRead.label, "Read");

  const courseCreate = parsePermission("COURSE_CREATE");
  assert.equal(courseCreate.module, "COURSE");
  assert.equal(courseCreate.type, "CREATE");
  assert.equal(courseCreate.label, "Create");

  const deptUpdate = parsePermission("DEPARTMENT_UPDATE");
  assert.equal(deptUpdate.module, "DEPARTMENT");
  assert.equal(deptUpdate.type, "UPDATE");
  assert.equal(deptUpdate.label, "Update");

  const roleDelete = parsePermission("ROLE_DELETE");
  assert.equal(roleDelete.module, "ROLE");
  assert.equal(roleDelete.type, "DELETE");
  assert.equal(roleDelete.label, "Delete");
});

test("parses special permissions and multi-word action permissions correctly", () => {
  const adminAccess = parsePermission("ADMIN_ACCESS");
  assert.equal(adminAccess.module, "SYSTEM");
  assert.equal(adminAccess.type, "SPECIAL");
  assert.equal(adminAccess.label, "Admin Access");

  const examTake = parsePermission("EXAM_TAKE");
  assert.equal(examTake.module, "EXAM");
  assert.equal(examTake.type, "SPECIAL");
  assert.equal(examTake.label, "Take Exam");

  const answerCreate = parsePermission("LESSON_ANSWER_CREATE");
  assert.equal(answerCreate.module, "LESSON");
  assert.equal(answerCreate.type, "SPECIAL");
  assert.equal(answerCreate.label, "Answer Create");

  const progressDelete = parsePermission("LESSON_PROGRESS_DELETE");
  assert.equal(progressDelete.module, "LESSON");
  assert.equal(progressDelete.type, "SPECIAL");
  assert.equal(progressDelete.label, "Progress Delete");

  const studentScoreViewOwn = parsePermission("STUDENT_SCORE_VIEW_OWN");
  assert.equal(studentScoreViewOwn.module, "STUDENT_SCORE");
  assert.equal(studentScoreViewOwn.type, "SPECIAL");
  assert.equal(studentScoreViewOwn.label, "View Own");
});

test("formats module names nicely into Title Case", () => {
  assert.equal(formatModuleName("USER"), "User");
  assert.equal(formatModuleName("STUDENT_SCORE"), "Student Score");
  assert.equal(formatModuleName("ARTIFACT_DRAFT"), "Artifact Draft");
});

test("categorizes modules accurately into 6-7 domain categories", () => {
  assert.equal(MODULE_CATEGORY_MAP["COURSE"], "Online Learning");
  assert.equal(MODULE_CATEGORY_MAP["LESSON"], "Online Learning");
  assert.equal(MODULE_CATEGORY_MAP["ARTIFACT"], "Artifact & Submission Management");
  assert.equal(MODULE_CATEGORY_MAP["EXAM"], "Exam Management");
  assert.equal(MODULE_CATEGORY_MAP["BOOK"], "Book & Library Management");
  assert.equal(MODULE_CATEGORY_MAP["USER"], "System & Access Control (RBAC)");
});

test("returns valid icons for categories and modules", () => {
  assert.ok(getCategoryIcon("Online Learning"));
  assert.ok(getCategoryIcon("Other / General"));
  assert.ok(getModuleIcon("USER"));
  assert.ok(getModuleIcon("UNKNOWN"));
});

test("provides distinguishable badge styles for CRUD and Special actions", () => {
  const readStyle = getPermBadgeStyle("READ");
  const createStyle = getPermBadgeStyle("CREATE");
  const specialStyle = getPermBadgeStyle("SPECIAL");

  assert.ok(readStyle.includes("emerald"));
  assert.ok(createStyle.includes("blue"));
  assert.ok(specialStyle.includes("indigo"));
});
