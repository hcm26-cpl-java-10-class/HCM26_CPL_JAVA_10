import axiosInstance from "@/api/axios";
import type {
    AnonymousAccessResponse,
    AnonymousInvitationRequest,
    AnonymousSessionRequest,
    AnonymousSessionResponse,
    BatchInvitationRequest,
    BatchInvitationResponse,
    InvitationCreateRequest,
    InvitationDTO,
    InvitationStatus,
    ReminderDTO,
    ReminderRequest,
} from "@/types";

interface InvitationQuery {
    status?: InvitationStatus;
    anonymous?: boolean;
}

/** PNG data URL for the invitation QR code - usable directly in <img src> */
const toDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });

export const invitationApi = {
    // ---------- Management ----------
    create: async (examId: number, request: InvitationCreateRequest): Promise<InvitationDTO> => {
        const response = await axiosInstance.post<InvitationDTO>(`/exams/${examId}/invitations`, request);
        return response.data;
    },

    createBatch: async (
        examId: number,
        request: BatchInvitationRequest,
    ): Promise<BatchInvitationResponse> => {
        const response = await axiosInstance.post<BatchInvitationResponse>(
            `/exams/${examId}/invitations/batch`,
            request,
        );
        return response.data;
    },

    getByExam: async (examId: number, query?: InvitationQuery): Promise<InvitationDTO[]> => {
        const response = await axiosInstance.get<InvitationDTO[]>(`/exams/${examId}/invitations`, {
            params: query,
        });
        return response.data;
    },

    getById: async (id: number): Promise<InvitationDTO> => {
        const response = await axiosInstance.get<InvitationDTO>(`/invitations/${id}`);
        return response.data;
    },

    revoke: async (id: number, reason?: string): Promise<InvitationDTO> => {
        const response = await axiosInstance.patch<InvitationDTO>(`/invitations/${id}/revoke`, null, {
            params: { reason },
        });
        return response.data;
    },

    resend: async (id: number): Promise<InvitationDTO> => {
        const response = await axiosInstance.post<InvitationDTO>(`/invitations/${id}/resend`);
        return response.data;
    },

    getQrDataUrl: async (id: number): Promise<string> => {
        const response = await axiosInstance.get(`/invitations/${id}/qr`, { responseType: "blob" });
        return toDataUrl(response.data as Blob);
    },

    // ---------- Student ----------
    getMyInvitations: async (): Promise<InvitationDTO[]> => {
        const response = await axiosInstance.get<InvitationDTO[]>("/invitations/my");
        return response.data;
    },

    accept: async (id: number): Promise<InvitationDTO> => {
        const response = await axiosInstance.patch<InvitationDTO>(`/invitations/${id}/accept`);
        return response.data;
    },

    reject: async (id: number): Promise<InvitationDTO> => {
        const response = await axiosInstance.patch<InvitationDTO>(`/invitations/${id}/reject`);
        return response.data;
    },

    // ---------- Anonymous ----------
    createAnonymous: async (
        examId: number,
        request: AnonymousInvitationRequest,
    ): Promise<InvitationDTO> => {
        const response = await axiosInstance.post<InvitationDTO>(
            `/exams/${examId}/invitations/anonymous`,
            request,
        );
        return response.data;
    },

    verifyAccessCode: async (accessCode: string): Promise<AnonymousAccessResponse> => {
        const response = await axiosInstance.get<AnonymousAccessResponse>(
            `/exams/verify-access/${encodeURIComponent(accessCode)}`,
        );
        return response.data;
    },

    createAnonymousSession: async (
        request: AnonymousSessionRequest,
    ): Promise<AnonymousSessionResponse> => {
        const response = await axiosInstance.post<AnonymousSessionResponse>(
            "/exams/anonymous-session",
            request,
        );
        return response.data;
    },

    // ---------- Reminders ----------
    scheduleReminder: async (examId: number, request: ReminderRequest): Promise<ReminderDTO[]> => {
        const response = await axiosInstance.post<ReminderDTO[]>(`/exams/${examId}/reminders`, request);
        return response.data;
    },

    getReminders: async (examId: number): Promise<ReminderDTO[]> => {
        const response = await axiosInstance.get<ReminderDTO[]>(`/exams/${examId}/reminders`);
        return response.data;
    },

    cancelReminder: async (reminderId: number): Promise<void> => {
        await axiosInstance.delete(`/reminders/${reminderId}`);
    },
};