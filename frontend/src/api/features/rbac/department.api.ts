import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { DepartmentDTO, DepartmentFilter, DepartmentTreeNode } from "@/types";

const path = "/departments";

const base = createBaseApiService<DepartmentDTO, DepartmentFilter>({ path });

export const departmentApi = Object.assign({}, base, {
  /** Cây phòng ban (các nút gốc, mỗi nút có children). */
  getTree: async (): Promise<DepartmentTreeNode[]> => {
    const response = await axiosInstance.get<DepartmentTreeNode[]>(`${path}/tree`);
    return response.data;
  },
});
