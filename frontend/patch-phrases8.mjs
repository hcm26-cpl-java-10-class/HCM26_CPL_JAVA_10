import fs from "node:fs";

const path = "src/i18n/phrases.ts";
let src = fs.readFileSync(path, "utf8");

const lines = src.replace(/\r\n/g, "\n").split("\n");

// The stray block sits after the final `})();`.
const endIdx = lines.findIndex((l) => l.trim() === "})();");
if (endIdx === -1) throw new Error("end marker missing");

const tail = lines.slice(endIdx + 1);
const stray = tail.filter((l) => l.includes("|") && l.trim());

if (stray.length) {
  lines.length = endIdx + 1;
  src = lines.join("\n") + "\n";
  fs.writeFileSync(path, src);
}

console.log("removed stray lines:", stray.length);
