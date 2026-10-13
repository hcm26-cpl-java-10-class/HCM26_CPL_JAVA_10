import { createBaseApiService } from "@/api/base-service.api";
import type { SubjectDTO, SubjectFilter } from "@/types";

const path = "/subjects";

const base = createBaseApiService<SubjectDTO, SubjectFilter>({
  path,
});

export const subjectApi = Object.assign({}, base, {});
