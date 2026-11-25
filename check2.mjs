import { readFileSync } from "node:fs";
const s = readFileSync("E:/OJT/HCM26_CPL_JAVA_10/frontend/src/i18n/phrases.ts", "utf8").replace(/\r\n/g, "\n");
const BT = String.fromCharCode(96);
const block = (name) => {
  const marker = "const " + name + " = " + BT;
  const a = s.indexOf(marker);
  const c = s.indexOf(BT, a + marker.length);
  return s.slice(a, c);
};
const enVi = block("EN_VI");
const viEn = block("VI_EN_EXTRA");
for (const k of ["Phòng ban", "Không gian làm việc", "Quản lý dự án", "Khóa học trực tuyến", "Vai trò", "Quyền hạn", "Vị trí"]) {
  console.log("VI_EN has", JSON.stringify(k), viEn.includes("\n" + k + " |"));
}
console.log("---");
for (const k of ["Department", "Workspace", "Project Management", "Online Course", "Online Courses", "Roles", "Permissions", "Location"]) {
  console.log("EN_VI has", JSON.stringify(k), enVi.includes("\n" + k + " |"));
}
