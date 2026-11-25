import fs from "node:fs";

const path = "src/components/layout/NavMain.tsx";
let src = fs.readFileSync(path, "utf8");

const edits = [
  {
    // Move the hook call out of the inline map callback (Rules of Hooks).
    from: `    if (sidebarState !== "expanded") {\r\n        return (\r\n            <>\r\n                {items.flatMap((item) => item.children?.length ? item.children : [item]).map((item) => (\r\n                    <SidebarMenuItem\r\n                        key={item.title}\r\n                        className="flex justify-center"\r\n                    >\r\n                        <SidebarMenuButton\r\n                            asChild\r\n                            tooltip={useRenderTranslation(item.title)}\r\n                            isActive={item.isActive}`,
    to: `    if (sidebarState !== "expanded") {\r\n        return (\r\n            <>\r\n                {items.flatMap((item) => item.children?.length ? item.children : [item]).map((item) => (\r\n                    <CollapsedNavEntry key={item.title} item={item} />\r\n                ))}\r\n            </>\r\n        );\r\n    }\r\n\r\n    return (\r\n        <Collapsible\r\n            key={title}\r\n            asChild\r\n            open={open}\r\n            onOpenChange={handleOpenChange}\r\n            className="group/collapsible"\r\n        >\r\n            <SidebarMenuItem>\r\n                <CollapsibleTrigger asChild>\r\n                    <SidebarMenuButton\r\n                        tooltip={groupTitle}\r\n                        isActive={groupActive}\r\n                        className="\r\n                            data-[active=true]:data-[state=closed]:bg-blue-800\r\n                            data-[active=true]:data-[state=closed]:text-white\r\n                        "\r\n                    >\r\n                        <span>{groupTitle}</span>\r\n                        <ChevronRight\r\n                            className="\r\n                                ml-auto\r\n                                transition-transform\r\n                                duration-200\r\n                                group-data-[state=open]/collapsible:rotate-90\r\n                            "\r\n                        />\r\n                    </SidebarMenuButton>\r\n                </CollapsibleTrigger>\r\n\r\n                <CollapsibleContent>\r\n                    <SidebarMenuSub>\r\n                        {items.map((item) => <NavEntry key={item.url || item.title} item={item} />)}\r\n                    </SidebarMenuSub>\r\n                </CollapsibleContent>\r\n            </SidebarMenuItem>\r\n        </Collapsible>\r\n    );\r\n}\r\n\r\n/* PLACEHOLDER_REMAINDER */`,
  },
];

for (const edit of edits) {
  if (!src.includes(edit.from)) {
    throw new Error("not found");
  }
  src = src.replace(edit.from, edit.to);
}

// Remove the now-duplicated original block that followed the replaced region.
const marker = "/* PLACEHOLDER_REMAINDER */";
const idx = src.indexOf(marker);
const after = src.slice(idx + marker.length);
const endIdx = after.indexOf("}\r\n\r\nconst GROUP_STATE_KEY");
// Everything between the marker and the end of the original component is now duplicated.
src = src.slice(0, idx + marker.length) + after.slice(endIdx + 3);

const collapsedComponent = `
/**
 * Menu item khi sidebar thu g\u1ed9n: ch\u1ec9 hi\u1ec7n icon, tooltip hi\u1ec3n t\u00ean \u0111\u00e3 d\u1ecbch.
 */
function CollapsedNavEntry({ item }: { item: NavItem }) {
    const title = useRenderTranslation(item.title);

    return (
        <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
                asChild
                tooltip={title}
                isActive={item.isActive}
                className="
                !p-0
                flex
                items-center
                justify-center

                data-[active=true]:!bg-blue-800
                data-[active=true]:!text-white
            "
            >
                <Link
                    to={item.disabled ? "#" : item.url}
                    aria-disabled={item.disabled || undefined}
                    tabIndex={item.disabled ? -1 : undefined}
                    onClick={item.disabled ? (event) => event.preventDefault() : undefined}
                    className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-[10px]
                    transition-colors
                "
                >
                    <item.icon className="h-5 w-5" />
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

const GROUP_STATE_KEY`;

src = src.replace("const GROUP_STATE_KEY", collapsedComponent.trimStart());

fs.writeFileSync(path, src);
console.log("ok");
