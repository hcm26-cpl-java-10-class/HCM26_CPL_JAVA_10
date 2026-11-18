package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.BacklogGitLinkExclusion;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.Set;

/** TM-03: task ↔ pull request pairs a user unlinked. */
public interface BacklogGitLinkExclusionRepository extends JpaRepository<BacklogGitLinkExclusion, Long> {

    Optional<BacklogGitLinkExclusion> findByBacklogItemIdAndArtifactTypeAndArtifactId(Long backlogItemId, GitArtifactType type,
                                                                                      Long artifactId);

    @Query("select e.backlogItemId from BacklogGitLinkExclusion e where e.artifactType = :type and e.artifactId = :artifactId")
    Set<Long> findExcludedItemIds(@Param("type") GitArtifactType type, @Param("artifactId") Long artifactId);

    @Modifying(flushAutomatically = true)
    @Query("""
            delete from BacklogGitLinkExclusion e
             where e.backlogItemId = :itemId and e.artifactType = :type and e.artifactId = :artifactId""")
    int deletePair(@Param("itemId") Long itemId, @Param("type") GitArtifactType type, @Param("artifactId") Long artifactId);
}
