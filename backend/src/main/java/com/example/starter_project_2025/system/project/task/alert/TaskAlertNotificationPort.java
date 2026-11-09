package com.example.starter_project_2025.system.project.task.alert;

/**
 * Integration contract for UFR-COM. No default success/no-op adapter is installed.
 * The consumer must deduplicate by (event_id, user_id, channel), retry pending deliveries,
 * and acknowledge the outbox row only after both IN_APP and EMAIL have succeeded.
 */
public interface TaskAlertNotificationPort {
    void deliver(TaskAlertDtos.Event event);
}
