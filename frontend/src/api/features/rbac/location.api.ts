import axiosClient from '@/api/axios';
import type { LocationNode } from '@/types/features/rbac/location';

export const locationApi = {
  getLocationTree: async (): Promise<LocationNode[]> => {
    const response = await axiosClient.get<LocationNode[]>('/v1/locations/tree');
    return response.data;
  },
  createLocation: async (data: any) => {
    const response = await axiosClient.post('/v1/locations', data);
    return response.data;
  },
  deleteLocation: async (id: number | string) => {
    const response = await axiosClient.delete(`/v1/locations/${id}`);
    return response.data;
  },
};