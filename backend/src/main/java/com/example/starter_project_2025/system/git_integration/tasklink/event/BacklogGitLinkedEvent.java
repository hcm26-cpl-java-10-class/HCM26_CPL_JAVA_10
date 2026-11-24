package com.example.starter_project_2025.system.git_integration.tasklink.event;

import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;

import java.util.List;

/**
 * SY-05: a commit or a pull request was linked to tasks for the first time. Published
 * inside the linking transaction; listen with {@code @TransactionalEventListener(AFTER_COMMIT)}.
 * For activity feeds or notifications later on: nothing changes the task status (AC05).
 */
public record BacklogGitLinkedEvent(
        Long tenantId,
        Long projectId,
        Long repositoryId,
        GitArtifactType artifactType,
        Long artifactId,
        List<Long> backlogItemIds) {
}
