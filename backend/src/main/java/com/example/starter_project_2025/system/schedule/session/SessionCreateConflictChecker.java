package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import com.example.starter_project_2025.system.schedule.session.dto.CreateSessionRequest;

public interface SessionCreateConflictChecker {
    ConflictCheckResult checkCandidate(Long calendarVersionId, CreateSessionRequest request);
}
