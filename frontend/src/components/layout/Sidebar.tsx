import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from "@/components/ui/sidebar";

import { NavMain } from "@/components/layout/NavMain";

import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";
import { LogOutIcon } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/api/features/auth.api";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { iconMap } from "@/components/datatable/iconMap";

export function SidebarMenu() {
    const location = useLocation();
    const navigate = useNavigate();
    const { toggleSidebar, state } = useSidebar();
    const { data: moduleGroups = [] } = useActiveModuleGroups();

    const navGroups = useMemo(() => {
        const resolveIcon = (iconName?: string) => {
            const key: keyof typeof iconMap =
                iconName && iconName in iconMap ? (iconName as keyof typeof iconMap) : "menu";

            return iconMap[key];
        };

        return moduleGroups
            .map((group) => ({
                id: group.id ?? group.name ?? "group",
                name: group.name ?? "Menu",
                items: group.modules
                    .filter((module) => !!module.url)
                    .map((module) => ({
                        title: module.title ?? "Untitled",
                        url: module.url ?? "#",
                        icon: resolveIcon(module.icon),
                        isActive:
                            !!module.url &&
                            (location.pathname === module.url || location.pathname.startsWith(`${module.url}/`)),
                    })),
            }))
            .filter((group) => group.items.length > 0);
    }, [location.pathname, moduleGroups]);

    return (
        <Sidebar variant="inset" collapsible="icon">
            {/* Header */}
            <SidebarHeader className="py-3 px-0">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={toggleSidebar}
                    className="
            flex h-auto w-full min-w-0 items-center justify-start gap-3
            group-data-[collapsible=icon]:justify-center
            group-data-[collapsible=icon]:px-0
          "
                >
                    <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue-800 text-sm font-semibold text-white">
                        RB
                    </div>

                    {state === "expanded" && (
                        <span className="text-lg font-bold text-blue-800 truncate">RBAC System</span>
                    )}
                </Button>
            </SidebarHeader>

            {/* Content */}
            <SidebarContent>
                {navGroups.map((group) =>
                    group ? (
                        <NavMain key={group.id} title={group.name} items={group.items} sidebarState={state} />
                    ) : null,
                )}
            </SidebarContent>

            {/* Footer */}
            <SidebarFooter className="p-4 text-xs flex flex-row items-center gap-2 text-muted-foreground group-data-[collapsible=icon]:justify-center">
                {state === "expanded" && <span className="flex-1 truncate">RBAC System v1.0</span>}

                <TooltipWrapper content="Logout">
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                            await authApi.logout();
                            navigate("/login");
                        }}
                    >
                        <LogOutIcon className="size-4" />
                    </Button>
                </TooltipWrapper>
            </SidebarFooter>
        </Sidebar>
    );
}
