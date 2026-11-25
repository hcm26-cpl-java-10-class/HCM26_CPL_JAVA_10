import fs from "node:fs";

const s = fs.readFileSync("src/i18n/phrases.ts", "utf8");
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
  ["EN_VI", "RBAC System | RBAC System"],
  ["EN_VI", "Kanban Board | Bảng điều khiển dự án"],
  ["EN_VI", "Project Template Versions | Phiên bản mẫu dự án"],
  ["EN_VI", "Instructors | Giảng viên"],
  ["EN_VI", "Explore Projects | Khám phá dự án"],
  ["EN_VI", "Student Home | Trang chủ học viên"],
  ["EN_VI", "Home | Trang chủ"],
  ["VI_EN_EXTRA", "Hệ thống RBAC | RBAC System"],
  ["VI_EN_EXTRA", "Trang chủ học viên | Student Home"],
  ["VI_EN_EXTRA", "Trang chủ | Home"],
  ["VI_EN_EXTRA", "Giáo trình | Syllabuses"],
  ["VI_EN_EXTRA", "Dành cho bạn | For you"],
];

let bad = 0;
for (const [want, t] of targets) {
  const idx = lines.findIndex((l) => l.trim() === t);
  const sec = idx === -1 ? "-" : sectionOf.get(idx);
  const ok = sec === want;
  if (!ok) bad++;
  console.log(ok ? "OK  " : "BAD ", `[${sec}] (want ${want})  ${t}`);
}
console.log(bad === 0 ? "\nALL GOOD" : `\n${bad} PROBLEM(S)`);
