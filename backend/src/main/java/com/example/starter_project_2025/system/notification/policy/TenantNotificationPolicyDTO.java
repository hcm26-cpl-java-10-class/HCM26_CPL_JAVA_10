package com.example.starter_project_2025.system.notification.policy;

import com.example.starter_project_2025.system.notification.NotificationCategory;

public record TenantNotificationPolicyDTO(
        NotificationCategory category,
        boolean inAppMandatory,
        boolean emailMandatory,
        int cooldownMinutes
) {
}
