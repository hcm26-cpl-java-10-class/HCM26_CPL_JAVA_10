package com.example.starter_project_2025.system.schedule.conflict_resolution;

import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.ConflictResolutionDecisionRequest;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.ConflictResolutionResponse;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.CreateConflictResolutionRequest;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;

import java.util.List;

public interface ConflictResolutionService {

    ConflictCheckResult resolve(ConflictCheckResult rawResult);

    ConflictResolutionResponse create(
            Long calendarVersionId,
            CreateConflictResolutionRequest request,
            Long actorId
    );

    List<ConflictResolutionResponse> list(Long calendarVersionId);

    ConflictResolutionResponse get(Long calendarVersionId, Long resolutionId);

    ConflictResolutionResponse approve(Long calendarVersionId, Long resolutionId, Long actorId);

    ConflictResolutionResponse reject(
            Long calendarVersionId,
            Long resolutionId,
            ConflictResolutionDecisionRequest request,
            Long actorId
    );

    ConflictResolutionResponse revoke(
            Long calendarVersionId,
            Long resolutionId,
            ConflictResolutionDecisionRequest request,
            Long actorId
    );

    void markApplied(ConflictCheckResult resolvedResult, Long actorId);
}
