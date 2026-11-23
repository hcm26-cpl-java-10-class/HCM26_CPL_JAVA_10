package com.example.starter_project_2025.system.notification;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class NotificationCategoryTest {

    @Test
    void mapsExistingEventKeysToCategories() {
        assertEquals(NotificationCategory.EXAM, NotificationCategory.fromEventKey("exam.review.assigned.5"));
        assertEquals(NotificationCategory.EXAM, NotificationCategory.fromEventKey("gradebook.saved.1.2.3"));
        assertEquals(NotificationCategory.PROJECT, NotificationCategory.fromEventKey("milestone-risk:abc:1:2"));
        assertEquals(NotificationCategory.PROJECT, NotificationCategory.fromEventKey("task-overdue:x:1:2"));
        assertEquals(NotificationCategory.PROJECT, NotificationCategory.fromEventKey("backlog-overdue:9:2026-01-01:3"));
        assertEquals(NotificationCategory.COURSE, NotificationCategory.fromEventKey("course-completed:40"));
        assertEquals(NotificationCategory.COURSE, NotificationCategory.fromEventKey("lesson-created:7"));
        assertEquals(NotificationCategory.COURSE, NotificationCategory.fromEventKey("learning-nudge:1:2:day"));
        assertEquals(NotificationCategory.COURSE, NotificationCategory.fromEventKey("enrollment:9"));
    }

    @Test
    void unknownOrMissingKeysAreSystem() {
        assertEquals(NotificationCategory.SYSTEM, NotificationCategory.fromEventKey("something-else:1"));
        assertEquals(NotificationCategory.SYSTEM, NotificationCategory.fromEventKey(null));
        assertEquals(NotificationCategory.SYSTEM, NotificationCategory.fromEventKey("  "));
    }

    @Test
    void parseIsCaseInsensitiveAndNullSafe() {
        assertEquals(NotificationCategory.EXAM, NotificationCategory.parse(" exam "));
        assertNull(NotificationCategory.parse("nope"));
        assertNull(NotificationCategory.parse(null));
        assertNull(NotificationCategory.parse(""));
    }
}
