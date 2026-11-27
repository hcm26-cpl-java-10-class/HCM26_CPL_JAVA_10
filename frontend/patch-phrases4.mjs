import fs from "node:fs";

const path = "src/i18n/phrases.ts";
let src = fs.readFileSync(path, "utf8");

const additions = [
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

const decl = "const EN_VI = `";
const start = src.indexOf(decl);
if (start === -1) throw new Error("EN_VI missing");
const bodyStart = start + decl.length;
const bodyEnd = src.indexOf("`;", bodyStart);
let body = src.slice(bodyStart, bodyEnd);

const existing = new Set(
  body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("|")[0].trim().toLowerCase()),
);

const missing = additions.filter(([en]) => !existing.has(en.toLowerCase()));
if (missing.length) {
  body = body.replace(/\s*$/, "") + "\r\n" + missing.map(([en, vi]) => `${en} | ${vi}`).join("\r\n") + "\r\n";
  src = src.slice(0, bodyStart) + body + src.slice(bodyEnd);
}

// Verify the VI_EN_EXTRA block also contains the reverse entries.
const viEnDecl = "const VI_EN_EXTRA = `";
const viStart = src.indexOf(viEnDecl);
const viBodyStart = viStart + viEnDecl.length;
const viBodyEnd = src.indexOf("`;", viBodyStart);
let viBody = src.slice(viBodyStart, viBodyEnd);

const viAdditions = [
  ["Hệ thống RBAC", "RBAC System"],
  ["Trang chủ học viên", "Student Home"],
  ["Trang chủ", "Home"],
  ["Bảng điều khiển dự án", "Kanban Board"],
  ["Phiên bản mẫu dự án", "Project Template Versions"],
  ["Giảng viên", "Instructors"],
  ["Khám phá dự án", "Explore Projects"],
  ["Danh sách backlog", "Backlogs"],
  ["Bài nộp của tôi", "My Submissions"],
  ["Dành cho bạn", "For you"],
];

const viExisting = new Set(
  viBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("|")[0].trim().toLowerCase()),
);

const viMissing = viAdditions.filter(([vi]) => !viExisting.has(vi.toLowerCase()));
if (viMissing.length) {
  viBody = viBody.replace(/\s*$/, "") + "\r\n" + viMissing.map(([vi, en]) => `${vi} | ${en}`).join("\r\n") + "\r\n";
  src = src.slice(0, viBodyStart) + viBody + src.slice(viBodyEnd);
}

fs.writeFileSync(path, src);
console.log("EN_VI added:", missing.length, "VI_EN added:", viMissing.length);
