package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;

import java.time.LocalDateTime;
import java.util.Map;

/** GI-04: a synchronization job as shown to users. */
public record GitSyncJobView(
        Long id,
        GitSyncJobType type,
        GitSyncJobStatus status,
        int attemptCount,
        int maxAttempts,
        LocalDateTime nextRunAt,
        LocalDateTime startedAt,
        LocalDateTime finishedAt,
        String errorCode,
        Map<String, Object> stats) {
}
