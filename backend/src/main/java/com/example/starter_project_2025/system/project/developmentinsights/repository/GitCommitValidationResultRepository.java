package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationResult;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GitCommitValidationResultRepository extends JpaRepository<GitCommitValidationResult, Long> {
    List<GitCommitValidationResult> findAllByCommit_IdOrderByEvaluatedAtDescIdDesc(Long commitId);
    List<GitCommitValidationResult> findAllByCommit_IdInOrderByEvaluatedAtDescIdDesc(java.util.Collection<Long> commitIds);
    Optional<GitCommitValidationResult> findFirstByCommit_IdAndTypeAndRuleVersion(
            Long commitId, GitDevelopmentRuleType type, int ruleVersion);
}
