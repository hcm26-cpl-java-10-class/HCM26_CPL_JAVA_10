import { createBaseApiService } from "@/api/base-service.api";
import type { CourseDTO, CourseFilter } from "@/types";

const path = "/courses";

const base = createBaseApiService<CourseDTO, CourseFilter>({
  path: path,
});

export const courseApi = Object.assign({}, base, {});
