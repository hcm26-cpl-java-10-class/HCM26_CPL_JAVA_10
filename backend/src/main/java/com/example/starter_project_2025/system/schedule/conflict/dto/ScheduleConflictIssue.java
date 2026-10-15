package com.example.starter_project_2025.system.schedule.conflict.dto;

import lombok.Builder;

@Builder
public record ScheduleConflictIssue(
        String code,
        String candidateKey,
        String field,
        String message,
        Long conflictSessionId,
        String conflictCandidateKey) {
}
