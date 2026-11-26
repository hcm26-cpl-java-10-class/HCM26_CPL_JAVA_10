package com.example.starter_project_2025.system.notification;

import java.time.LocalDateTime;

public record NotificationDTO(
        Long id,
        String title,
        String message,
        String targetUrl,
        boolean read,
        LocalDateTime createdAt,
        NotificationCategory category
) {
    static NotificationDTO from(Notification notification) {
        return new NotificationDTO(
                notification.getId(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getTargetUrl(),
                notification.getReadAt() != null,
                notification.getCreatedAt(),
                notification.getCategory() != null
                        ? notification.getCategory()
                        : NotificationCategory.fromEventKey(notification.getEventKey())
        );
    }
}

