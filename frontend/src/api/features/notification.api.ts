import axiosInstance from "@/api/axios";
import type { NotificationListDTO } from "@/types";

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
};

