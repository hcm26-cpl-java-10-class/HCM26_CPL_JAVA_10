import { createBaseApiService } from "@/api/base-service.api";
import type { LessonDTO, LessonFilter } from "@/types";

const path = "/lessons";

const base = createBaseApiService<LessonDTO, LessonFilter>({
  path,
});

export const lessonApi = Object.assign({}, base, {});
