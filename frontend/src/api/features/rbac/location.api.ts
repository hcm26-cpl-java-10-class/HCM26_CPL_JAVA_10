import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
  LocationDTO,
  LocationFilter,
  LocationNode,
  LocationPayload,
  LocationAiStatus,
  LocationAiAnalysis,
  LocationStaffCandidate,
  LocationImportPreview,
} from "@/types/features/rbac/location";

const path = "/locations";

const base = createBaseApiService<LocationDTO, LocationFilter>({ path });

export const locationApi = Object.assign({}, base, {
  getTree: async (): Promise<LocationNode[]> => {
    const response = await axiosInstance.get(`${path}/tree`);
    return response.data;
  },
  createLocation: (data: LocationPayload): Promise<LocationDTO> =>
    axiosInstance.post<LocationDTO>(path, data).then((response) => response.data),
  updateLocation: (id: number, data: LocationPayload): Promise<LocationDTO> =>
    axiosInstance.put<LocationDTO>(`${path}/${id}`, data).then((response) => response.data),
  getAssignableUsers: (locationId: number, search = ""): Promise<LocationStaffCandidate[]> =>
    axiosInstance.get<LocationStaffCandidate[]>(`${path}/${locationId}/assignable-users`, {
      params: { search },
    }).then((response) => response.data),
  assignUsers: (locationId: number, userIds: number[]): Promise<void> =>
    axiosInstance.post(`${path}/${locationId}/users`, {
      userIds,
    }).then(() => undefined),
  unassignUser: (locationId: number, userId: number): Promise<void> =>
    axiosInstance.delete(`${path}/${locationId}/users/${userId}`).then(() => undefined),
  getAiStatus: (): Promise<LocationAiStatus> =>
    axiosInstance.get<LocationAiStatus>(`${path}/ai/status`).then((response) => response.data),
  analyzeWithAi: (): Promise<LocationAiAnalysis> =>
    axiosInstance.post<LocationAiAnalysis>(`${path}/ai/analyze`, null, {
      timeout: 210000,
    }).then((response) => response.data),
  previewImport: (file: File): Promise<LocationImportPreview> => {
    const formData = new FormData();
    formData.append("file", file);
    return axiosInstance.post<LocationImportPreview>(`${path}/import/preview`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    }).then((response) => response.data);
  },
});