import { createBaseApiService } from "@/api/base-service.api";
import axiosInstance from "@/api/axios";
import type {
  InvitationDTO,
  StudentInvitationDTO,
  InvitationFilter,
  BatchInvitationRequest,
  BatchInvitationResponse,
  RevokeInvitationRequest,
} from "@/types";

const baseInvitationApi = createBaseApiService<InvitationDTO, InvitationFilter>({
  path: "/invitations",
});

export const invitationApi = {
  ...baseInvitationApi,

  delete: async (id: number | string): Promise<void> => {
    return baseInvitationApi.delete(String(id));
  },

  getMyInvitations: async (): Promise<StudentInvitationDTO[]> => {
    const response = await axiosInstance.get<StudentInvitationDTO[]>("/invitations/my");
    return response.data;
  },

  accept: async (id: number | string): Promise<StudentInvitationDTO> => {
    const response = await axiosInstance.post<StudentInvitationDTO>(`/invitations/${id}/accept`);
    return response.data;
  },

  inviteSingle: async (data: Partial<InvitationDTO>): Promise<InvitationDTO> => {
    const response = await axiosInstance.post<InvitationDTO>("/invitations/actions/invite", data);
    return response.data;
  },

  inviteBatch: async (data: BatchInvitationRequest): Promise<BatchInvitationResponse> => {
    const response = await axiosInstance.post<BatchInvitationResponse>("/invitations/actions/batch", data);
    return response.data;
  },

  resend: async (id: number | string): Promise<InvitationDTO> => {
    const response = await axiosInstance.post<InvitationDTO>(`/invitations/actions/${id}/resend`);
    return response.data;
  },

  revoke: async (id: number | string, data?: RevokeInvitationRequest): Promise<InvitationDTO> => {
    const response = await axiosInstance.post<InvitationDTO>(`/invitations/actions/${id}/revoke`, data ?? {});
    return response.data;
  },
};
