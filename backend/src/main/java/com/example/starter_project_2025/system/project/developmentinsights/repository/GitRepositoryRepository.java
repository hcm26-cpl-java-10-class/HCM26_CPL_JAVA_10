package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepositoryStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GitRepositoryRepository extends JpaRepository<GitRepository, Long> {
    Optional<GitRepository> findFirstByRootProject_IdAndStatusNotOrderByIdDesc(Long rootProjectId, GitRepositoryStatus excluded);
    Optional<GitRepository> findFirstByRootProject_IdAndStatusNotAndMockDataFalseOrderByIdDesc(
            Long rootProjectId, GitRepositoryStatus excluded);
    Optional<GitRepository> findFirstByRootProject_IdAndMockDataFalseOrderByIdDesc(Long rootProjectId);
    List<GitRepository> findAllByRootProject_IdOrderByIdAsc(Long rootProjectId);
}
