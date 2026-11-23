import axiosInstance from "@/api/axios";
import type {
  NotificationCategory,
  NotificationListDTO,
  NotificationPageDTO,
  NotificationPreferenceDTO,
} from "@/types";

export const notificationQueryKey = ["notifications"] as const;

export const notificationApi = {
  getMine: async (): Promise<NotificationListDTO> => {
    const response = await axiosInstance.get<NotificationListDTO>("/notifications");
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
};

