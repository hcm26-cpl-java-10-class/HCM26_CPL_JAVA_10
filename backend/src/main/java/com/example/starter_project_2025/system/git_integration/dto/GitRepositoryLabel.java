package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;

/** GI-05: which repository connection of the project a commit / pull request came from (INACTIVE = unlinked). */
public record GitRepositoryLabel(Long id, String fullName, GitRepositoryStatus status) {
}
