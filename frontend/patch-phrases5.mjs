import fs from "node:fs";

const path = "src/i18n/phrases.ts";
let src = fs.readFileSync(path, "utf8");

function bounds(decl) {
  const start = src.indexOf(decl);
  if (start === -1) throw new Error("missing " + decl);
  const bodyStart = start + decl.length;
  const bodyEnd = src.indexOf("`;", bodyStart);
  return { bodyStart, bodyEnd };
}

// --- 1. Remove the wrong-direction Vietnamese lines that were appended to EN_VI. ---
const enBounds = bounds("const EN_VI = `");
let enBody = src.slice(enBounds.bodyStart, enBounds.bodyEnd);

const wrongDirection = [
  "Bảng điều khiển dự án | Kanban Board",
  "Phiên bản mẫu dự án | Project Template Versions",
  "Khám phá dự án | Explore Projects",
  "Danh sách backlog | Backlogs",
  "Bài nộp của tôi | My Submissions",
  "Dành cho bạn | For you",
];

for (const line of wrongDirection) {
  enBody = enBody.replace(new RegExp(`\\r?\\n${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), "");
}
src = src.slice(0, enBounds.bodyStart) + enBody + src.slice(enBounds.bodyEnd);

// --- 2. Append the correct entries to VI_EN_EXTRA. ---
const viBounds = bounds("const VI_EN_EXTRA = `");
let viBody = src.slice(viBounds.bodyStart, viBounds.bodyEnd);

const viAdditions = [
  ["Bảng điều khiển dự án", "Kanban Board"],
  ["Phiên bản mẫu dự án", "Project Template Versions"],
  ["Khám phá dự án", "Explore Projects"],
  ["Danh sách backlog", "Backlogs"],
  ["Bài nộp của tôi", "My Submissions"],
  ["Dành cho bạn", "For you"],
  ["Giáo trình", "Syllabuses"],
];

const viExisting = new Set(
  viBody
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("|")[0].trim().toLowerCase()),
);

const toAdd = viAdditions.filter(([vi]) => !viExisting.has(vi.toLowerCase()));
if (toAdd.length) {
  viBody = viBody.replace(/\s*$/, "") + "\r\n" + toAdd.map(([vi, en]) => `${vi} | ${en}`).join("\r\n") + "\r\n";
  src = src.slice(0, viBounds.bodyStart) + viBody + src.slice(viBounds.bodyEnd);
}

fs.writeFileSync(path, src);
console.log("VI_EN_EXTRA added:", toAdd.length);
