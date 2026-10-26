package com.example.starter_project_2025.system.project.milestone.submission.integration;

import java.time.Instant;
import java.util.UUID;

public interface ProjectCompletionPort {
    boolean isActive(UUID projectId, UUID tenantId);
    void complete(UUID projectId, UUID teamId, UUID actorId, Instant completedAt);
}
