package com.example.starter_project_2025.system.git_integration.tasklink.event;

import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;

/**
 * TM-03: a user unlinked a pull request from a task. Published inside the unlink
 * transaction; listen with {@code @TransactionalEventListener(AFTER_COMMIT)}.
 */
public record BacklogGitUnlinkedEvent(
        Long tenantId,
        Long projectId,
        Long repositoryId,
        GitArtifactType artifactType,
        Long artifactId,
        Long backlogItemId,
        Long userId) {
}
