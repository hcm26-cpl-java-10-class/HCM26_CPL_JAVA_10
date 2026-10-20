package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;

public interface ConflictDetectionService {
    /**
     * Checks the entire DRAFT against itself and ACTIVE calendars of other classes.
     */
    ConflictCheckResult checkConflicts(Long calendarVersionId);
}
