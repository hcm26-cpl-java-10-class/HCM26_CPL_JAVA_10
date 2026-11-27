import fs from "node:fs";

const path = "src/i18n/phrases.ts";
let src = fs.readFileSync(path, "utf8");

const anchor = "})();\r\nKanban Board |";
const idx = src.indexOf(anchor);
if (idx === -1) throw new Error("stray block not found");

// The stray block runs to the end of the file.
src = src.slice(0, idx) + "})();\r\n";

fs.writeFileSync(path, src);
console.log("stray removed");
