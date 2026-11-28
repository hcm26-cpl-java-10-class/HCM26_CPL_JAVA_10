import fs from "node:fs";

const path = "src/components/layout/NavMain.tsx";
let src = fs.readFileSync(path, "utf8");

const marker = "/* PLACEHOLDER_REMAINDER */";
const idx = src.indexOf(marker);
if (idx === -1) throw new Error("marker missing");

src = src.slice(0, idx).replace(/\s+$/, "") + "\r\n";

fs.writeFileSync(path, src);
console.log("ok");
