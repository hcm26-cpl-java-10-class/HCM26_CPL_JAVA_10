package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

@org.springframework.stereotype.Repository("activityGitContributorRepository")
public interface GitContributorRepository extends JpaRepository<GitContributor, Long> {
    Optional<GitContributor> findFirstByRootProject_IdAndSourceIdentityKey(Long rootId, String key);
    List<GitContributor> findAllByRootProject_IdAndUser_IdIn(Long rootProjectId, Collection<Long> userIds);

    List<GitContributor> findAllByRootProject_IdAndIdIn(Long rootProjectId, Collection<Long> contributorIds);

    Optional<GitContributor> findFirstByRootProject_IdAndExternalId(Long rootProjectId, Long externalId);
}
