import axiosInstance from "@/api/axios";
import type {
  EmailAttemptDTO,
  EmailBatchResult,
  EmailDeliveryStatus,
  EmailSendRequest,
  EmailTemplateDTO,
  EmailTemplatePreviewResponse,
  EmailTemplateUpsertRequest,
  EmailTemplateVersionDTO,
  NotificationCategory,
} from "@/types";

export interface SpringPage<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export const communicationApi = {
  searchTemplates: async (params: {
    keyword?: string;
    category?: NotificationCategory;
    active?: boolean;
    page?: number;
    size?: number;
  }): Promise<SpringPage<EmailTemplateDTO>> => {
    const response = await axiosInstance.get<SpringPage<EmailTemplateDTO>>("/email-templates", { params });
    return response.data;
  },

  getTemplate: async (id: number): Promise<EmailTemplateDTO> => {
    const response = await axiosInstance.get<EmailTemplateDTO>(`/email-templates/${id}`);
    return response.data;
  },

  listTemplateVersions: async (id: number): Promise<EmailTemplateVersionDTO[]> => {
    const response = await axiosInstance.get<EmailTemplateVersionDTO[]>(`/email-templates/${id}/versions`);
    return response.data;
  },

  createTemplate: async (payload: EmailTemplateUpsertRequest): Promise<EmailTemplateDTO> => {
    const response = await axiosInstance.post<EmailTemplateDTO>("/email-templates", payload);
    return response.data;
  },

  updateTemplate: async (id: number, payload: EmailTemplateUpsertRequest): Promise<EmailTemplateDTO> => {
    const response = await axiosInstance.put<EmailTemplateDTO>(`/email-templates/${id}`, payload);
    return response.data;
  },

  updateTemplateStatus: async (id: number, active: boolean): Promise<EmailTemplateDTO> => {
    const response = await axiosInstance.patch<EmailTemplateDTO>(`/email-templates/${id}/status`, { active });
    return response.data;
  },

  previewTemplate: async (payload: {
    templateId?: number;
    subjectTemplate?: string;
    bodyHtml?: string;
    variables?: Record<string, string>;
  }): Promise<EmailTemplatePreviewResponse> => {
    const response = await axiosInstance.post<EmailTemplatePreviewResponse>("/email-templates/preview", payload);
    return response.data;
  },

  searchHistory: async (params: {
    contextRef?: string;
    recipient?: string;
    status?: EmailDeliveryStatus;
    category?: NotificationCategory;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
  }): Promise<SpringPage<EmailAttemptDTO>> => {
    const response = await axiosInstance.get<SpringPage<EmailAttemptDTO>>("/emails/history", { params });
    return response.data;
  },

  getHistoryDetail: async (id: number): Promise<EmailAttemptDTO> => {
    const response = await axiosInstance.get<EmailAttemptDTO>(`/emails/history/${id}`);
    return response.data;
  },

  retryHistory: async (id: number): Promise<EmailAttemptDTO> => {
    const response = await axiosInstance.post<EmailAttemptDTO>(`/emails/history/${id}/retry`);
    return response.data;
  },

  previewCompose: async (payload: EmailSendRequest): Promise<EmailTemplatePreviewResponse> => {
    const response = await axiosInstance.post<EmailTemplatePreviewResponse>("/emails/preview", payload);
    return response.data;
  },

  sendEmails: async (payload: EmailSendRequest, idempotencyKey: string): Promise<EmailBatchResult> => {
    const response = await axiosInstance.post<EmailBatchResult>("/emails/send", payload, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return response.data;
  },
};
