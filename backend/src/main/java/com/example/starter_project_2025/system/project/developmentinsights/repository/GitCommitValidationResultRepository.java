package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationResult;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GitCommitValidationResultRepository extends JpaRepository<GitCommitValidationResult, Long> {
    List<GitCommitValidationResult> findAllByCommit_IdAndEvaluationKeyOrderByTypeAsc(Long commitId, String evaluationKey);
    List<GitCommitValidationResult> findAllByCommit_IdOrderByEvaluatedAtDescIdDesc(Long commitId);
    List<GitCommitValidationResult> findAllByCommit_IdInOrderByEvaluatedAtDescIdDesc(java.util.Collection<Long> commitIds);
    @org.springframework.data.jpa.repository.Query("select r from GitCommitValidationResult r where r.commit.id = :commitId and r.type = :type and r.ruleVersion = :ruleVersion and r.evaluationKey = 'INGESTION'")
    Optional<GitCommitValidationResult> findFirstByCommit_IdAndTypeAndRuleVersion(
            Long commitId, GitDevelopmentRuleType type, int ruleVersion);
}
