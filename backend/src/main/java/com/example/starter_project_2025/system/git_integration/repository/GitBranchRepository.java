package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitBranch;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** SY-07: branches of the repository connections. */
public interface GitBranchRepository extends JpaRepository<GitBranch, Long> {

    Optional<GitBranch> findByRepository_IdAndNameKey(Long repositoryId, String nameKey);

    List<GitBranch> findByRepository_IdAndNameKeyIn(Long repositoryId, Collection<String> nameKeys);

    /** Branches that still exist on GitHub, latest head commit first. */
    @Query("""
            select b from GitBranch b
             where b.repository.id = :repositoryId and b.deletedAt is null
             order by case when b.headCommittedAt is null then 1 else 0 end, b.headCommittedAt desc, b.name""")
    List<GitBranch> findLive(@Param("repositoryId") Long repositoryId);

    /** Every branch of a connection (also deleted ones), for the branch list. */
    List<GitBranch> findByRepository_Id(Long repositoryId);

    /** After a complete listing: the branches it did not see are gone from GitHub. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            update GitBranch b set b.deletedAt = :now, b.version = b.version + 1
             where b.repository.id = :repositoryId and b.deletedAt is null
               and (b.lastSeenJobId is null or b.lastSeenJobId <> :jobId)""")
    int markUnseenDeleted(@Param("repositoryId") Long repositoryId, @Param("jobId") Long jobId, @Param("now") LocalDateTime now);

    /** A manual sync reads the branches cut at the page cap again (the cap may have been raised). */
    @Modifying(flushAutomatically = true)
    @Query("""
            update GitBranch b set b.syncedHeadOid = null, b.version = b.version + 1
             where b.repository.id = :repositoryId and b.truncated = true and b.deletedAt is null""")
    int resetTruncated(@Param("repositoryId") Long repositoryId);
}
