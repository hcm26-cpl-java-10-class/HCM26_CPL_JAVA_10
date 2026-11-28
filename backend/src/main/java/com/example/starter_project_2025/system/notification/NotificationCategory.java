package com.example.starter_project_2025.system.notification;

import java.util.Locale;

/** Groups notifications for filtering and for per-user preferences. Derived from the event key. */
public enum NotificationCategory {
    EXAM, COURSE, PROJECT, CLASS, SYSTEM;

    public static NotificationCategory fromEventKey(String eventKey) {
        if (eventKey == null || eventKey.isBlank()) {
            return SYSTEM;
        }
        String key = eventKey.toLowerCase(Locale.ROOT);
        if (startsWithAny(key, "exam", "gradebook", "score", "invitation", "appeal")) {
            return EXAM;
        }
        if (startsWithAny(key, "milestone", "task", "backlog", "sprint", "member-reminder", "workspace")) {
            return PROJECT;
        }
        if (startsWithAny(key, "class", "session", "calendar", "attendance", "trainer")) {
            return CLASS;
        }
        if (startsWithAny(key, "enrollment", "course", "lesson", "learning-nudge", "qna", "certificate")) {
            return COURSE;
        }
        return SYSTEM;
    }

    public static NotificationCategory parse(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static boolean startsWithAny(String key, String... prefixes) {
        for (String prefix : prefixes) {
            if (key.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
