import { createBaseApiService } from "@/api/base-service.api";
import type { TrainingClassDTO, TrainingClassFilter } from "@/types";

const base = createBaseApiService<TrainingClassDTO, TrainingClassFilter>({
  path: "/v1/classes",
});

export const trainingClassApi = Object.assign({}, base);
