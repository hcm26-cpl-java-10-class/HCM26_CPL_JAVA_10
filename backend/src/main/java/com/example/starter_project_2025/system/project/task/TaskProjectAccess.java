package com.example.starter_project_2025.system.project.task;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

public interface TaskProjectAccess {
    Set<UUID> findProjectIds(Long userId);

    boolean isManager(UUID projectId, Long userId);

    Optional<Long> findMemberUserId(UUID projectId, UUID projectMemberId);
}
