package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;

public interface ConflictDetectionService {
    /**
     * Checks the entire DRAFT against itself and ACTIVE calendars of other classes.
     *
     * @throws UnsupportedOperationException while calendar integration is not implemented
     */
    ConflictCheckResult checkConflicts(Long calendarVersionId);
}
