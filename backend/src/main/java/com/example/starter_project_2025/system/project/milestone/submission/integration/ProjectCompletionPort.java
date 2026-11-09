package com.example.starter_project_2025.system.project.milestone.submission.integration;

import java.time.Instant;
import java.util.UUID;

public interface ProjectCompletionPort {
    boolean isActive(Long projectId, Long tenantId);
    void complete(Long projectId, Long teamId, UUID actorId, Instant completedAt);
}
