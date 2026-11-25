import fs from "node:fs";

const path = "src/components/layout/DynamicBreadcrumbs.tsx";
let src = fs.readFileSync(path, "utf8");

const edits = [
  {
    from: `import { iconMap } from "@/components/datatable/iconMap";`,
    to: `import { iconMap } from "@/components/datatable/iconMap";\r\nimport { useTranslation } from "react-i18next";\r\nimport { toLanguage } from "@/i18n/languages";\r\nimport { translateForRender } from "@/i18n/translator";`,
  },
  {
    from: `    const homePath = isStudentVariant ? "/student" : "/";\r\n    const homeLabel = isStudentVariant ? "Student Home" : "Home";`,
    to: `    const homePath = isStudentVariant ? "/student" : "/";\r\n    // D\u1ecbch ngay l\u00fac render \u0111\u1ec3 kh\u00f4ng nh\u00e1y ti\u1ebfng Anh r\u1ed3i m\u1edbi ra ti\u1ebfng Vi\u1ec7t.\r\n    const { i18n } = useTranslation();\r\n    const language = toLanguage(i18n.language);\r\n    const translate = (text: string) => translateForRender(text, language) ?? text;\r\n    const homeLabel = translate(isStudentVariant ? "Student Home" : "Home");`,
  },
  {
    from: `                            <span className="truncate">{node.crumb.title}</span>`,
    to: `                            <span className="truncate">{translate(node.crumb.title)}</span>`,
  },
  {
    from: `                                        <Link to={node.crumb.href} className="truncate">\r\n                                            {node.crumb.title}\r\n                                        </Link>`,
    to: `                                        <Link to={node.crumb.href} className="truncate">\r\n                                            {translate(node.crumb.title)}\r\n                                        </Link>`,
  },
];

for (const edit of edits) {
  if (!src.includes(edit.from)) {
    throw new Error("not found: " + edit.from.slice(0, 60));
  }
  src = src.replace(edit.from, edit.to);
}

fs.writeFileSync(path, src);
console.log("ok");
