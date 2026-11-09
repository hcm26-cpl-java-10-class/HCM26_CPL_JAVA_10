import { createBaseApiService } from "@/api/base-service.api";
import type { BacklogItemDTO, BacklogItemFilter } from "@/types/features/backlog-item";

export const backlogItemApi = createBaseApiService<BacklogItemDTO, BacklogItemFilter>({
  path: "/backlog-items",
});
