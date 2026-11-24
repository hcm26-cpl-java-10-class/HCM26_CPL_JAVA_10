package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLinkExclusion;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** TM-03: task ↔ pull request pairs a user unlinked. */
public interface BacklogGitLinkExclusionRepository extends JpaRepository<BacklogGitLinkExclusion, Long> {

    @Query("select e from BacklogGitLinkExclusion e where e.backlogItem.id = :backlogItemId and e.artifactType = :type and id(e.artifact) = :artifactId")
    Optional<BacklogGitLinkExclusion> findByBacklogItem_IdAndArtifactTypeAndArtifact_Id(Long backlogItemId, GitArtifactType type,
                                                                                      Long artifactId);

    @Query("select e.backlogItem.id from BacklogGitLinkExclusion e where e.artifactType = :type and id(e.artifact) = :artifactId")
    Set<Long> findExcludedItemIds(@Param("type") GitArtifactType type, @Param("artifactId") Long artifactId);

    @Modifying(flushAutomatically = true)
    @Query("""
            delete from BacklogGitLinkExclusion e
             where e.backlogItem.id = :itemId and e.artifactType = :type and id(e.artifact) = :artifactId""")
    int deletePair(@Param("itemId") Long itemId, @Param("type") GitArtifactType type, @Param("artifactId") Long artifactId);
}
