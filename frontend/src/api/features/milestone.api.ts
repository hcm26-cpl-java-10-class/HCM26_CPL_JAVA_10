import axiosInstance from "@/api/axios";
import type { MilestoneOption, PageResponse } from "@/types";

const path = "/backlog-items/milestone-options";

/**
 * Read-only milestone catalog exposed by the temporary backlog module.
 * <p>
 * Only `getPage` is provided because the generic data table (and the form's
 * relation selector) resolve relation options through that method; the backend
 * endpoint returns the full list, so pagination arguments are ignored.
 */
export const milestoneApi = {
  getPage: async (): Promise<PageResponse<MilestoneOption>> => {
    const response = await axiosInstance.get<MilestoneOption[]>(path);
    const content = response.data ?? [];

    return {
      content,
      items: content,
      page: 0,
      size: content.length,
      totalPages: 1,
      totalElements: content.length,
      hasNext: false,
      hasPrevious: false,
    };
  },
};
