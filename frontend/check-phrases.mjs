import fs from "node:fs";

const s = fs.readFileSync("src/i18n/phrases.ts", "utf8");

function section(decl) {
  const bs = s.indexOf(decl) + decl.length;
  const be = s.indexOf("`;", bs);
  return s.slice(bs, be).replace(/\r\n/g, "\n").trimEnd();
}

console.log("--- last 10 lines of EN_VI ---");
console.log(section("const EN_VI = `").split("\n").slice(-10).join("\n"));

console.log("\n--- first 8 lines of VI_EN_EXTRA ---");
console.log(section("const VI_EN_EXTRA = `").split("\n").slice(0, 8).join("\n"));

console.log("\n--- last 10 lines of VI_EN_EXTRA ---");
console.log(section("const VI_EN_EXTRA = `").split("\n").slice(-10).join("\n"));
