package com.example.starter_project_2025.system.notification;

import java.util.List;
import java.util.Map;

/** One page of notifications plus unread counters per category, for the notification center. */
public record NotificationPageDTO(
        List<NotificationDTO> items,
        int page,
        int size,
        long totalElements,
        int totalPages,
        long unreadCount,
        Map<NotificationCategory, Long> unreadByCategory
) {
}
