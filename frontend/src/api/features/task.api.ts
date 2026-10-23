import { createBaseApiService } from "@/api/base-service.api";
import type { TaskDTO, TaskFilter } from "@/types";

const path = "/tasks";

const base = createBaseApiService<TaskDTO, TaskFilter>({
  path: path,
});

export const taskApi = Object.assign({}, base, {});
