import { createBaseApiService } from "../base-service.api";
import type { SubjectDTO, SubjectFilter } from "@/types";

export const subjectApi = createBaseApiService<SubjectDTO, SubjectFilter>({
  path: "/api/subjects",
});
