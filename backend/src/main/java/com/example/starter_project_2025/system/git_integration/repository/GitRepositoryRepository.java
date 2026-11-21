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

    /** SY-03: connections reached through an installation (e.g. ACTIVE ones when it is uninstalled). */
    List<GitRepository> findByInstallationRefAndStatus(Long installationRef, GitRepositoryStatus status);

    /** GI-04: most recent connection of a project in any status (to show an UNAVAILABLE one). */
    Optional<GitRepository> findFirstByProjectIdOrderByIdDesc(Long projectId);

    /** SY-01: serializes "queue a sync job unless one is waiting or running" for one connection. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select r from GitRepository r where r.id = :id")
    Optional<GitRepository> lockById(@org.springframework.data.repository.query.Param("id") Long id);

    /** SY-01: ids of the ACTIVE connections, for the periodic reconcile. */
    @org.springframework.data.jpa.repository.Query("select r.id from GitRepository r where r.status = :status order by r.id")
    List<Long> findIdsByStatus(@org.springframework.data.repository.query.Param("status") GitRepositoryStatus status,
                               org.springframework.data.domain.Pageable page);

    /** SY-04: every connection a project ever had (webhook log filter). */
    List<GitRepository> findByProjectId(Long projectId);
}
