import HeaderRight from "@/components/layout/HeaderRight";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { cn } from "@/lib/utils";
import { authApi } from "@/api/features/auth.api";
import { iconMap } from "@/components/datatable/iconMap";
import { getHomePathByRole } from "@/utils/rbac.utils";
import { usePermissions } from "@/hooks/usePermissions";
import { ChevronDown, LogOutIcon, Menu } from "lucide-react";
import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { setLogout } from "@/store/slices/auth/authSlice";
import { useQueryClient } from "@tanstack/react-query";

const normalizePath = (path?: string) => {
  const trimmed = (path || "/").replace(/\/+$/, "");
  return trimmed || "/";
};

/**
 * The student persona works with a single backlog entry point: the `Sprints`
 * and `Sprint Backlogs` menus collapse into `Backlogs` -> `/backlogs`.
 */
const STUDENT_HIDDEN_URLS = new Set(["/sprint-backlogs"]);

const STUDENT_MENU_OVERRIDES: Record<string, { title: string; url: string }> = {
  "/sprints": { title: "Backlogs", url: "/backlogs" },
};

const BACKLOGS_URL = "/backlogs";
const MY_SUBMISSIONS_URL = "/student/milestone-submissions";

export function StudentNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { activeRole,  effectivePermissions ,hasPermission} = usePermissions();
  const { data: moduleGroups = [] } = useActiveModuleGroups();
  const pathname = normalizePath(location.pathname);

  const navGroups = useMemo(() => {
    const resolveIcon = (iconName?: string) => {
      const key: keyof typeof iconMap =
        iconName && iconName in iconMap ? (iconName as keyof typeof iconMap) : "menu";

      return iconMap[key];
    };

    const groups = moduleGroups
      .map((group) => {
        const seenUrls = new Set<string>();

        const items = group.modules
          .filter((module) => !!module.url)
          .filter((module) => !STUDENT_HIDDEN_URLS.has(normalizePath(module.url)))
          .map((module) => {
            const override = STUDENT_MENU_OVERRIDES[normalizePath(module.url)];
            const url = override?.url ?? module.url!;

            return {
              id: module.id ?? `${group.id ?? group.name}-module`,
              title: override?.title ?? module.title ?? "Untitled",
              url,
              icon: resolveIcon(module.icon),
              isActive:
                pathname === normalizePath(url) ||
                pathname.startsWith(`${normalizePath(url)}/`),
            };
          })
          .filter((item) => {
            if (seenUrls.has(item.url)) {
              return false;
            }

            seenUrls.add(item.url);
            return true;
          });

        return {
          id: group.id ?? group.name ?? "group",
          name: group.name ?? "Menu",
          items,
        };
      });

    // Safety net: when the sprint module is not configured in the database the
    // student still needs the Backlogs entry point.
    const hasBacklogs = groups.some((group) =>
      group.items.some((item) => item.url === BACKLOGS_URL),
    );

    if (!hasBacklogs && hasPermission("SPRINT_READ")) {
      const projectGroup =
        groups.find((group) => /project/i.test(group.name)) ?? groups[0];

      if (projectGroup) {
        projectGroup.items.push({
          id: "student-backlogs",
          title: "Backlogs",
          url: BACKLOGS_URL,
          icon: resolveIcon("menu"),
          isActive:
            pathname === BACKLOGS_URL || pathname.startsWith(`${BACKLOGS_URL}/`),
        });
      }
    }

    const hasMySubmissions = groups.some((group) =>
      group.items.some((item) => item.url === MY_SUBMISSIONS_URL),
    );
    if (!hasMySubmissions) {
      const projectGroup = groups.find((group) => /project|dự án/i.test(group.name));
      const item = {
        id: "student-my-submissions",
        title: "Bài nộp của tôi",
        url: MY_SUBMISSIONS_URL,
        icon: resolveIcon("menu"),
        isActive: pathname === MY_SUBMISSIONS_URL || pathname.startsWith(`${MY_SUBMISSIONS_URL}/`),
      };
      if (projectGroup) projectGroup.items.push(item);
      else groups.push({ id: "student-project", name: "Dự án", items: [item] });
    }

    return groups.filter((group) => group.items.length > 0);
  }, [moduleGroups, pathname, hasPermission]);

  const hasMenuItems = navGroups.length > 0;

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      queryClient.removeQueries({ queryKey: ["sidebar-menu"] });
      dispatch(setLogout());
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className="bg-sidebar text-sidebar-foreground border-b border-sidebar-border">
      <div className="flex h-16 items-center gap-3 px-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(getHomePathByRole(activeRole, effectivePermissions))}
          className="flex h-auto min-w-0 items-center justify-start gap-3 px-0 hover:bg-transparent"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue-800 text-sm font-semibold text-white">
            RB
          </div>
          <span className="truncate text-lg font-bold text-blue-800">RBAC System</span>
        </Button>

        <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
          {hasMenuItems ? (
            navGroups.map((group) => {
              const groupHasActive = group.items.some((item) => item.isActive);

              return (
                <DropdownMenu key={group.id}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-9 rounded-[10px] border border-transparent px-3 text-sm",
                        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        groupHasActive && "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
                      )}
                    >
                      <span className="max-w-[180px] truncate">{group.name}</span>
                      <ChevronDown className="h-4 w-4 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="min-w-64">
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {group.name}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {group.items.map((item) => (
                      <DropdownMenuItem
                        key={`${group.id}-${item.id}-${item.url}`}
                        onClick={() => navigate(item.url)}
                        className={cn(
                          "gap-2",
                          item.isActive && "bg-blue-50 text-blue-800 focus:bg-blue-100 focus:text-blue-800",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })
          ) : (
            <span className="text-sm text-muted-foreground">No menu items available</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="size-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-72">
              {hasMenuItems ? (
                navGroups.map((group, groupIndex) => (
                  <div key={`mobile-${group.id}`}>
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {group.name}
                    </DropdownMenuLabel>

                    {group.items.map((item) => (
                      <DropdownMenuItem
                        key={`mobile-${group.id}-${item.id}-${item.url}`}
                        onClick={() => navigate(item.url)}
                        className={cn(
                          "gap-2",
                          item.isActive && "bg-blue-50 text-blue-800 focus:bg-blue-100 focus:text-blue-800",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </DropdownMenuItem>
                    ))}

                    {groupIndex < navGroups.length - 1 && <DropdownMenuSeparator />}
                  </div>
                ))
              ) : (
                <DropdownMenuItem disabled>No menu items available</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <HeaderRight />
          <TooltipWrapper content="Logout">
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleLogout}
            >
              <LogOutIcon className="size-4" />
            </Button>
          </TooltipWrapper>
        </div>
      </div>

    </header>
  );
}
