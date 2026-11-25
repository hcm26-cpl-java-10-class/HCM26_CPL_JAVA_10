import axios from "@/api/axios";
import type { CourseDTO, Enrollment } from "@/types";
import { enrollmentApi } from "@/api/features/demo/enrollment.api";
import { courseData } from "@/integrations/courses/course-data";

export interface CatalogPage {
  content: CourseDTO[];
  totalElements: number;
  totalPages: number;
}

// A Learning adapter over existing contracts. No Course metadata is inferred.
export const learningCatalogApi = {
  courses: async (page: number, size: number, search: string, sort: string, activeOnly: boolean, signal?: AbortSignal): Promise<CatalogPage> =>
    courseData.page({ page, size, search, sort, ...(activeOnly ? { isActive: true } : {}) }, signal),
  enroll: enrollmentApi.enroll,
  mine: async (signal?: AbortSignal): Promise<Enrollment[]> =>
    (await axios.get("/enrollments/my-courses", { signal })).data,
  lessons: async (courseId: number, signal?: AbortSignal): Promise<{ count: number; minutes: number | null }> => {
    let count = 0;
    let minutes: number | null = 0;
    let page = 0;
    while (true) {
      const { data } = await axios.get<{ content: { durationMinutes: number | null; durationSeconds?: number | null }[]; totalPages: number }>("/lessons", {
        signal, params: { courseId, isActive: true, page, size: 100, sort: "id,asc" },
      });
      count += data.content.length;
      for (const lesson of data.content) {
        const duration = lesson.durationSeconds == null ? lesson.durationMinutes : lesson.durationSeconds / 60;
        if (duration == null || !Number.isFinite(duration) || duration < 0) minutes = null;
        else if (minutes !== null) minutes += duration;
      }
      if (++page >= data.totalPages) return { count, minutes };
    }
  },
};
