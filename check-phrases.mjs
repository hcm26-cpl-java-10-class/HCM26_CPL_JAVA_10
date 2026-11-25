import { readFileSync } from "node:fs";
const s = readFileSync("E:/OJT/HCM26_CPL_JAVA_10/frontend/src/i18n/phrases.ts", "utf8").replace(/\r\n/g, "\n");
const BT = String.fromCharCode(96);
const marker = "const EN_VI = " + BT;
const a = s.indexOf(marker);
const c = s.indexOf(BT, a + marker.length);
const enVi = s.slice(a, c);
const lines = enVi.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const seen = new Map();
for (const l of lines) { const k = l.split("|")[0].trim(); if (!seen.has(k)) seen.set(k, []); seen.get(k).push(l); }
for (const [k, v] of seen) if (v.length > 1) console.log(k, "=>", JSON.stringify(v));
