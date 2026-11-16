package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface GitRepositoryRepository extends JpaRepository<GitRepository, Long> {

    /** Repository connections with the given status for a batch of GitHub repository ids. */
    List<GitRepository> findByProviderAndExternalIdInAndStatus(
            GitProvider provider, Collection<Long> externalIds, GitRepositoryStatus status);
}
