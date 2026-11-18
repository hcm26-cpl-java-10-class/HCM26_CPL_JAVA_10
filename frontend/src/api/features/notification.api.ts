import axiosInstance from "@/api/axios";
import type { NotificationListDTO } from "@/types";

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
};

