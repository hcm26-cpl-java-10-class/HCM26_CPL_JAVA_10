package com.example.starter_project_2025.system.notification;

import java.util.List;

public record NotificationListDTO(List<NotificationDTO> items, long unreadCount) {
}

