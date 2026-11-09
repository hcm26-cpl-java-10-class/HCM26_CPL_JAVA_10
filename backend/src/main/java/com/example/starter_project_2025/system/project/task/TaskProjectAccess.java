package com.example.starter_project_2025.system.project.task;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface TaskProjectAccess {
    /** Legacy projects can opt out until their UUID-to-project mapping is configured. */
    default boolean supports(UUID projectId) { return true; }
    Set<UUID> findProjectIds(Long userId);

    boolean isManager(UUID projectId, Long userId);

    Optional<Long> findMemberUserId(UUID projectId, UUID projectMemberId);
}
