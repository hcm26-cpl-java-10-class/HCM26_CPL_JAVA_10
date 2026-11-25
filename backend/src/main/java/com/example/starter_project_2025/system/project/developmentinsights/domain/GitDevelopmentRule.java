package com.example.starter_project_2025.system.project.developmentinsights.domain;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
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

/** Versioned root-project rules used by future validation runs. */
@Entity
@Table(name = "project_dev_rule", indexes = @Index(name = "idx_git_dev_rule_root_type_version",
        columnList = "project_id, rule_type, version"), uniqueConstraints = @UniqueConstraint(
        name = "uk_git_dev_rule_root_type_version", columnNames = {"project_id", "rule_type", "version"}))
@Getter
@Setter
@NoArgsConstructor
public class GitDevelopmentRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_git_dev_rule_project"))
    private Project rootProject;

    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type", nullable = false, length = 32)
    private GitDevelopmentRuleType type;

    @Column(nullable = false)
    private int version;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "allowed_commit_types", nullable = false, length = 160)
    private String allowedCommitTypes;

    @Column(name = "scope_required", nullable = false)
    private boolean scopeRequired;

    @Column(name = "task_key_pattern", nullable = false, length = 160)
    private String taskKeyPattern;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", foreignKey = @ForeignKey(name = "fk_git_dev_rule_user"))
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static GitDevelopmentRule configure(Project root, GitDevelopmentRuleType type, int version,
                                                boolean enabled, String allowedTypes, boolean scopeRequired,
                                                String taskKeyPattern, User actor, Instant at) {
        GitDevelopmentRule rule = new GitDevelopmentRule();
        rule.rootProject = root;
        rule.type = type;
        rule.version = version;
        rule.enabled = enabled;
        rule.allowedCommitTypes = allowedTypes;
        rule.scopeRequired = scopeRequired;
        rule.taskKeyPattern = taskKeyPattern;
        rule.createdBy = actor;
        rule.createdAt = at;
        return rule;
    }
}
