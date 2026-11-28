import axiosInstance from "@/api/axios";
import type {
  NotificationCategory,
  NotificationListDTO,
  NotificationPageDTO,
  NotificationPreferenceDTO,
  TenantNotificationPolicyDTO,
} from "@/types";

export const notificationQueryKey = (account: string) => ["notifications", account] as const;

export const notificationApi = {
  getMine: async (page = 0, size = 10): Promise<NotificationListDTO> => {
    const response = await axiosInstance.get<NotificationListDTO>("/notifications", { params: { page, size } });
    return response.data;
  },

  markRead: async (notificationId: number): Promise<void> => {
    await axiosInstance.patch(`/notifications/${notificationId}/read`);
  },

  markAllRead: async (): Promise<void> => {
    await axiosInstance.patch("/notifications/read-all");
  },

  getPage: async (params: {
    category?: NotificationCategory;
    unreadOnly?: boolean;
    page?: number;
    size?: number;
  }): Promise<NotificationPageDTO> => {
    const response = await axiosInstance.get<NotificationPageDTO>("/notifications/page", { params });
    return response.data;
  },

  remove: async (notificationId: number): Promise<void> => {
    await axiosInstance.delete(`/notifications/${notificationId}`);
  },

  removeRead: async (): Promise<{ deleted: number }> => {
    const response = await axiosInstance.delete<{ deleted: number }>("/notifications/read");
    return response.data;
  },

  getPreferences: async (): Promise<NotificationPreferenceDTO[]> => {
    const response = await axiosInstance.get<NotificationPreferenceDTO[]>("/notifications/preferences");
    return response.data;
  },

  updatePreferences: async (changes: NotificationPreferenceDTO[]): Promise<NotificationPreferenceDTO[]> => {
    const response = await axiosInstance.put<NotificationPreferenceDTO[]>("/notifications/preferences", changes);
    return response.data;
  },

  getPolicies: async (): Promise<TenantNotificationPolicyDTO[]> => {
    const response = await axiosInstance.get<TenantNotificationPolicyDTO[]>("/notifications/policies");
    return response.data;
  },

  updatePolicies: async (changes: TenantNotificationPolicyDTO[]): Promise<TenantNotificationPolicyDTO[]> => {
    const response = await axiosInstance.put<TenantNotificationPolicyDTO[]>("/notifications/policies", changes);
    return response.data;
  },
};

