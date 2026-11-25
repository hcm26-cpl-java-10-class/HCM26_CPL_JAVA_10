package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;

/**
 * GI-05: a repository connection's status really changed (published inside the writing transaction;
 * listen AFTER_COMMIT). {@code reason} is one of {@link GitRepositoryReason}, null when it became ACTIVE.
 */
public record GitRepositoryStatusChangedEvent(Long tenantId, Long repositoryId, Long projectId, String fullName,
                                              GitRepositoryStatus from, GitRepositoryStatus to, String reason) {
}
