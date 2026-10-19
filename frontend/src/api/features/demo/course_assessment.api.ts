import { createBaseApiService } from "@/api/base-service.api";
import type { AssessmentDTO, AssessmentFilter } from "@/types";

const path = "/assessments";

const base = createBaseApiService<AssessmentDTO, AssessmentFilter>({
  path: path,
});

export const assessmentApi = Object.assign({}, base, {});
