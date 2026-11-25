package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRule;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GitDevelopmentRuleRepository extends JpaRepository<GitDevelopmentRule, Long> {
    List<GitDevelopmentRule> findAllByRootProject_IdOrderByTypeAscVersionDesc(Long rootProjectId);
    Optional<GitDevelopmentRule> findFirstByRootProject_IdAndTypeOrderByVersionDesc(
            Long rootProjectId, GitDevelopmentRuleType type);
}
