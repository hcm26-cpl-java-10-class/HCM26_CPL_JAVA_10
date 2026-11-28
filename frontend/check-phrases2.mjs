import fs from "node:fs";

const s = fs.readFileSync("src/i18n/phrases.ts", "utf8");

console.log("EN_VI decl count:", s.split("const EN_VI = `").length - 1);
console.log("VI_EN_EXTRA decl count:", s.split("const VI_EN_EXTRA = `").length - 1);

const lines = s.replace(/\r\n/g, "\n").split("\n");

let current = "";
const sectionOf = new Map();
lines.forEach((line, i) => {
  if (line.startsWith("const EN_VI = `")) current = "EN_VI";
  else if (line.startsWith("const VI_EN_EXTRA = `")) current = "VI_EN_EXTRA";
  else if (line.startsWith("const EN_JA = `")) current = "EN_JA";
  sectionOf.set(i, current);
});

const targets = [
  "Bảng điều khiển dự án | Kanban Board",
  "Phiên bản mẫu dự án | Project Template Versions",
  "Khám phá dự án | Explore Projects",
  "Danh sách backlog | Backlogs",
  "Bài nộp của tôi | My Submissions",
  "Dành cho bạn | For you",
  "Giáo trình | Syllabuses",
  "Hệ thống RBAC | RBAC System",
];

for (const t of targets) {
  const idx = lines.findIndex((l) => l.trim() === t);
  console.log(
    idx === -1 ? `MISSING  ${t}` : `line ${idx + 1} [${sectionOf.get(idx)}]  ${t}`,
  );
}
