import { createBaseApiService } from "@/api/base-service.api";
import type { SubjectDTO, SubjectFilter } from "@/types";

const base = createBaseApiService<SubjectDTO, SubjectFilter>({
  path: "/subjects",
});

export const subjectApi = Object.assign({}, base, {});