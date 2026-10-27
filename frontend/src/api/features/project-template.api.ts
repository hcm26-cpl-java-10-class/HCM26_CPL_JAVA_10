import axiosInstance from "@/api/axios";
import type { ProjectTemplateOption } from "@/types/features/team-allocation";

/**
 * US-10: project templates that can be assigned to a DRAFT team.
 *
 * The endpoint is intentionally mounted on `/v1/project-templates` (not the
 * versioned `/project-template-versions` CRUD surface) because it only exposes
 * the assignable catalogue with the `min_members` / `max_members` window.
 */
export const projectTemplateApi = {
  async getOptions(): Promise<ProjectTemplateOption[]> {
    const response = await axiosInstance.get<ProjectTemplateOption[]>(
      "/v1/project-templates/options",
    );
    return response.data;
  },
};
