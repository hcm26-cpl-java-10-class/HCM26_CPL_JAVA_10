import fs from "node:fs";

const path = "src/i18n/phrases.ts";
let src = fs.readFileSync(path, "utf8");

// 1. Add brand names + missing sidebar phrases to EN_VI.
const enViAnchor = "# ---- Sidebar groups & menus (come from the backend @ResourceMenu) ----";
const enViBlock = [
  "# ---- Brand / product names (must not be machine-translated) ----",
  "RBAC System | RBAC System",
  "RBAC System v1.0 | RBAC System v1.0",
  "FAMS LMS | FAMS LMS",
  "",
  enViAnchor,
].join("\r\n");

if (!src.includes(enViAnchor)) throw new Error("enVi anchor missing");
src = src.replace(enViAnchor, enViBlock);

// 2. Missing sidebar entries.
const missingEnVi = [
  ["Kanban Board", "Bảng điều khiển dự án"],
  ["Project Template Versions", "Phiên bản mẫu dự án"],
  ["Trainees", "Học viên"],
  ["Instructors", "Giảng viên"],
  ["Explore Projects", "Khám phá dự án"],
  ["Student Home", "Trang chủ học viên"],
  ["Home", "Trang chủ"],
  ["Backlogs", "Danh sách backlog"],
  ["My Submissions", "Bài nộp của tôi"],
  ["For you", "Dành cho bạn"],
  ["Syllabuses", "Giáo trình"],
];

const enViEnd = src.indexOf("`;", src.indexOf("const EN_VI = `"));
let enViBody = src.slice(src.indexOf("const EN_VI = `") + "const EN_VI = `".length, enViEnd);

const existingEn = new Set(
  enViBody
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("|")[0].trim().toLowerCase()),
);

const additions = missingEnVi.filter(([en]) => !existingEn.has(en.toLowerCase()));
if (additions.length) {
  enViBody = enViBody.replace(/\s*$/, "") + "\r\n" + additions.map(([en, vi]) => `${en} | ${vi}`).join("\r\n") + "\r\n";
  src = src.slice(0, src.indexOf("const EN_VI = `") + "const EN_VI = `".length) + enViBody + src.slice(enViEnd);
}

// 3. VI -> EN for the new Vietnamese brand/home entries.
const viEnAnchor = "# ---- Sidebar groups & menus ----";
const viEnBlock = [
  "# ---- Brand / product names ----",
  "Hệ thống RBAC | RBAC System",
  "Trang chủ học viên | Student Home",
  "Trang chủ | Home",
  "",
  viEnAnchor,
].join("\r\n");

const viEnStart = src.indexOf("const VI_EN_EXTRA = `");
if (viEnStart === -1) throw new Error("VI_EN_EXTRA missing");
const viEnBodyStart = viEnStart + "const VI_EN_EXTRA = `".length;
const viEnEnd = src.indexOf("`;", viEnBodyStart);
let viEnBody = src.slice(viEnBodyStart, viEnEnd);

if (!viEnBody.includes(viEnAnchor)) {
  viEnBody = viEnBody.replace(/\s*$/, "") + "\r\n" + viEnBlock + "\r\n";
  src = src.slice(0, viEnBodyStart) + viEnBody + src.slice(viEnEnd);
}

fs.writeFileSync(path, src);
console.log("added EN_VI:", additions.length);
