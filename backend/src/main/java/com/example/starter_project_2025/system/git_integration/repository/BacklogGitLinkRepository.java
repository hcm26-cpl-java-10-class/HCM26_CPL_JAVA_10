package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLink;
import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** SY-05: backlog item ↔ commit / pull request links. */
public interface BacklogGitLinkRepository extends JpaRepository<BacklogGitLink, Long> {
    List<BacklogGitLink> findByRepository_IdOrderByIdAsc(Long repositoryId);

    @Query("select l from BacklogGitLink l where l.backlogItem.id = :backlogItemId and l.artifactType = :type and id(l.artifact) = :artifactId")
    Optional<BacklogGitLink> findByBacklogItem_IdAndArtifactTypeAndArtifact_Id(Long backlogItemId, GitArtifactType type, Long artifactId);

    Page<BacklogGitLink> findByBacklogItem_IdAndArtifactType(Long backlogItemId, GitArtifactType type, Pageable page);

    List<BacklogGitLink> findByBacklogItem_IdAndArtifactTypeOrderByArtifactAtDescIdDesc(Long backlogItemId, GitArtifactType type);

    List<BacklogGitLink> findByBacklogItem_IdInAndArtifactType(Collection<Long> backlogItemIds, GitArtifactType type);

    long countByBacklogItem_IdAndArtifactType(Long backlogItemId, GitArtifactType type);

    Optional<BacklogGitLink> findByIdAndBacklogItem_Id(Long id, Long backlogItemId);

    @Query("select l from BacklogGitLink l where l.artifactType = :type and id(l.artifact) in :artifactIds")
    List<BacklogGitLink> findByArtifactTypeAndArtifact_IdIn(GitArtifactType type, Collection<Long> artifactIds);

    /** Rows: backlog item id, artifact type, number of links. */
    @Query("""
            select l.backlogItem.id, l.artifactType, count(l) from BacklogGitLink l
             where l.backlogItem.id in :itemIds
             group by l.backlogItem.id, l.artifactType""")
    List<Object[]> countByItems(@Param("itemIds") Collection<Long> itemIds);

    /** Commits / pull requests of a repository linked to at least one task, AUTO or MANUAL. */
    @Query("select count(distinct id(l.artifact)) from BacklogGitLink l where l.repository.id in :repositoryIds and l.artifactType = :type")
    long countLinkedArtifacts(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("type") GitArtifactType type);

    @Query("select count(distinct l.backlogItem.id) from BacklogGitLink l where l.repository.id in :repositoryIds and l.artifactType = :type")
    long countLinkedItems(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("type") GitArtifactType type);

    /** Removes the automatic link a reference produced (manual links are never removed automatically). */
    @Modifying(flushAutomatically = true)
    @Query("delete from BacklogGitLink l where l.reference.id = :referenceId and l.linkSource = :source")
    int deleteByReference(@Param("referenceId") Long referenceId, @Param("source") BacklogLinkSource source);
}
