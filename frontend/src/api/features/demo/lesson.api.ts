import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";

import type { LessonDTO, LessonFilter } from "@/types";

const path = "/lessons";

const base = createBaseApiService<LessonDTO, LessonFilter>({
  path: path,
});

export const lessonApi = Object.assign({}, base, {
  uploadAudio: async (file: File): Promise<{ url: string }> => {
    const data = new FormData();
    data.append("file", file);
    const response = await axiosInstance.post<{ url: string }>("/lesson-audio", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  /** Toàn bộ bài học của một section, sắp xếp theo orderIndex tăng dần. */
  getBySection: async (sectionId: number): Promise<LessonDTO[]> => {
    const page = await base.getPage(
      { page: 0, size: 200, sort: "orderIndex,asc" },
      undefined,
      { sectionId },
    );
    return page.content ?? page.items ?? [];
  },
});
