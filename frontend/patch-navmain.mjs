import fs from "node:fs";

const path = "src/components/layout/NavMain.tsx";
let src = fs.readFileSync(path, "utf8");

const edits = [
  {
    from: `} from "@/components/ui/sidebar";`,
    to: `} from "@/components/ui/sidebar";\r\nimport { useRenderTranslation } from "@/i18n/use-render-translation";`,
  },
  {
    from: `function NavEntry({ item }: { item: NavItem }) {\r\n    if (item.children?.length) {`,
    to: `function NavEntry({ item }: { item: NavItem }) {\r\n    // D\u1ecbch ngay l\u00fac render \u0111\u1ec3 kh\u00f4ng nh\u00e1y ti\u1ebfng Anh r\u1ed3i m\u1edbi ra ti\u1ebfng Vi\u1ec7t.\r\n    const title = useRenderTranslation(item.title);\r\n\r\n    if (item.children?.length) {`,
  },
  {
    from: `<span>{item.title}</span>\r\n                                <ChevronRight`,
    to: `<span>{title}</span>\r\n                                <ChevronRight`,
  },
  {
    from: `<item.icon /><span>{item.title}</span>\r\n                    </button>`,
    to: `<item.icon /><span>{title}</span>\r\n                    </button>`,
  },
  {
    from: `<item.icon /><span>{item.title}</span>\r\n                    </Link>`,
    to: `<item.icon /><span>{title}</span>\r\n                    </Link>`,
  },
  {
    from: `                            tooltip={item.title}\r\n                            isActive={item.isActive}`,
    to: `                            tooltip={useRenderTranslation(item.title)}\r\n                            isActive={item.isActive}`,
  },
  {
    from: `    const groupActive = items.some((i) => i.isActive);`,
    to: `    const groupActive = items.some((i) => i.isActive);\r\n    const groupTitle = useRenderTranslation(title);`,
  },
  {
    from: `                        tooltip={title}\r\n                        isActive={groupActive}`,
    to: `                        tooltip={groupTitle}\r\n                        isActive={groupActive}`,
  },
  {
    from: `                        <span>{title}</span>\r\n                        <ChevronRight`,
    to: `                        <span>{groupTitle}</span>\r\n                        <ChevronRight`,
  },
];

for (const edit of edits) {
  if (!src.includes(edit.from)) {
    throw new Error("not found: " + edit.from.slice(0, 70));
  }
  src = src.replace(edit.from, edit.to);
}

fs.writeFileSync(path, src);
console.log("ok");
