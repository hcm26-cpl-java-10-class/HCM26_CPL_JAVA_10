import { createBaseApiService } from "@/api/base-service.api";

import type { LessonDTO, LessonFilter } from "@/types";

const path = "/lessons";

const base = createBaseApiService<LessonDTO, LessonFilter>({
  path: path,
});

export const lessonApi = Object.assign({}, base, {
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
