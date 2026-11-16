package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface GitRepositoryRepository extends JpaRepository<GitRepository, Long> {

    /** Repository connections with the given status for a batch of GitHub repository ids. */
    List<GitRepository> findByProviderAndExternalIdInAndStatus(
            GitProvider provider, Collection<Long> externalIds, GitRepositoryStatus status);

    /** GI-04: the ACTIVE connection of a project (unique through {@code uk_git_repo_active_project}). */
    Optional<GitRepository> findFirstByProjectIdAndStatus(Long projectId, GitRepositoryStatus status);

    /** GI-04: the ACTIVE connection of a GitHub repository (unique through {@code uk_git_repo_active_external}). */
    Optional<GitRepository> findFirstByProviderAndExternalIdAndStatus(
            GitProvider provider, Long externalId, GitRepositoryStatus status);

    /** GI-04: most recent connection of a project in any status (to show an UNAVAILABLE one). */
    Optional<GitRepository> findFirstByProjectIdOrderByIdDesc(Long projectId);
}
