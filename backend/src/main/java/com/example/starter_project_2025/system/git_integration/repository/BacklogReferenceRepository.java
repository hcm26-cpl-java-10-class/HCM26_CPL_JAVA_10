package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

/** SY-05: Task IDs found in commits and pull requests, with their verdict. */
public interface BacklogReferenceRepository extends JpaRepository<BacklogReference, Long> {

    List<BacklogReference> findBySourceTypeAndSourceId(GitArtifactType sourceType, Long sourceId);

    List<BacklogReference> findBySourceTypeAndSourceIdIn(GitArtifactType sourceType, Collection<Long> sourceIds);

    List<BacklogReference> findByRepositoryIdAndStatusIn(Long repositoryId, Collection<BacklogReferenceStatus> statuses);

    /** Sources already processed (they have at least one row). */
    @Query("select distinct r.sourceId from BacklogReference r where r.sourceType = :type and r.sourceId in :ids")
    List<Long> findProcessedSourceIds(@Param("type") GitArtifactType type, @Param("ids") Collection<Long> ids);

    @Query("""
            select c.id from GitCommit c
             where c.id > :afterId and (:repositoryId is null or c.repositoryId = :repositoryId)
               and not exists (select r.id from BacklogReference r where r.sourceType = :type and r.sourceId = c.id)
             order by c.id""")
    List<Long> findUnprocessedCommitIds(@Param("afterId") Long afterId, @Param("repositoryId") Long repositoryId,
                                        @Param("type") GitArtifactType type, Pageable page);

    @Query("""
            select p.id from GitPullRequest p
             where p.id > :afterId and (:repositoryId is null or p.repositoryId = :repositoryId)
               and not exists (select r.id from BacklogReference r where r.sourceType = :type and r.sourceId = p.id)
             order by p.id""")
    List<Long> findUnprocessedPullRequestIds(@Param("afterId") Long afterId, @Param("repositoryId") Long repositoryId,
                                             @Param("type") GitArtifactType type, Pageable page);

    /** Per status, how many distinct commits / pull requests of a repository have at least one such reference. */
    @Query("""
            select r.status, count(distinct r.sourceId) from BacklogReference r
             where r.repositoryId = :repositoryId and r.sourceType = :type
             group by r.status""")
    List<Object[]> countSourcesByStatus(@Param("repositoryId") Long repositoryId, @Param("type") GitArtifactType type);

    @Query("select count(distinct r.sourceId) from BacklogReference r where r.repositoryId = :repositoryId and r.sourceType = :type")
    long countProcessedSources(@Param("repositoryId") Long repositoryId, @Param("type") GitArtifactType type);

    @Query("""
            select count(distinct r.sourceId) from BacklogReference r
             where r.repositoryId = :repositoryId and r.sourceType = :type and r.status = :status""")
    long countSources(@Param("repositoryId") Long repositoryId, @Param("type") GitArtifactType type,
                      @Param("status") BacklogReferenceStatus status);
}
