import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { PermissionDTO, PermissionFilter } from "@/types";
import type { RolePermissionMatrixItem } from "@/types/features/rbac/role";

const path = "/permissions";
const base = createBaseApiService<PermissionDTO, PermissionFilter>({ path });

export const permissionApi = Object.assign({}, base, {
  getMatrix: async (): Promise<RolePermissionMatrixItem[]> => {
    const response = await axiosInstance.get<RolePermissionMatrixItem[]>(`${path}/matrix`);
    return response.data;
  },
});
