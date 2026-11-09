import axiosInstance from "@/api/axios";
import { createBaseApiService } from "@/api/base-service.api";
import type { RoleDTO, RoleFilter } from "@/types";

const path = "/roles";
const base = createBaseApiService<RoleDTO, RoleFilter>({ path });

export const roleApi = Object.assign({}, base, {
  getPermissionIds: async (id: string | number): Promise<number[]> => {
    const response = await axiosInstance.get<number[]>(`${path}/${id}/permissions`);
    return response.data;
  },
  updatePermissions: async (id: string | number, permissionIds: number[]): Promise<RoleDTO> => {
    const response = await axiosInstance.put<RoleDTO>(`${path}/${id}/permissions`, permissionIds);
    return response.data;
  },
  setSystemRole: async (id: string | number, isSystem: boolean): Promise<RoleDTO> => {
    const response = await axiosInstance.patch<RoleDTO>(`${path}/${id}/system-role`, null, {
      params: { isSystem },
    });
    return response.data;
  },
});
