package com.example.starter_project_2025.system.schedule.conflict.dto;

import lombok.Builder;

import java.util.List;

@Builder
public record ScheduleValidationResponse(
        Long versionId,
        boolean valid,
        List<ScheduleConflictIssue> issues) {
}
