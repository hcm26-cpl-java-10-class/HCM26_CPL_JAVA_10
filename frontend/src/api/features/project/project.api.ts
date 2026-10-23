import { createBaseApiService } from "@/api/base-service.api";

/**
 * Project option read model returned by `GET /api/projects`.
 * Used by the Sprint form to link a sprint to its parent project.
 */
export interface ProjectOptionDTO {
  id: number;
  name: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
}

const path = "/projects";

export const projectApi = createBaseApiService<ProjectOptionDTO, Record<string, unknown>>({
  path,
});
