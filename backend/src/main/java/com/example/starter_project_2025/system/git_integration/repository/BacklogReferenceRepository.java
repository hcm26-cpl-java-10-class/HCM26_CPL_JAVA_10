package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.BacklogReference;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** SY-05: Task IDs found in commits and pull requests, with their verdict. */
public interface BacklogReferenceRepository extends JpaRepository<BacklogReference, Long> {

    @Query("select r from BacklogReference r where r.sourceType = :sourceType and id(r.source) = :sourceId")
    List<BacklogReference> findBySourceTypeAndSource_Id(GitArtifactType sourceType, Long sourceId);

    @Query("select r from BacklogReference r where r.sourceType = :sourceType and id(r.source) in :sourceIds")
    List<BacklogReference> findBySourceTypeAndSource_IdIn(GitArtifactType sourceType, Collection<Long> sourceIds);

    List<BacklogReference> findByRepository_IdAndStatusIn(Long repositoryId, Collection<BacklogReferenceStatus> statuses);

    /** TM-03 clean-up: sources with a reference found in the given field (e.g. BRANCH of old pull requests). */
    @Query("select distinct id(r.source) from BacklogReference r where r.sourceType = :type and r.sourceField = :field")
    List<Long> findSourceIdsByField(@Param("type") GitArtifactType type, @Param("field") BacklogReferenceField field);

    /** Sources already processed (they have at least one row). */
    @Query("select distinct id(r.source) from BacklogReference r where r.sourceType = :type and id(r.source) in :ids")
    List<Long> findProcessedSourceIds(@Param("type") GitArtifactType type, @Param("ids") Collection<Long> ids);

    @Query("""
            select c.id from GitCommit c
             where c.id > :afterId and (:repositoryId is null or c.repository.id = :repositoryId)
               and not exists (select r.id from BacklogReference r where r.sourceType = :type and id(r.source) = c.id)
             order by c.id""")
    List<Long> findUnprocessedCommitIds(@Param("afterId") Long afterId, @Param("repositoryId") Long repositoryId,
                                        @Param("type") GitArtifactType type, Pageable page);

    @Query("""
            select p.id from GitPullRequest p
             where p.id > :afterId and (:repositoryId is null or p.repository.id = :repositoryId)
               and not exists (select r.id from BacklogReference r where r.sourceType = :type and id(r.source) = p.id)
             order by p.id""")
    List<Long> findUnprocessedPullRequestIds(@Param("afterId") Long afterId, @Param("repositoryId") Long repositoryId,
                                             @Param("type") GitArtifactType type, Pageable page);

    /** Per status, how many distinct commits / pull requests of a repository have at least one such reference. */
    @Query("""
            select r.status, count(distinct id(r.source)) from BacklogReference r
             where r.repository.id in :repositoryIds and r.sourceType = :type
             group by r.status""")
    List<Object[]> countSourcesByStatus(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("type") GitArtifactType type);

    /** Sources with no Task ID that are not linked to any task either (TM-03: a manual link). */
    @Query("""
            select count(distinct id(r.source)) from BacklogReference r
             where r.repository.id in :repositoryIds and r.sourceType = :type
               and r.status = BacklogReferenceStatus.MISSING
               and not exists (select l.id from BacklogGitLink l where l.artifactType = :type and id(l.artifact) = id(r.source))""")
    long countUnlinkedMissingSources(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("type") GitArtifactType type);

    @Query("select count(distinct id(r.source)) from BacklogReference r where r.repository.id in :repositoryIds and r.sourceType = :type")
    long countProcessedSources(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("type") GitArtifactType type);

    @Query("""
            select count(distinct id(r.source)) from BacklogReference r
             where r.repository.id in :repositoryIds and r.sourceType = :type and r.status = :status""")
    long countSources(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("type") GitArtifactType type,
                      @Param("status") BacklogReferenceStatus status);
}
