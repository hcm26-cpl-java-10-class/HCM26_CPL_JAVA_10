import fs from "node:fs";

const path = "src/i18n/phrases.ts";
let src = fs.readFileSync(path, "utf8");

/**
 * Tìm vị trí kết thúc của một template literal.
 *
 * `indexOf("`;")` không an toàn vì chuỗi `\`;\`` có thể xuất hiện trong comment trước đó.
 * Thay vào đó ta quét từng ký tự, bỏ qua escape và nội dung trong comment.
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
      // Template literal kết thúc khi không có dấu $ ngay trước (tức là không phải ${...}).
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

// --- 1. Gỡ các dòng sai chiều đã bị chèn vào khối nào đó. ---
const wrongDirection = [
  "Bảng điều khiển dự án | Kanban Board",
  "Phiên bản mẫu dự án | Project Template Versions",
  "Khám phá dự án | Explore Projects",
  "Danh sách backlog | Backlogs",
  "Bài nộp của tôi | My Submissions",
  "Dành cho bạn | For you",
  "Giáo trình | Syllabuses",
];

const lines = src.replace(/\r\n/g, "\n").split("\n");
const kept = lines.filter((l) => !wrongDirection.includes(l.trim()));
src = kept.join("\r\n");

// --- 2. Thêm đúng chiều vào VI_EN_EXTRA. ---
const viBounds = sectionBounds("const VI_EN_EXTRA = `");
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
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("|")[0].trim().toLowerCase()),
);

const toAdd = viAdditions.filter(([vi]) => !viExisting.has(vi.toLowerCase()));
viBody = viBody.replace(/\s*$/, "") + "\n" + toAdd.map(([vi, en]) => `${vi} | ${en}`).join("\n") + "\n";
src = src.slice(0, viBounds.bodyStart) + viBody + src.slice(viBounds.bodyEnd);

fs.writeFileSync(path, src);
console.log("VI_EN_EXTRA added:", toAdd.length);
