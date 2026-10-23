import { createBaseApiService } from "@/api/base-service.api";
import type { SprintDTO, SprintFilter } from "@/types";

const path = "/sprints";

const base = createBaseApiService<SprintDTO, SprintFilter>({
  path: path,
});

export const sprintApi = Object.assign({}, base, {});
