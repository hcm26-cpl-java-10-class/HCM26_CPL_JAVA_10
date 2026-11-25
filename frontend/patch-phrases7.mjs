import fs from "node:fs";

const path = "src/i18n/phrases.ts";
let src = fs.readFileSync(path, "utf8");

/**
 * Tìm vị trí kết thúc của một template literal.
 *
 * `indexOf("`;")` không an toàn vì chuỗi `\`;\`` có thể xuất hiện trong comment trước đó.
 */
function findTemplateEnd(text, from) {
  let i = from;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === "`") {
      const prev = text[i - 1];
      if (prev !== "$") return i;
      i += 1;
      continue;
    }
    i += 1;
  }
  return -1;
}

function sectionBounds(decl) {
  const start = src.indexOf(decl);
  if (start === -1) throw new Error("missing " + decl);
  const bodyStart = start + decl.length;
  const bodyEnd = findTemplateEnd(src, bodyStart);
  if (bodyEnd === -1) throw new Error("no end for " + decl);
  return { bodyStart, bodyEnd };
}

// 1. Gỡ các dòng EN->VI bị chèn nhầm vào khối EN_JA.
const stray = [
  "Kanban Board | Bảng điều khiển dự án",
  "Project Template Versions | Phiên bản mẫu dự án",
  "Instructors | Giảng viên",
  "Explore Projects | Khám phá dự án",
  "Student Home | Trang chủ học viên",
];

const jaBounds = sectionBounds("const EN_JA = `");
let jaBody = src.slice(jaBounds.bodyStart, jaBounds.bodyEnd);

for (const line of stray) {
  jaBody = jaBody.replace(new RegExp(`\\n${line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), "");
}
src = src.slice(0, jaBounds.bodyStart) + jaBody + src.slice(jaBounds.bodyEnd);

// 2. Chèn đúng vào khối EN_VI.
const enBounds = sectionBounds("const EN_VI = `");
let enBody = src.slice(enBounds.bodyStart, enBounds.bodyEnd);

const enAdditions = [
  ["Kanban Board", "Bảng điều khiển dự án"],
  ["Project Template Versions", "Phiên bản mẫu dự án"],
  ["Instructors", "Giảng viên"],
  ["Explore Projects", "Khám phá dự án"],
  ["Student Home", "Trang chủ học viên"],
  ["Trainees", "Học viên"],
];

const enExisting = new Set(
  enBody
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("|")[0].trim().toLowerCase()),
);

const toAdd = enAdditions.filter(([en]) => !enExisting.has(en.toLowerCase()));
if (toAdd.length) {
  enBody = enBody.replace(/\s*$/, "") + "\n" + toAdd.map(([en, vi]) => `${en} | ${vi}`).join("\n") + "\n";
  src = src.slice(0, enBounds.bodyStart) + enBody + src.slice(enBounds.bodyEnd);
}

fs.writeFileSync(path, src);
console.log("EN_VI added:", toAdd.length);
