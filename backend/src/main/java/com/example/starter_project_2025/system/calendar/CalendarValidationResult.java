package com.example.starter_project_2025.system.calendar;

import java.util.List;

/**
 * Validation result returned by {@code POST /api/calendar/validate}.
 */
public record CalendarValidationResult(
        boolean valid,
        List<ConflictIssue> issues
) {
    public record ConflictIssue(
            String code,
            String candidateKey,
            String field,
            String message,
            Long conflictingSessionId
    ) {
    }
}

