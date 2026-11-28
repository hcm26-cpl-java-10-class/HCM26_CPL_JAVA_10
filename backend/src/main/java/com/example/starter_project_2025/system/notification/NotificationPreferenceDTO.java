package com.example.starter_project_2025.system.notification;

public record NotificationPreferenceDTO(
        NotificationCategory category,
        boolean inAppEnabled,
        Boolean emailEnabled,
        Boolean inAppMandatory,
        Boolean emailMandatory
) {
    /** Backward-compatible 2-argument constructor for existing tests and callers. */
    public NotificationPreferenceDTO(NotificationCategory category, boolean inAppEnabled) {
        this(category, inAppEnabled, null, null, null);
    }

    public NotificationPreferenceDTO(NotificationCategory category, boolean inAppEnabled, Boolean emailEnabled) {
        this(category, inAppEnabled, emailEnabled, null, null);
    }
}
