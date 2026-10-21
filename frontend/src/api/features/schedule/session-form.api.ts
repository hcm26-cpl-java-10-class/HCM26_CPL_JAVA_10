import axiosInstance from "@/api/axios";
import { lessonApi } from "@/api/features/demo/lesson.api";
import { roleApi } from "@/api/features/rbac/role.api";
import { userApi } from "@/api/features/rbac/user.api";
import type { LessonDTO, RoleDTO, SessionClassInfo, UserDTO } from "@/types";
import { calendarVersionApi } from "./calendar-version.api";

async function loadAllPages<T>(
  loadPage: (page: number) => Promise<{ content: T[]; totalPages: number }>,
): Promise<T[]> {
  const firstPage = await loadPage(0);
  const items = [...firstPage.content];
  for (let page = 1; page < firstPage.totalPages; page++) {
    const nextPage = await loadPage(page);
    items.push(...nextPage.content);
  }
  return items;
}

export const sessionFormApi = {
  getClass: async (classId: number): Promise<SessionClassInfo> => {
    const response = await axiosInstance.get<SessionClassInfo>(`/external/classes/${classId}`);
    return response.data;
  },

  getDraftVersions: (calendarId: number) =>
    loadAllPages((page) =>
      calendarVersionApi.getVersions(calendarId, page, 100, { status: "DRAFT" }),
    ),

  getTopics: () =>
    loadAllPages<LessonDTO>((page) =>
      lessonApi.getPage({ page, size: 100, sort: "title,asc" }, undefined, {
        ids: [],
        isActive: true,
      }),
    ),

  getTrainers: async (): Promise<UserDTO[]> => {
    const roles = await loadAllPages<RoleDTO>((page) =>
      roleApi.getPage({ page, size: 100 }, undefined, { ids: [], isActive: true }),
    );
    const teacherRole = roles.find((role) => role.name === "TEACHER");
    if (!teacherRole?.id) return [];

    const users = await loadAllPages<UserDTO>((page) =>
      userApi.getPage({ page, size: 100, sort: "firstName,asc" }, undefined, {
        ids: [],
        isActive: true,
      }),
    );
    return users.filter((user) =>
      user.roleIds?.some((roleId) => String(roleId) === String(teacherRole.id)),
    );
  },
};
