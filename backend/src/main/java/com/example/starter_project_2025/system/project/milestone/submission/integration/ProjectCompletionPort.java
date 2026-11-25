package com.example.starter_project_2025.system.project.milestone.submission.integration;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ProjectCompletionPort {
    boolean isActive(Long projectId, Long tenantId);

    default boolean isCompleted(Long projectId, Long tenantId) { return false; }

    default void requireManagement(Long projectId, Long tenantId, Long teamId) { }

    default void requireRead(Long projectId, Long tenantId, Long teamId) { }

    default List<CompletionTarget> lockHierarchy(Long projectId, Long tenantId, Long teamId) {
        return projectId == null || tenantId == null || teamId == null
                ? List.of() : List.of(new CompletionTarget(projectId, teamId));
    }

    default ChildCompletion childCompletion(Long projectId, Long tenantId) {
        return ChildCompletion.NONE;
    }

    boolean complete(Long projectId, Long tenantId, Long teamId, UUID actorId, Instant completedAt);

    record CompletionTarget(Long projectId, Long teamId) { }

    enum ChildCompletion { NONE, PENDING, COMPLETED }
}
