import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type { CategoryDTO, CategoryFilter, CategoryTreeNode } from "@/types";

const path = "/categories";

const base = createBaseApiService<CategoryDTO, CategoryFilter>({
  path: path,
});

export const categoryApi = Object.assign({}, base, {
  getTree: async (activeOnly = false): Promise<CategoryTreeNode[]> => {
    const response = await axiosInstance.get<CategoryTreeNode[]>(`${path}/tree`, {
      params: { activeOnly },
    });
    return response.data;
  },
});