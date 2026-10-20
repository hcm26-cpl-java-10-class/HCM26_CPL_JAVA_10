import axiosClient from '@/api/axios';
import type { LocationNode } from '@/types';

export const locationApi = {
  getLocationTree: async (): Promise<LocationNode[]> => {
    const response = await axiosClient.get<LocationNode[]>('/api/v1/locations/tree');
    return response.data;
  },
};