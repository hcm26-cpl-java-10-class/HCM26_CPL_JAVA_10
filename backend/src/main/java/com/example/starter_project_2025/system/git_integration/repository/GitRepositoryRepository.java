package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GitRepositoryRepository extends JpaRepository<GitRepository, Long> {

    /** GI-05: statuses of a project's current repository. */
    Set<GitRepositoryStatus> CURRENT = EnumSet.of(GitRepositoryStatus.ACTIVE, GitRepositoryStatus.ERROR, GitRepositoryStatus.DISCONNECTED);
    /** GI-05: statuses whose webhooks and syncs are processed. */
    Set<GitRepositoryStatus> RECEIVING = EnumSet.of(GitRepositoryStatus.ACTIVE, GitRepositoryStatus.ERROR);

    /** Repository connections with the given status for a batch of GitHub repository ids. */
    List<GitRepository> findByProviderAndExternalIdInAndStatus(
            GitProvider provider, Collection<Long> externalIds, GitRepositoryStatus status);

    /** GI-05: connections of a batch of GitHub repository ids among the given statuses (GI-03 "already linked"). */
    List<GitRepository> findByProviderAndExternalIdInAndStatusIn(
            GitProvider provider, Collection<Long> externalIds, Collection<GitRepositoryStatus> statuses);

    /** GI-04: the ACTIVE connection of a project (unique through {@code uk_git_repo_active_project}). */
    Optional<GitRepository> findFirstByProject_IdAndStatus(Long projectId, GitRepositoryStatus status);

    /** GI-04: the ACTIVE connection of a GitHub repository (unique through {@code uk_git_repo_active_external}). */
    Optional<GitRepository> findFirstByProviderAndExternalIdAndStatus(
            GitProvider provider, Long externalId, GitRepositoryStatus status);

    /** SY-03: connections reached through an installation (e.g. ACTIVE ones when it is uninstalled). */
    List<GitRepository> findByInstallation_IdAndStatus(Long installationRef, GitRepositoryStatus status);

    /** GI-04: most recent connection of a project in any status. */
    Optional<GitRepository> findFirstByProject_IdOrderByIdDesc(Long projectId);

    /** GI-05: the newest connection of a project among the given statuses. */
    Optional<GitRepository> findFirstByProject_IdAndStatusInOrderByIdDesc(Long projectId, Collection<GitRepositoryStatus> statuses);

    /** GI-05: the project's current repository (ACTIVE, ERROR or DISCONNECTED; unique through {@code uk_git_repo_active_project}). */
    default Optional<GitRepository> findCurrent(Long projectId) {
        return findFirstByProject_IdAndStatusInOrderByIdDesc(projectId, CURRENT);
    }

    /** GI-05: the connection whose events are synchronized (ACTIVE or ERROR; unique through {@code uk_git_repo_active_external}). */
    default Optional<GitRepository> findReceiving(GitProvider provider, Long externalId) {
        return findFirstByProviderAndExternalIdAndStatusInOrderByIdDesc(provider, externalId, RECEIVING);
    }

    Optional<GitRepository> findFirstByProviderAndExternalIdAndStatusInOrderByIdDesc(
            GitProvider provider, Long externalId, Collection<GitRepositoryStatus> statuses);

    /** GI-05: connections of a repository reached through an installation, in the given statuses. */
    List<GitRepository> findByInstallation_IdAndExternalIdAndStatusIn(Long installationRef, Long externalId,
                                                                      Collection<GitRepositoryStatus> statuses);

    /** GI-05: connections reached through an installation, in the given statuses. */
    List<GitRepository> findByInstallation_IdAndStatusIn(Long installationRef, Collection<GitRepositoryStatus> statuses);

    List<GitRepository> findByInstallation_IdInAndStatusIn(Collection<Long> installationRefs, Collection<GitRepositoryStatus> statuses);

    /** GI-05: the newest unlinked connection of this repository on this project (re-activated on relink). */
    Optional<GitRepository> findFirstByProject_IdAndProviderAndExternalIdAndStatusOrderByIdDesc(
            Long projectId, GitProvider provider, Long externalId, GitRepositoryStatus status);

    /** GI-05: every connection of a project, newest link first (repository labels, previous repositories). */
    List<GitRepository> findByProject_IdOrderByLinkedAtDescIdDesc(Long projectId);

    /** SY-01: serializes "queue a sync job unless one is waiting or running" for one connection. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from GitRepository r where r.id = :id")
    Optional<GitRepository> lockById(@Param("id") Long id);

    /** SY-01: ids of the ACTIVE connections, for the periodic reconcile. */
    @Query("select r.id from GitRepository r where r.status = :status order by r.id")
    List<Long> findIdsByStatus(@Param("status") GitRepositoryStatus status,
                               org.springframework.data.domain.Pageable page);

    /** SY-04: every connection a project ever had (webhook log filter). */
    List<GitRepository> findByProject_Id(Long projectId);
}
