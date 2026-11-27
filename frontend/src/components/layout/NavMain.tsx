import { ChevronRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem
} from "@/components/ui/sidebar";
import { useRenderTranslation } from "@/i18n/use-render-translation";

export type NavItem = {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    children?: NavItem[];
    disabled?: boolean;
};

function NavEntry({ item }: { item: NavItem }) {
    // Dịch ngay lúc render để không nháy tiếng Anh rồi mới ra tiếng Việt.
    const title = useRenderTranslation(item.title);

    if (item.children?.length) {
        return (
            <Collapsible asChild defaultOpen className="group/nav-entry">
                <SidebarMenuSubItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuSubButton asChild isActive={item.isActive}>
                            <button type="button" className="w-full">
                                <item.icon />
                                <span>{title}</span>
                                <ChevronRight className="ml-auto transition-transform group-data-[state=open]/nav-entry:rotate-90" />
                            </button>
                        </SidebarMenuSubButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <SidebarMenuSub>
                            {item.children.map((child) => <NavEntry key={child.url || child.title} item={child} />)}
                        </SidebarMenuSub>
                    </CollapsibleContent>
                </SidebarMenuSubItem>
            </Collapsible>
        );
    }

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={item.isActive}
                className="data-[active=true]:bg-blue-800 data-[active=true]:text-white [&[data-active=true]>svg]:text-white">
                {item.disabled ? (
                    <button type="button" disabled className="w-full" title="Coming soon">
                        <item.icon /><span>{title}</span>
                    </button>
                ) : (
                    <Link to={item.url} aria-current={item.isActive ? "page" : undefined}>
                        <item.icon /><span>{title}</span>
                    </Link>
                )}
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    );
}

/**
 * Menu item khi sidebar thu gộn: chỉ hiện icon, tooltip hiển tên đã dịch.
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

const GROUP_STATE_KEY = "sidebar_group_state";

function readGroupState(): Record<string, boolean> {
    try {
        return JSON.parse(localStorage.getItem(GROUP_STATE_KEY) ?? "{}") ?? {};
    } catch {
        return {};
    }
}

function writeGroupState(title: string, open: boolean) {
    try {
        localStorage.setItem(GROUP_STATE_KEY, JSON.stringify({ ...readGroupState(), [title]: open }));
    } catch {
        // storage unavailable; group state simply won't persist
    }
}

export function NavMain({
    title,
    items,
    sidebarState,
}: {
    title: string;
    items: NavItem[];
    sidebarState: "expanded" | "collapsed";
}) {
    const groupActive = items.some((i) => i.isActive);
    const groupTitle = useRenderTranslation(title);
    const [open, setOpen] = useState(() => groupActive || (readGroupState()[title] ?? true));

    const [prevGroupActive, setPrevGroupActive] = useState(groupActive);

    // Always reveal the group that contains the current page.
    if (groupActive !== prevGroupActive) {
        setPrevGroupActive(groupActive);
        if (groupActive) setOpen(true);
    }

    const handleOpenChange = (next: boolean) => {
        setOpen(next);
        writeGroupState(title, next);
    };

    if (sidebarState !== "expanded") {
        return (
            <>
                {items.flatMap((item) => item.children?.length ? item.children : [item]).map((item) => (
                    <CollapsedNavEntry key={item.title} item={item} />
                ))}
            </>
        );
    }

    return (
        <Collapsible
            key={title}
            asChild
            open={open}
            onOpenChange={handleOpenChange}
            className="group/collapsible"
        >
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        tooltip={groupTitle}
                        isActive={groupActive}
                        className="
                            data-[active=true]:data-[state=closed]:bg-blue-800
                            data-[active=true]:data-[state=closed]:text-white
                        "
                    >
                        <span>{groupTitle}</span>
                        <ChevronRight
                            className="
                                ml-auto
                                transition-transform
                                duration-200
                                group-data-[state=open]/collapsible:rotate-90
                            "
                        />
                    </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <SidebarMenuSub>
                        {items.map((item) => <NavEntry key={item.url || item.title} item={item} />)}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}
