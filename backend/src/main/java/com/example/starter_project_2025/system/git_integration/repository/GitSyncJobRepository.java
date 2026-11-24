package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitSyncJob;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GitSyncJobRepository extends JpaRepository<GitSyncJob, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from GitSyncJob j where j.id = :id")
    Optional<GitSyncJob> lockById(@Param("id") Long id);

    Optional<GitSyncJob> findFirstByRepository_IdOrderByIdDesc(Long repositoryId);

    Optional<GitSyncJob> findByDedupeKey(String dedupeKey);

    /** GI-05: jobs of a connection in a status (PENDING ones are stopped when it is unlinked). */
    List<GitSyncJob> findByRepository_IdAndStatus(Long repositoryId, GitSyncJobStatus status);

    /** PENDING jobs whose time has come, oldest first. */
    @Query("select j.id from GitSyncJob j where j.status = :status and j.nextRunAt <= :now order by j.nextRunAt asc, j.id asc")
    List<Long> findDueIds(@Param("status") GitSyncJobStatus status, @Param("now") LocalDateTime now, Pageable page);

    /** RUNNING jobs whose worker vanished (server restart, crash). */
    @Query("select j.id from GitSyncJob j where j.status = :status and coalesce(j.lastClaimedAt, j.startedAt) < :before")
    List<Long> findStuckIds(@Param("status") GitSyncJobStatus status, @Param("before") LocalDateTime before, Pageable page);
}
