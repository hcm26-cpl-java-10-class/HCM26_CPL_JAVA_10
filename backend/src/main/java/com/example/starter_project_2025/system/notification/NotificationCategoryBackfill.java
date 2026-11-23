package com.example.starter_project_2025.system.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Fills the category of notifications created before the notification center existed. */
@Component
@RequiredArgsConstructor
public class NotificationCategoryBackfill {

    private final NotificationService notificationService;

    @EventListener(ApplicationReadyEvent.class)
    public void run() {
        notificationService.backfillCategories();
    }
}
