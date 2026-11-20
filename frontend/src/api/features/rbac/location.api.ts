import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type { LocationDTO, LocationFilter, LocationNode } from "@/types/features/rbac/location";

const path = "/locations";

const base = createBaseApiService<LocationDTO, LocationFilter>({ path });

export const locationApi = Object.assign({}, base, {
  getTree: async (): Promise<LocationNode[]> => {
    const response = await axiosInstance.get(`${path}/tree`);
    return (response as any).data || response;
  },
});