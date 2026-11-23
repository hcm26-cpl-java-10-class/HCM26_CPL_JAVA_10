export type NotificationCategory = "EXAM" | "COURSE" | "PROJECT" | "SYSTEM";

export interface NotificationDTO {
  id: number;
  title: string;
  message: string;
  targetUrl?: string;
  read: boolean;
  createdAt: string;
  category?: NotificationCategory;
}

export interface NotificationListDTO {
  items: NotificationDTO[];
  unreadCount: number;
}


export interface NotificationPageDTO {
  items: NotificationDTO[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  unreadCount: number;
  unreadByCategory: Record<NotificationCategory, number>;
}

export interface NotificationPreferenceDTO {
  category: NotificationCategory;
  inAppEnabled: boolean;
}
