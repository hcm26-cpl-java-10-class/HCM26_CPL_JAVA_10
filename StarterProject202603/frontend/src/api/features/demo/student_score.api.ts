import { createBaseApiService } from "@/api/base-service.api";
import type { StudentScoreDTO, StudentScoreFilter } from "@/types";

const path = "/student-scores";

const base = createBaseApiService<StudentScoreDTO, StudentScoreFilter>({
  path,
});

export const studentScoreApi = Object.assign({}, base, {});
