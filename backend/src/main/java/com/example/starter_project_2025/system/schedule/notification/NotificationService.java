package com.example.starter_project_2025.system.schedule.notification;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import java.util.List;

public interface NotificationService extends BaseCrudService<Long, NotificationDTO, NotificationFilter> {
    List<NotificationDTO> getMyNotifications(Long userId);
    void markAsRead(Long notificationId);
}