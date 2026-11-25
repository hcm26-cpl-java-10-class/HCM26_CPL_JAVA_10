import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type { CategoryDTO, CategoryFilter, CategoryTreeDTO } from "@/types";

const path = "/categories";

const base = createBaseApiService<CategoryDTO, CategoryFilter>({
  path: path,
});

export const categoryApi = Object.assign({}, base, {
  /** Category hierarchy: root categories with nested `children`. */
  getTree: async (onlyActive = false): Promise<CategoryTreeDTO[]> => {
    const response = await axiosInstance.get<CategoryTreeDTO[]>(`${path}/tree`, {
      params: { onlyActive },
    });
    return response.data;
  },
});