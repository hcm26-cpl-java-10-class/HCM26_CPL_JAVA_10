import fs from "node:fs";

const path = "src/components/layout/StudentNavbar.tsx";
let src = fs.readFileSync(path, "utf8");

const edits = [
  {
    from: `import { useRoleSwitch } from "@/contexts/RoleSwitchContext";`,
    to: `import { useRoleSwitch } from "@/contexts/RoleSwitchContext";\r\nimport { useTranslate } from "@/i18n/use-render-translation";`,
  },
  {
    from: `  const pathname = normalizePath(location.pathname);`,
    to: `  const pathname = normalizePath(location.pathname);\r\n  // D\u1ecbch ngay l\u00fac render \u0111\u1ec3 kh\u00f4ng nh\u00e1y ti\u1ebfng Anh r\u1ed3i m\u1edbi ra ti\u1ebfng Vi\u1ec7t.\r\n  const translate = useTranslate();`,
  },
  {
    from: `{entry.type === "group" ? entry.group.name : "Syllabuses"}`,
    to: `{entry.type === "group" ? translate(entry.group.name) : "Syllabuses"}`,
  },
  {
    from: `{group.name}`,
    to: `{translate(group.name)}`,
  },
  {
    from: `{entry.group.name}`,
    to: `{translate(entry.group.name)}`,
  },
  {
    from: `<span>{item.title}</span>`,
    to: `<span>{translate(item.title)}</span>`,
  },
  {
    from: `<span className="min-w-0 break-words">{item.title}</span>`,
    to: `<span className="min-w-0 break-words">{translate(item.title)}</span>`,
  },
];

for (const edit of edits) {
  if (!src.includes(edit.from)) {
    throw new Error("not found: " + edit.from.slice(0, 70));
  }
  src = src.split(edit.from).join(edit.to);
}

fs.writeFileSync(path, src);
console.log("ok");
