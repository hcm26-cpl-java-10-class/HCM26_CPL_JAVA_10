import axiosInstance from "@/api/axios";
import type { CatalogCourse, CatalogPage, CatalogSearchParams } from "@/types";

export interface CourseBookmarkStatusResponse {
  courseId: number;
  saved: boolean;
}

const path = "/course-bookmarks";

export const courseBookmarkApi = {
  getSavedIds: async (): Promise<number[]> => {
    const response = await axiosInstance.get<number[]>(`${path}/ids`);
    return response.data;
  },

  getSavedCourses: async (params: CatalogSearchParams = {}): Promise<CatalogPage<CatalogCourse>> => {
    const { search, categoryId, level, page = 0, size = 12, sort } = params;
    const response = await axiosInstance.get<CatalogPage<CatalogCourse>>(path, {
      params: {
        page,
        size,
        sort,
        search: search?.trim() || undefined,
        categoryId,
        level,
      },
    });
    return response.data;
  },

  save: async (courseId: number): Promise<CourseBookmarkStatusResponse> => {
    const response = await axiosInstance.post<CourseBookmarkStatusResponse>(`${path}/${courseId}`);
    return response.data;
  },

  remove: async (courseId: number): Promise<CourseBookmarkStatusResponse> => {
    const response = await axiosInstance.delete<CourseBookmarkStatusResponse>(`${path}/${courseId}`);
    return response.data;
  },
};
