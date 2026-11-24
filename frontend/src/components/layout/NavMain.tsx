import { useEffect, useRef, useState } from "react";
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

type NavItem = {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
};

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
    const [isOpen, setIsOpen] = useState(true);
    const activeItemRef = useRef<HTMLLIElement>(null);

    // If an item in this group becomes active, make sure the collapsible is open
    useEffect(() => {
        if (groupActive) {
            setIsOpen(true);
        }
    }, [groupActive]);

    // On initial mount or when active item changes, ensure active item is visible in view
    useEffect(() => {
        if (groupActive && activeItemRef.current) {
            activeItemRef.current.scrollIntoView({ block: "nearest", behavior: "auto" });
        }
    }, [groupActive]);

    if (sidebarState !== "expanded") {
        return (
            <>
                {items.map((item) => (
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
                                to={item.url}
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

    return (
        <Collapsible
            key={title}
            open={isOpen}
            onOpenChange={setIsOpen}
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
                        {items.map((subItem) => (
                            <SidebarMenuSubItem
                                key={subItem.title}
                                ref={subItem.isActive ? activeItemRef : undefined}
                            >
                                <SidebarMenuSubButton
                                    asChild
                                    isActive={subItem.isActive}
                                    className="
                                        group
                                        data-[active=true]:bg-blue-800
                                        data-[active=true]:text-white
                                    "
                                >
                                    <Link
                                        to={subItem.url}
                                        className="flex items-center gap-2"
                                    >
                                        <subItem.icon className="h-4 w-4 group-data-[active=true]:text-white" />
                                        <span>{subItem.title}</span>
                                    </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        ))}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </SidebarMenuItem>
        </Collapsible>
    );
}
