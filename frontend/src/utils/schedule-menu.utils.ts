import type { SidebarModule, SidebarModuleGroup } from "@/hooks/useSidebarMenus";

/**
 * The sidebar / student navbar menus are driven by backend Module & ModuleGroup
 * tables. Until the backend exposes a study-schedule module, inject a static
 * "Study Schedule" entry so students and teachers can always reach the page.
 */

const SCHEDULE_URLS = new Set(["/schedule", "/study-schedule"]);

const normalizePath = (path?: string): string => {
  const trimmed = (path || "/").replace(/\/+$/, "");
  return trimmed || "/";
};

const buildScheduleGroup = (): SidebarModuleGroup => ({
  id: -1001,
  name: "Schedule",
  modules: [
    {
      id: -1002,
      title: "Study Schedule",
      name: "Study Schedule",
      url: "/schedule",
      icon: "calendar",
    } as unknown as SidebarModule,
  ],
});

export const injectScheduleMenu = (groups: SidebarModuleGroup[]): SidebarModuleGroup[] => {
  const alreadyExists = groups.some((group) =>
    group.modules.some((module) => module.url && SCHEDULE_URLS.has(normalizePath(module.url))),
  );

  if (alreadyExists) {
    return groups;
  }

  return [...groups, buildScheduleGroup()];
};
