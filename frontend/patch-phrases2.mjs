import fs from "node:fs";

const path = "src/i18n/phrases.ts";
let src = fs.readFileSync(path, "utf8");

const viEnStart = src.indexOf("const VI_EN_EXTRA = `");
if (viEnStart === -1) throw new Error("VI_EN_EXTRA missing");

const bodyStart = viEnStart + "const VI_EN_EXTRA = `".length;
const bodyEnd = src.indexOf("`;", bodyStart);
let body = src.slice(bodyStart, bodyEnd);

const brandBlock = [
  "# ---- Brand / product names ----",
  "Hệ thống RBAC | RBAC System",
  "Trang chủ học viên | Student Home",
  "Trang chủ | Home",
  "",
].join("\r\n");

if (!body.includes("Hệ thống RBAC | RBAC System")) {
  body = brandBlock + body.replace(/^\s*\r?\n/, "");
  src = src.slice(0, bodyStart) + body + src.slice(bodyEnd);
}

fs.writeFileSync(path, src);
console.log("ok");
