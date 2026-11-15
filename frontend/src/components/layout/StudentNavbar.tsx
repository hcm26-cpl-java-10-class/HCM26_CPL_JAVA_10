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
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import { InvitationBell } from "@/components/features/invitation/InvitationBell";
import { cn } from "@/lib/utils";
import { authApi } from "@/api/features/auth.api";
import { iconMap } from "@/components/datatable/iconMap";
import { getHomePathByRole } from "@/utils/rbac.utils";
import { usePermissions } from "@/hooks/usePermissions";
import { ChevronDown, FileCheck2, LogOutIcon, Menu } from "lucide-react";
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
const STUDENT_HIDDEN_URLS = new Set(["/sprint-backlogs", "/project-board"]);

const STUDENT_MENU_OVERRIDES: Record<string, { title: string; url: string }> = {
  "/sprints": { title: "Backlogs", url: "/backlogs" },
};

const BACKLOGS_URL = "/backlogs";
const MY_SUBMISSIONS_URL = "/student/milestone-submissions";

const SYLLABUS_PATH = "/student/syllabuses";
const ADMIN_ONLY_STUDENT_PREVIEW_PATHS = new Set(["/course-report", "/enrollment-logs"]);

const navButtonClass =
    "h-9 rounded-[10px] border border-transparent px-3 text-sm " +
    "bg-transparent shadow-none " +
    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";

const activeNavClass =
    "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100";

export function StudentNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { activeRole, effectivePermissions, hasPermission } = usePermissions();
  const { data: moduleGroups = [] } = useActiveModuleGroups();
  const { count: pendingInvitationCount } = usePendingInvitations();
  const pathname = normalizePath(location.pathname);

  const canBrowseSyllabuses =
      hasPermission("COURSE_READ");

  const isSyllabusesActive =
      pathname === SYLLABUS_PATH ||
      pathname.startsWith(`${SYLLABUS_PATH}/`);

  const resolveIcon = (moduleIcon?: string) => {
    const key: keyof typeof iconMap =
      moduleIcon && moduleIcon in iconMap ? (moduleIcon as keyof typeof iconMap) : "menu";
    return iconMap[key];
  };

  const navGroups = useMemo(() => {
    const groups = moduleGroups
      .map((group) => {
        const seenUrls = new Set<string>();

        const items = group.modules
          .filter((module) => !!module.url)
          .filter((module) => !module.hiddenInMenu)
          .filter((module) => !ADMIN_ONLY_STUDENT_PREVIEW_PATHS.has(normalizePath(module.url)))
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
          hiddenInMenu: group.hiddenInMenu,
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

    // Keep the personal submissions entry with project work, even when the
    // database menu originally places it under the general Student group.
    for (const group of groups) {
      group.items = group.items.filter((item) => normalizePath(item.url) !== MY_SUBMISSIONS_URL);
    }
    const projectGroup = groups.find((group) => !group.hiddenInMenu && group.items.some((item) =>
      normalizePath(item.url).startsWith("/management/workspaces"),
    )) ?? groups.find((group) => !group.hiddenInMenu && /project|dự án/i.test(group.name));
    const submissionsItem = {
        id: "student-my-submissions",
        title: "My Submissions",
        url: MY_SUBMISSIONS_URL,
        icon: FileCheck2,
        isActive: pathname === MY_SUBMISSIONS_URL || pathname.startsWith(`${MY_SUBMISSIONS_URL}/`),
    };
    if (projectGroup) {
      const workspaceIndex = projectGroup.items.findIndex((item) => normalizePath(item.url).startsWith("/management/workspaces"));
      projectGroup.items.splice(workspaceIndex >= 0 ? workspaceIndex + 1 : 0, 0, submissionsItem);
    } else {
      groups.push({ id: "student-project", name: "Project Management", hiddenInMenu: false, items: [submissionsItem] });
    }

    return groups.filter((group) => !group.hiddenInMenu && group.items.length > 0);
  }, [moduleGroups, pathname, hasPermission]);

  // Pending-invitation badge next to the Invitations entry point.
  const renderPendingBadge = (url: string) => {
    if (normalizePath(url) !== "/invitations" || pendingInvitationCount <= 0) {
      return null;
    }

    return (
      <span
        aria-hidden="true"
        className="ml-auto flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
      >
        {pendingInvitationCount > 9 ? "9+" : pendingInvitationCount}
      </span>
    );
  };

  type NavigationEntry =
    | {
        type: "group";
        group: (typeof navGroups)[number];
      }
    | {
        type: "syllabuses";
      };


  const navigation: NavigationEntry[] = [];

  let syllabusInserted = false;

  // Place Syllabuses after Course Online.
  for (const group of navGroups) {
    navigation.push({
      type: "group",
      group,
    });

    if (
        canBrowseSyllabuses &&
        group.name.toLowerCase().trim() === "course online"
    ) {
      navigation.push({
        type: "syllabuses",
      });

      syllabusInserted = true;
    }
  }

  // Fallback if Course Online is not available.
  if (canBrowseSyllabuses && !syllabusInserted) {
    navigation.push({
      type: "syllabuses",
    });
  }

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
      <header className="border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center gap-3 px-4">

          {/* BRAND */}
          <Button
              type="button"
              variant="ghost"
              onClick={() =>
                  navigate(getHomePathByRole(activeRole, effectivePermissions))
              }
              className="flex h-auto min-w-0 items-center justify-start gap-3 px-0 hover:bg-transparent"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-blue-800 text-sm font-semibold text-white">
              RB
            </div>

            <span className="truncate text-lg font-bold text-blue-800">
            RBAC System
          </span>
          </Button>

          {/* DESKTOP NAVIGATION */}
          <nav
              aria-label="Student navigation"
              className="hidden min-w-0 flex-1 items-center gap-2 lg:flex"
          >
            {navigation.map((entry) => {
              if (entry.type === "syllabuses") {
                return (
                    <Button
                        key="student-syllabuses"
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            navigate(SYLLABUS_PATH)
                        }
                        aria-current={
                          isSyllabusesActive
                              ? "page"
                              : undefined
                        }
                        className={cn(
                            navButtonClass,
                            isSyllabusesActive && activeNavClass
                        )}
                    >
                  <span className="max-w-[180px] truncate">
                    Syllabuses
                  </span>
                    </Button>
                );
              }

              const group = entry.group;

              const groupHasActive =
                  group.items.some(
                      (item) => item.isActive
                  );

              return (
                  <DropdownMenu key={group.id}>
                    <DropdownMenuTrigger asChild>
                      <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                              navButtonClass,
                              groupHasActive && activeNavClass
                          )}
                      >
                    <span className="max-w-[180px] truncate">
                      {group.name}
                    </span>

                        <ChevronDown className="h-4 w-4 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align="start"
                        className="min-w-64"
                    >
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {group.name}
                      </DropdownMenuLabel>

                      <DropdownMenuSeparator />

                      {group.items.map((item) => (
                          <DropdownMenuItem
                              key={`${group.id}-${item.id}-${item.url}`}
                              onClick={() =>
                                  navigate(item.url)
                              }
                              className={cn(
                                  "gap-2",
                                  item.isActive &&
                                  "bg-blue-50 text-blue-800 focus:bg-blue-100 focus:text-blue-800"
                              )}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            {renderPendingBadge(item.url)}
                          </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
              );
            })}
          </nav>

          {/* MOBILE NAVIGATION */}
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

              <DropdownMenuContent
                  align="end"
                  className="w-72"
              >
                {navigation.map((entry, index) => {
                  if (entry.type === "syllabuses") {
                    return (
                        <DropdownMenuItem
                            key="mobile-syllabuses"
                            onClick={() =>
                                navigate(SYLLABUS_PATH)
                            }
                            className={cn(
                                isSyllabusesActive &&
                                "bg-blue-50 text-blue-800"
                            )}
                        >
                          Syllabuses
                        </DropdownMenuItem>
                    );
                  }

                  const group = entry.group;

                  return (
                      <div key={`mobile-${group.id}`}>
                        {index > 0 && (
                            <DropdownMenuSeparator />
                        )}
                        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {group.name}
                        </DropdownMenuLabel>

                        {group.items.map((item) => (
                            <DropdownMenuItem
                                key={`mobile-${group.id}-${item.id}-${item.url}`}
                                onClick={() =>
                                    navigate(item.url)
                                }
                                className={cn(
                                    "gap-2",
                                    item.isActive &&
                                    "bg-blue-50 text-blue-800"
                                )}
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                              {renderPendingBadge(item.url)}
                            </DropdownMenuItem>
                        ))}
                      </div>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* INVITATION BELL */}
            <InvitationBell />

            {/* EXISTING ROLE SWITCHER */}
            <HeaderRight />

            {/* LOGOUT */}
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
