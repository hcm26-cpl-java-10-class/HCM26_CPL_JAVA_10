import { readFileSync, writeFileSync } from "node:fs";

const file = "E:/OJT/HCM26_CPL_JAVA_10/frontend/src/i18n/phrases.ts";
const raw = readFileSync(file, "utf8");
const crlf = raw.includes("\r\n");
let src = raw.replace(/\r\n/g, "\n");
const BT = String.fromCharCode(96);

/** Bỏ dòng trùng khóa trong khối, giữ lần xuất hiện ĐẦU TIÊN (giá trị gốc). */
const dedupeBlock = (source, name) => {
  const marker = "const " + name + " = " + BT;
  const a = source.indexOf(marker);
  if (a === -1) throw new Error("block not found: " + name);
  const contentStart = a + marker.length;
  const c = source.indexOf(BT, contentStart);
  if (c === -1) throw new Error("closing backtick not found: " + name);
  const body = source.slice(contentStart, c);
  const seen = new Set();
  const kept = [];
  let removed = 0;
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      kept.push(line);
      continue;
    }
    const index = trimmed.indexOf(" | ");
    if (index < 0) {
      kept.push(line);
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    kept.push(line);
  }
  console.log(name + ": removed " + removed + " duplicate line(s)");
  return source.slice(0, contentStart) + kept.join("\n") + source.slice(c);
};

src = dedupeBlock(src, "EN_VI");
src = dedupeBlock(src, "VI_EN_EXTRA");

writeFileSync(file, crlf ? src.replace(/\n/g, "\r\n") : src, "utf8");
console.log("deduped");
