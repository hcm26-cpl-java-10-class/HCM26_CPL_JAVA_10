export interface NotificationDTO {
  id: number;
  title: string;
  message: string;
  targetUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationListDTO {
  items: NotificationDTO[];
  unreadCount: number;
}

