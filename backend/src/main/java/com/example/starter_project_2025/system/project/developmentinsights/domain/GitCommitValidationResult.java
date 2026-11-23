package com.example.starter_project_2025.system.project.developmentinsights.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Immutable result snapshot; a new configuration version creates a new history row. */
@Entity
@Table(name = "commit_validation_result", indexes = @Index(name = "idx_git_validation_commit_rule_latest",
        columnList = "commit_id, rule_type, evaluated_at"), uniqueConstraints = @UniqueConstraint(
        name = "uk_git_validation_commit_rule_version", columnNames = {"commit_id", "rule_type", "rule_version"}))
@Getter
@Setter
@NoArgsConstructor
public class GitCommitValidationResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "commit_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_validation_commit"))
    private GitCommit commit;

    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type", nullable = false, length = 32)
    private GitDevelopmentRuleType type;

    @Column(name = "rule_version", nullable = false)
    private int ruleVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private GitCommitValidationStatus status;

    @Column(length = 1000)
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "evaluated_at", nullable = false)
    private Instant evaluatedAt;

    public static GitCommitValidationResult record(GitCommit commit, GitDevelopmentRuleType type,
                                                   int ruleVersion, GitCommitValidationStatus status,
                                                   String reason, String details, Instant at) {
        GitCommitValidationResult result = new GitCommitValidationResult();
        result.commit = commit;
        result.type = type;
        result.ruleVersion = ruleVersion;
        result.status = status;
        result.reason = reason;
        result.details = details;
        result.evaluatedAt = at;
        return result;
    }
}
