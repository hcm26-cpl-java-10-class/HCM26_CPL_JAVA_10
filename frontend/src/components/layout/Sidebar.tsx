import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { useDispatch } from "react-redux";
import { setLogout } from "@/store/slices/auth/authSlice";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/layout/NavMain";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";
import { LogOutIcon } from "lucide-react";
import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi } from "@/api/features/auth.api";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { iconMap } from "@/components/datatable/iconMap";

export function SidebarMenu({
  collapsible = "icon",
}: {
  collapsible?: "icon" | "offcanvas";
}) {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar, state } = useSidebar();
  const { data: moduleGroups = [] } = useActiveModuleGroups();

  const canManageCourse = useSelector((s: RootState) => s.auth.permissions.includes("ADMIN_ACCESS") && s.auth.permissions.includes("COURSE_READ"));

  const navGroups = useMemo(() => {
    const resolveIcon = (iconName?: string) => {
      const key: keyof typeof iconMap =
        iconName && iconName in iconMap
          ? (iconName as keyof typeof iconMap)
          : "menu";

      return iconMap[key];
    };

    let groups = moduleGroups
      .map((group: any) => ({
        id: group.id ?? group.name ?? "group",
        name: group.name ?? "Menu",
        items: (group.modules || [])
          .filter((module: any) => !!module.url)
          // Temporarily hide standalone "Modules" navigation item under "System Management"
          .filter((module: any) => {
            const isUnderSystemManagement = (group.name || "")
              .toLowerCase()
              .includes("system");
            const isModulesMenu =
              module.url === "/menus" ||
              (module.title || "").toLowerCase() === "modules";

            if (isUnderSystemManagement && isModulesMenu) {
              return false;
            }
            return true;
          })
          .map((module: any) => {
            let normalizedUrl = module.url ?? "#";
            if (normalizedUrl === "/menu-groups") {
              normalizedUrl = "/module-groups";
            } else if (normalizedUrl === "/menus") {
              normalizedUrl = "/modules";
            }

            const isCurrentActive =
              !!module.url &&
              (location.pathname === normalizedUrl ||
                location.pathname === module.url ||
                (normalizedUrl !== "/" && location.pathname.startsWith(`${normalizedUrl}/`)) ||
                (module.url !== "/" && location.pathname.startsWith(`${module.url}/`)));

            return {
              title: module.title ?? "Untitled",
              url: normalizedUrl,
              icon: resolveIcon(module.icon),
              isActive: isCurrentActive,
            };
          }),
      }))
      .filter((group: any) => group.items.length > 0);

    if (canManageCourse) {
      const group = groups.find((g: any) => g.name === "Course Management" || g.name === "Course Online");
      if (group) {
        const items = [
          ["Courses", "/courses", "graduation-cap"],
          ["Enrollments", "/course-enrollments", "bar-chart"],
        ];
        group.items = items.map(([title, url, icon]) => ({
          title,
          url,
          icon: resolveIcon(icon),
          isActive: location.pathname === url || (url === "/course-enrollments" && location.pathname === "/enrollments"),
        }));
      }
    }

    for (const group of groups) {
      if (group.name === "Course Management" || group.name === "Course Online") {
        group.items = group.items.filter((item: any) => ["/courses", "/course-enrollments", "/enrollments"].includes(item.url));
      }
    }

    return groups;
  }, [location.pathname, moduleGroups, canManageCourse]);

  return (
    <Sidebar variant="inset" collapsible={collapsible}>
      {/* Header */}
      <SidebarHeader className="py-3 px-0">
        <Button
          type="button"
          variant="ghost"
          onClick={toggleSidebar}
          className="
            flex h-auto w-full min-w-0 items-center justify-start gap-3 px-3
            group-data-[collapsible=icon]:justify-center
            group-data-[collapsible=icon]:px-0
          "
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue-800 text-sm font-semibold text-white">
            RB
          </div>

          {state === "expanded" && (
            <span className="text-lg font-bold text-blue-800 dark:text-blue-400 truncate">
              RBAC System
            </span>
          )}
        </Button>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        {navGroups.map((group) =>
          group ? (
            <NavMain
              key={group.id}
              title={group.name}
              items={group.items}
              sidebarState={state}
            />
          ) : null,
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-4 text-xs flex flex-row items-center gap-2 text-muted-foreground group-data-[collapsible=icon]:justify-center">
        {state === "expanded" && (
          <span className="flex-1 truncate">RBAC System v1.0</span>
        )}

        <TooltipWrapper content="Logout">
          <Button
            size="icon"
            variant="ghost"
            onClick={async () => {
              try {
                await authApi.logout();
              } finally {
                dispatch(setLogout());
                navigate("/login");
              }
            }}
          >
            <LogOutIcon className="size-4" />
          </Button>
        </TooltipWrapper>
      </SidebarFooter>
    </Sidebar>
  );
}