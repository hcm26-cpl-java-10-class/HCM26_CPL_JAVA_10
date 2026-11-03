import { ChevronRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

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

export type NavItem = {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    children?: NavItem[];
    disabled?: boolean;
};

function NavEntry({ item }: { item: NavItem }) {
    if (item.children?.length) {
        return (
            <Collapsible asChild defaultOpen className="group/nav-entry">
                <SidebarMenuSubItem>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuSubButton asChild isActive={item.isActive}>
                            <button type="button" className="w-full">
                                <item.icon />
                                <span>{item.title}</span>
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
                        <item.icon /><span>{item.title}</span>
                    </button>
                ) : (
                    <Link to={item.url} aria-current={item.isActive ? "page" : undefined}>
                        <item.icon /><span>{item.title}</span>
                    </Link>
                )}
            </SidebarMenuSubButton>
        </SidebarMenuSubItem>
    );
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

    /* ================= COLLAPSED =================
       icons only
    ============================================= */
    if (sidebarState !== "expanded") {
        return (
            <>
                {items.flatMap((item) => item.children?.length ? item.children : [item]).map((item) => (
                    <SidebarMenuItem
                        key={item.title}
                        className="flex justify-center"
                    >
                        <SidebarMenuButton
                            asChild
                            tooltip={item.title}
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
                ))}
            </>
        );
    }

    /* ================= EXPANDED =================
             module group + collapsible
    ============================================= */
    return (
        <Collapsible
            key={title}
            asChild
            defaultOpen={true}
            className="group/collapsible"
        >
            <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        tooltip={title}
                        isActive={groupActive}
                        className="
                            data-[active=true]:data-[state=closed]:bg-blue-800
                            data-[active=true]:data-[state=closed]:text-white
                        "
                    >
                        <span>{title}</span>
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
