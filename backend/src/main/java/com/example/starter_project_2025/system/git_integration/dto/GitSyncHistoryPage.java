package com.example.starter_project_2025.system.git_integration.dto;

import java.util.List;

/**
 * SY-06: a page of the synchronization history. {@code hasRepository = false}: the project never
 * linked a repository (AC03 shows "Link repository" instead of "no history yet").
 * {@code repositories}: every repository of the project, for the repository filter.
 */
public record GitSyncHistoryPage(
        List<GitSyncHistoryItem> items,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasRepository,
        Long repositoryId,
        List<GitRepositoryLabel> repositories) {
}
