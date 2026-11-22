package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLink;
import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** SY-05: backlog item ↔ commit / pull request links. */
public interface BacklogGitLinkRepository extends JpaRepository<BacklogGitLink, Long> {

    Optional<BacklogGitLink> findByBacklogItemIdAndArtifactTypeAndArtifactId(Long backlogItemId, GitArtifactType type, Long artifactId);

    Page<BacklogGitLink> findByBacklogItemIdAndArtifactType(Long backlogItemId, GitArtifactType type, Pageable page);

    List<BacklogGitLink> findByBacklogItemIdAndArtifactTypeOrderByArtifactAtDescIdDesc(Long backlogItemId, GitArtifactType type);

    List<BacklogGitLink> findByBacklogItemIdInAndArtifactType(Collection<Long> backlogItemIds, GitArtifactType type);

    long countByBacklogItemIdAndArtifactType(Long backlogItemId, GitArtifactType type);

    Optional<BacklogGitLink> findByIdAndBacklogItemId(Long id, Long backlogItemId);

    List<BacklogGitLink> findByArtifactTypeAndArtifactIdIn(GitArtifactType type, Collection<Long> artifactIds);

    /** Rows: backlog item id, artifact type, number of links. */
    @Query("""
            select l.backlogItemId, l.artifactType, count(l) from BacklogGitLink l
             where l.backlogItemId in :itemIds
             group by l.backlogItemId, l.artifactType""")
    List<Object[]> countByItems(@Param("itemIds") Collection<Long> itemIds);

    /** Commits / pull requests of a repository linked to at least one task, AUTO or MANUAL. */
    @Query("select count(distinct l.artifactId) from BacklogGitLink l where l.repositoryId in :repositoryIds and l.artifactType = :type")
    long countLinkedArtifacts(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("type") GitArtifactType type);

    @Query("select count(distinct l.backlogItemId) from BacklogGitLink l where l.repositoryId in :repositoryIds and l.artifactType = :type")
    long countLinkedItems(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("type") GitArtifactType type);

    /** Removes the automatic link a reference produced (manual links are never removed automatically). */
    @Modifying(flushAutomatically = true)
    @Query("delete from BacklogGitLink l where l.referenceId = :referenceId and l.linkSource = :source")
    int deleteByReference(@Param("referenceId") Long referenceId, @Param("source") BacklogLinkSource source);
}
